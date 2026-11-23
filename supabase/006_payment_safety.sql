-- Payment safety. Run after 005, in the SQL editor. Needed before card payments are turned on; harmless before.
--
-- - A checkout session is remembered per cart (id, link, expiry), so a second click reuses it instead of opening
--   another one the customer could also pay.
-- - The admin can't change a price while the customer has an open card checkout (sessions last 30 minutes).
-- - A payment that doesn't match (amount, currency, an older session) is still recorded, with payment_issue set,
--   so nobody is asked to pay twice and the admin sees what to sort out.

alter table public.orders
  add column stripe_checkout_url text,
  add column stripe_expires_at   timestamptz,
  add column payment_issue       text;

create or replace function public.set_final_price(order_id uuid, price numeric) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o orders; s settings;
begin
  if not is_admin() then raise exception 'Only the admin can set prices'; end if;
  if price is null or price <= 0 then raise exception 'Enter a price above zero'; end if;
  if exists (select 1 from orders x where x.id = order_id and x.payment is null and x.stripe_session is not null
             and x.stripe_expires_at > now()) then
    raise exception 'The customer has a card checkout open for this order. Try again in 30 minutes, after it expires.';
  end if;
  select * into s from settings where region = (select region from orders where id = order_id);
  update orders set final_price = round(price, 2), status = 'priced',
         payout = round(round(price, 2) * s.payout_pct / 100 + s.payout_flat, 2),
         stripe_session = null, stripe_checkout_url = null, stripe_expires_at = null
   where id = order_id and status in ('quote', 'priced') and payment is null
   returning * into o;
  if not found then raise exception 'This part is already paid for or past pricing'; end if;
  return o;
end $$;

-- create-checkout (service role): remember the open session for the cart's unpaid parts.
create function public.record_checkout(cart uuid, session text, url text, expires timestamptz) returns void
language sql security definer set search_path = public as $$
  update orders set stripe_session = session, stripe_checkout_url = url, stripe_expires_at = expires
   where cart_id = cart and status = 'priced' and payment is null;
$$;

-- stripe-webhook (service role): the session expired unpaid; forget it if it's still the one on file.
create function public.clear_checkout(cart uuid, session text) returns void
language sql security definer set search_path = public as $$
  update orders set stripe_session = null, stripe_checkout_url = null, stripe_expires_at = null
   where cart_id = cart and stripe_session = session and payment is null;
$$;

-- stripe-webhook (service role): record a card payment once. "payment is null" makes repeats do nothing.
drop function if exists public.mark_cart_paid(uuid, text);
create function public.mark_cart_paid(cart uuid, session text, amount numeric, issue text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update orders set payment = 'card', paid_at = now(), stripe_session = session, stripe_checkout_url = null,
         amount_paid = case when issue is null then final_price end,
         payment_issue = case when issue is null then null else format('Stripe paid %s for the whole order: %s', amount, issue) end,
         status = 'open'
   where cart_id = cart and status = 'priced' and payment is null;
end $$;

revoke execute on function public.record_checkout(uuid, text, text, timestamptz), public.clear_checkout(uuid, text),
  public.mark_cart_paid(uuid, text, numeric, text) from public, anon, authenticated;
grant execute on function public.record_checkout(uuid, text, text, timestamptz), public.clear_checkout(uuid, text),
  public.mark_cart_paid(uuid, text, numeric, text) to service_role;
