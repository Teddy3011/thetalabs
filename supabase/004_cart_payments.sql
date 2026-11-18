-- Cart checkout and payment. Run after 003, in the SQL editor.
--
-- An order now goes:  quote → priced → open → accepted → printing → ready → completed
--   quote   the customer checked out (no charge); we haven't set the final price yet
--   priced  the admin set final_price (set_final_price); the customer can pay
--   open    paid by card (Stripe webhook → mark_cart_paid) or pay on pickup chosen (pay_on_pickup).
--           Only now do printers see the job, so nobody prints an unpaid, unpriced part.
-- Every part checked out together shares a cart_id, and the customer pays for the cart in one go.

alter table public.orders
  add column cart_id        uuid,
  add column final_price    numeric check (final_price is null or final_price > 0),
  add column payment        text check (payment in ('card', 'pickup')),
  add column paid_at        timestamptz,
  add column amount_paid    numeric,
  add column stripe_session text;
create index orders_cart_idx on public.orders (cart_id);

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('quote', 'priced', 'open', 'accepted', 'printing', 'ready', 'completed', 'cancelled'));
alter table public.orders drop constraint printer_matches_status;
alter table public.orders add constraint printer_matches_status check (
  (status in ('quote', 'priced', 'open') and printer_id is null)
  or (status in ('accepted', 'printing', 'ready', 'completed') and printer_id is not null)
  or status = 'cancelled');

-- New orders start as quotes with nothing paid. Named to run after orders_before_insert (triggers fire in name order).
create function public.orders_checkout_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  new.status := 'quote';
  new.final_price := null; new.payment := null; new.paid_at := null; new.amount_paid := null; new.stripe_session := null;
  if new.cart_id is null then new.cart_id := gen_random_uuid(); end if;
  if exists (select 1 from orders where cart_id = new.cart_id and customer_id <> new.customer_id) then
    raise exception 'That order belongs to someone else';
  end if;
  return new;
end $$;
create trigger orders_zz_checkout before insert on public.orders
  for each row execute function public.orders_checkout_insert();

-- Admin: set (or change) a part's final price while it is unpaid. The printer payout follows the final price.
create function public.set_final_price(order_id uuid, price numeric) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o orders; s settings;
begin
  if not is_admin() then raise exception 'Only the admin can set prices'; end if;
  if price is null or price <= 0 then raise exception 'Enter a price above zero'; end if;
  select * into s from settings where region = (select region from orders where id = order_id);
  update orders set final_price = round(price, 2), status = 'priced',
         payout = round(round(price, 2) * s.payout_pct / 100 + s.payout_flat, 2)
   where id = order_id and status in ('quote', 'priced') and payment is null
   returning * into o;
  if not found then raise exception 'This part is already paid for or past pricing'; end if;
  return o;
end $$;

-- Customer: pay when collecting. Only for their own cart, once every part in it is priced.
create function public.pay_on_pickup(cart uuid) returns setof public.orders
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from orders where cart_id = cart and customer_id = auth.uid() and status = 'priced')
     or exists (select 1 from orders where cart_id = cart and status <> 'cancelled'
                and (customer_id <> auth.uid() or status <> 'priced' or payment is not null)) then
    raise exception 'This order isn''t ready to pay yet';
  end if;
  return query update orders set payment = 'pickup', status = 'open'
                where cart_id = cart and status = 'priced' returning *;
end $$;

-- Stripe webhook only (service role): the card payment for this cart went through.
-- ponytail: amount_paid records each part's final price; the webhook logs if Stripe's total differs (a price changed
-- after checkout opened). Store per-session line amounts if that ever happens in practice.
create function public.mark_cart_paid(cart uuid, session text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update orders set payment = 'card', paid_at = now(), stripe_session = session, amount_paid = final_price, status = 'open'
   where cart_id = cart and status = 'priced' and payment is null;
end $$;

revoke execute on function public.set_final_price(uuid, numeric), public.pay_on_pickup(uuid),
  public.mark_cart_paid(uuid, text) from public, anon, authenticated;
grant execute on function public.set_final_price(uuid, numeric), public.pay_on_pickup(uuid) to authenticated;
grant execute on function public.mark_cart_paid(uuid, text) to service_role;
