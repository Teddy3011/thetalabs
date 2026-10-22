-- Theta Labs 3D marketplace schema.
-- Paste the whole file into Supabase → SQL Editor → New query → Run. Safe to run once on a fresh project.
-- Tables: settings, profiles, printer_applications, orders. RLS on every table. Private "stl" storage bucket.
-- Make yourself admin afterwards (after signing up on the site):
--   update public.profiles set role = 'admin' where email = 'info@thetalab3d.shop';

-- ---------------------------------------------------------------- settings (pricing + payout, one row per region)
create table public.settings (
  region      text primary key check (region in ('US', 'IN')),
  currency    text not null,
  rate_min    numeric not null check (rate_min > 0),          -- per gram
  rate_max    numeric not null check (rate_max >= rate_min),
  minimum     numeric not null check (minimum >= 0),          -- minimum order
  multicolor  numeric not null check (multicolor >= 0),       -- flat fee when colors > 1
  rush_pct    numeric not null check (rush_pct between 0 and 200),
  payout_flat numeric not null check (payout_flat >= 0),      -- printer payout = payout_flat + payout_pct% of price_low
  payout_pct  numeric not null check (payout_pct between 0 and 100),
  updated_at  timestamptz not null default now()
);
insert into public.settings values
  ('US', 'USD', 1, 2, 15, 5, 25, 10, 0, now()),
  ('IN', 'INR', 6, 8, 300, 150, 25, 150, 0, now());

-- ---------------------------------------------------------------- profiles (one per auth user, created by trigger)
create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  full_name  text check (length(full_name) <= 100),
  role       text not null default 'customer' check (role in ('customer', 'printer', 'admin')),
  city       text check (length(city) <= 80),
  zip        text check (length(zip) <= 12),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- printer applications (admin approves)
create table public.printer_applications (
  user_id       uuid primary key references public.profiles on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  printer_model text check (length(printer_model) <= 100),
  city          text not null check (length(city) between 1 and 80),
  zip           text check (length(zip) <= 12),
  region        text not null references public.settings (region),
  notes         text check (length(notes) <= 1000),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);

-- ---------------------------------------------------------------- orders
create table public.orders (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  customer_id  uuid not null default auth.uid() references public.profiles (id),
  printer_id   uuid references public.profiles (id),
  accepted_at  timestamptz,
  status       text not null default 'open'
               check (status in ('open', 'accepted', 'printing', 'ready', 'completed', 'cancelled')),
  file_path    text not null unique,
  filename     text not null check (filename ~* '\.stl$' and length(filename) <= 200),
  quantity     int not null check (quantity between 1 and 50),
  colors       int not null check (colors between 1 and 4),
  infill       int not null check (infill between 5 and 100),
  rush         boolean not null default false,
  region       text not null references public.settings (region),
  city         text not null check (length(city) between 1 and 80),
  zip          text check (length(zip) <= 12),
  fulfillment  text not null check (fulfillment in ('pickup', 'delivery')),
  size_x       numeric not null check (size_x > 0 and size_x <= 1000),   -- mm, bounding box
  size_y       numeric not null check (size_y > 0 and size_y <= 1000),
  size_z       numeric not null check (size_z > 0 and size_z <= 1000),
  est_weight_g numeric not null check (est_weight_g > 0 and est_weight_g <= 5000),  -- per part
  notes        text check (length(notes) <= 1000),
  -- set by the insert trigger from settings; client values are ignored
  currency     text not null default '',
  price_low    numeric not null default 0,
  price_high   numeric not null default 0,
  payout       numeric not null default 0,
  -- a job is either open with no printer, or in progress with exactly one printer
  constraint printer_matches_status check (
    (status = 'open' and printer_id is null)
    or (status in ('accepted', 'printing', 'ready', 'completed') and printer_id is not null)
    or status = 'cancelled')
);
create index orders_status_idx on public.orders (status);
create index orders_customer_idx on public.orders (customer_id);
create index orders_printer_idx on public.orders (printer_id);

-- ---------------------------------------------------------------- helper functions (security definer: bypass RLS, no recursion)
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create function public.is_approved_printer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p join printer_applications a on a.user_id = p.id
    where p.id = auth.uid() and p.role = 'printer' and a.status = 'approved');
$$;

-- Same formula as priceRange() in assets/stl.js. The server value is the one stored.
create function public.order_price(grams numeric, qty int, colors int, rush boolean, rate numeric, s public.settings)
returns numeric language sql immutable as $$
  select round(
    (greatest(s.minimum, grams * qty * rate) + case when colors > 1 then s.multicolor else 0 end)
    * case when rush then 1 + s.rush_pct / 100 else 1 end, 2);
$$;

-- ---------------------------------------------------------------- triggers
-- New auth user → profile (+ printer application). Role can only be customer or printer here; admin is set by hand.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}');
  r text := case when m->>'role' = 'printer' then 'printer' else 'customer' end;
begin
  insert into profiles (id, email, full_name, role, city, zip)
  values (new.id, new.email, left(m->>'full_name', 100), r, left(m->>'city', 80), left(m->>'zip', 12));
  if r = 'printer' then
    insert into printer_applications (user_id, printer_model, city, zip, region, notes)
    values (new.id, left(m->>'printer_model', 100), coalesce(nullif(left(m->>'city', 80), ''), 'Unknown'),
            left(m->>'zip', 12), case when m->>'region' = 'IN' then 'IN' else 'US' end, left(m->>'notes', 1000));
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- New order: force status/printer, check the file is in the customer's own folder, compute price + payout server-side.
create function public.orders_before_insert() returns trigger
language plpgsql set search_path = public as $$
declare s settings;
begin
  select * into s from settings where region = new.region;
  if not found then raise exception 'Unknown region %', new.region; end if;
  if auth.uid() is not null and split_part(new.file_path, '/', 1) is distinct from auth.uid()::text then
    raise exception 'File must be uploaded to your own folder';
  end if;
  new.status := 'open';
  new.printer_id := null;
  new.accepted_at := null;
  new.created_at := now();
  new.updated_at := now();
  new.currency := s.currency;
  new.price_low := order_price(new.est_weight_g, new.quantity, new.colors, new.rush, s.rate_min, s);
  new.price_high := order_price(new.est_weight_g, new.quantity, new.colors, new.rush, s.rate_max, s);
  new.payout := round(new.price_low * s.payout_pct / 100 + s.payout_flat, 2);
  return new;
end $$;
create trigger orders_before_insert before insert on public.orders
  for each row execute function public.orders_before_insert();

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- job actions (the only way printers change orders)
-- First to accept wins: the UPDATE only matches while the row is still open. A concurrent second call waits on the
-- row lock, re-checks the WHERE clause after the first commits, matches nothing and raises.
create function public.accept_job(order_id uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if not (is_approved_printer() or is_admin()) then raise exception 'Only approved printers can accept jobs'; end if;
  update orders set status = 'accepted', printer_id = auth.uid(), accepted_at = now()
   where id = order_id and status = 'open' and printer_id is null
   returning * into o;
  if not found then raise exception 'This job was already taken or is no longer open'; end if;
  return o;
end $$;

create function public.set_job_status(order_id uuid, new_status text) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if not (is_approved_printer() or is_admin()) then raise exception 'Only approved printers can update jobs'; end if;
  update orders set status = new_status
   where id = order_id and printer_id = auth.uid()
     and (status, new_status) in (('accepted', 'printing'), ('printing', 'ready'), ('ready', 'completed'))
   returning * into o;
  if not found then raise exception 'That status change is not allowed for this job'; end if;
  return o;
end $$;

revoke execute on function public.accept_job(uuid), public.set_job_status(uuid, text) from public, anon;
grant execute on function public.accept_job(uuid), public.set_job_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------- row level security
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.printer_applications enable row level security;
alter table public.orders enable row level security;

create policy "settings readable by all" on public.settings for select using (true);
create policy "settings admin update" on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "profiles own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- users may only edit these columns of their own profile (never role)
revoke update on public.profiles from authenticated, anon;
grant update (full_name, city, zip) on public.profiles to authenticated;

create policy "applications own or admin" on public.printer_applications for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "applications admin update" on public.printer_applications for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "orders visible" on public.orders for select to authenticated using (
  customer_id = auth.uid()
  or public.is_admin()
  or (public.is_approved_printer() and (status = 'open' or printer_id = auth.uid())));
create policy "orders customer insert" on public.orders for insert to authenticated
  with check (customer_id = auth.uid());
create policy "orders admin update" on public.orders for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "orders admin delete" on public.orders for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------- realtime (respects RLS)
alter publication supabase_realtime add table public.orders;

-- ---------------------------------------------------------------- storage: private bucket for STL files
-- Supabase free plan caps uploads at 50 MB per file, so the bucket limit is 50 MB.
-- On Pro you can raise the global limit, then set file_size_limit to 62914560 (60 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stl', 'stl', false, 52428800, array['model/stl', 'application/octet-stream']);

create policy "stl upload to own folder" on storage.objects for insert to authenticated with check (
  bucket_id = 'stl'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(name) like '%.stl');

-- read (and so signed URLs): owner, admin, or the printer who accepted the job using that file
create policy "stl read" on storage.objects for select to authenticated using (
  bucket_id = 'stl' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.orders o
               where o.file_path = storage.objects.name and o.printer_id = auth.uid()
                 and o.status in ('accepted', 'printing', 'ready'))));

create policy "stl admin delete" on storage.objects for delete to authenticated using (
  bucket_id = 'stl' and public.is_admin());
