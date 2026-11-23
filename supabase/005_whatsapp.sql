-- WhatsApp order updates. Run after 004, in the SQL editor. Then follow README, "WhatsApp updates".
--
-- A customer who opts in at checkout leaves one WhatsApp number per cart. Only they and the admin can read it:
-- printer owners can read orders, but never this table. The whatsapp-notify function (service role) reads it to send
-- updates, and whatsapp_sent makes sure each update goes out once even if Supabase delivers the same change twice.

create table public.order_contacts (
  cart_id    uuid primary key,
  customer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  whatsapp   text not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),  -- E.164, e.g. +14805550123
  consented_at timestamptz not null default now()
);
alter table public.order_contacts enable row level security;
create policy "contacts own or admin" on public.order_contacts for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());
-- only for a cart that is really theirs
create policy "contacts customer insert" on public.order_contacts for insert to authenticated
  with check (customer_id = auth.uid()
    and exists (select 1 from public.orders o where o.cart_id = order_contacts.cart_id and o.customer_id = auth.uid()));
create policy "contacts customer delete" on public.order_contacts for delete to authenticated
  using (customer_id = auth.uid());  -- stop updates

create table public.whatsapp_sent (
  key     text primary key,  -- '<cart_id>:priced', '<cart_id>:printing' or '<order_id>:ready'
  sent_at timestamptz not null default now()
);
alter table public.whatsapp_sent enable row level security;  -- no policies: only the service role touches it
