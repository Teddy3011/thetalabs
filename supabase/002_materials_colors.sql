-- Materials and color choices. Run after schema.sql (SQL Editor → New query → Run).

-- ---------------------------------------------------------------- materials (admin-editable)
create table public.materials (
  id           text primary key check (id ~ '^[a-z0-9_]{1,30}$'),
  name         text not null check (length(name) between 1 and 60),
  density      numeric not null check (density > 0 and density < 5),            -- g/cm³, used for the weight estimate
  price_factor numeric not null check (price_factor > 0 and price_factor <= 10), -- multiplies the per-gram rate
  active       boolean not null default true,
  sort         int not null default 0
);
insert into public.materials values
  ('pla',  'PLA (standard, most parts)', 1.24, 1.0, true, 1),
  ('petg', 'PETG (tougher, heat resistant)', 1.27, 1.2, true, 2),
  ('tpu',  'TPU (flexible, rubber-like)', 1.21, 1.5, true, 3);

alter table public.materials enable row level security;
create policy "materials readable by all" on public.materials for select using (true);
create policy "materials admin insert" on public.materials for insert to authenticated with check (public.is_admin());
create policy "materials admin update" on public.materials for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- order columns
-- Same list as COLORS in assets/stl.js.
alter table public.orders
  add column material text not null default 'pla' references public.materials (id),
  add column color_choices text[] not null default '{}' check (
    color_choices <@ array['Black', 'White', 'Grey', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Lime', 'Purple']
    and cardinality(color_choices) in (0, colors));  -- 0 = orders placed before colors were picked

-- ---------------------------------------------------------------- pricing: rate × material price_factor
create or replace function public.orders_before_insert() returns trigger
language plpgsql set search_path = public as $$
declare s settings; m materials;
begin
  select * into s from settings where region = new.region;
  if not found then raise exception 'Unknown region %', new.region; end if;
  select * into m from materials where id = new.material and active;
  if not found then raise exception 'That material is not available'; end if;
  if cardinality(new.color_choices) <> new.colors then raise exception 'Pick one color per color slot'; end if;
  if auth.uid() is not null and split_part(new.file_path, '/', 1) is distinct from auth.uid()::text then
    raise exception 'File must be uploaded to your own folder';
  end if;
  new.status := 'open';
  new.printer_id := null;
  new.accepted_at := null;
  new.created_at := now();
  new.updated_at := now();
  new.currency := s.currency;
  new.price_low := order_price(new.est_weight_g, new.quantity, new.colors, new.rush, s.rate_min * m.price_factor, s);
  new.price_high := order_price(new.est_weight_g, new.quantity, new.colors, new.rush, s.rate_max * m.price_factor, s);
  new.payout := round(new.price_low * s.payout_pct / 100 + s.payout_flat, 2);
  return new;
end $$;
