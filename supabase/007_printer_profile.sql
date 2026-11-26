-- Printer profile, filament, job updates and progress photos. Run after schema.sql (SQL Editor → New query → Run).
-- Doesn't depend on 005/006.
--
-- 1. printer_profiles: what an approved printer can do and whether it's taking work (Available / Busy / Off),
--    plus the filament on hand: one entry per spool, { material, color, grams } (grams left).
--    Only the printer and the admin can see it for now; customers will see it when they can choose a printer.
--    The printer's area is the city and ZIP already on their profile.
-- 2. orders.ready_by / printer_note: the printer tells the customer when a part will be ready and anything else
--    worth knowing. Changed only through set_job_update, by the printer who accepted the job.
-- 3. Progress photos: up to three per part (start = first layer, middle, done), in the private job-photos bucket
--    at <order id>/<stage>.jpg. The printer who accepted the job uploads them; that printer, the customer and the
--    admin can see them. orders.photos lists the stages taken, so the order page knows what to show and updates live.

create table public.printer_profiles (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null default 'My printer' check (length(display_name) between 1 and 40),
  status       text not null default 'available' check (status in ('available', 'busy', 'off')),
  machine      text not null default '' check (length(machine) <= 80),
  max_size_mm  int check (max_size_mm between 20 and 1000),  -- biggest part side
  spools       jsonb not null default '[]' check (jsonb_typeof(spools) = 'array' and jsonb_array_length(spools) <= 40),
  lead_days    int not null default 2 check (lead_days between 1 and 30),
  pickup_note  text not null default '' check (length(pickup_note) <= 200),
  updated_at   timestamptz not null default now()
);

create trigger printer_profiles_touch before update on public.printer_profiles
  for each row execute function public.touch_updated_at();

alter table public.printer_profiles enable row level security;
create policy "printer profile own or admin" on public.printer_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "printer profile insert own" on public.printer_profiles for insert to authenticated
  with check (user_id = auth.uid() and (public.is_approved_printer() or public.is_admin()));
create policy "printer profile update own" on public.printer_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and (public.is_approved_printer() or public.is_admin()));

-- ---------------------------------------------------------------- updates the customer sees on their order page
alter table public.orders
  add column ready_by     date,
  add column printer_note text check (length(printer_note) <= 280),
  add column note_at      timestamptz,
  add column photos       text[] not null default '{}' check (photos <@ array['start', 'middle', 'done']);

create function public.set_job_update(order_id uuid, ready date, note text) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if not (is_approved_printer() or is_admin()) then raise exception 'Only approved printers can update jobs'; end if;
  if ready is not null and ready < current_date then raise exception 'The ready date can''t be in the past'; end if;
  update orders set ready_by = ready, printer_note = nullif(trim(note), ''), note_at = now()
   where id = order_id and printer_id = auth.uid() and status in ('accepted', 'printing', 'ready')
   returning * into o;
  if not found then raise exception 'You can only update jobs you accepted that aren''t finished'; end if;
  return o;
end $$;

-- called after a photo is uploaded, so the order page shows it
create function public.add_job_photo(order_id uuid, stage text) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if stage not in ('start', 'middle', 'done') then raise exception 'Unknown photo stage'; end if;
  update orders set photos = array(select distinct unnest(photos || stage))
   where id = order_id and printer_id = auth.uid() and status in ('accepted', 'printing', 'ready')
   returning * into o;
  if not found then raise exception 'You can only add photos to jobs you accepted that aren''t finished'; end if;
  return o;
end $$;

revoke execute on function public.set_job_update(uuid, date, text), public.add_job_photo(uuid, text) from public, anon;
grant execute on function public.set_job_update(uuid, date, text), public.add_job_photo(uuid, text) to authenticated;

-- ---------------------------------------------------------------- storage: private bucket for progress photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 5242880, array['image/jpeg']);  -- 5 MB; the page shrinks photos first

-- the printer working on the order can add or replace its three photos
create policy "job photos printer insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'job-photos' and storage.filename(name) in ('start.jpg', 'middle.jpg', 'done.jpg')
  and exists (select 1 from public.orders o where o.id::text = (storage.foldername(name))[1]
              and o.printer_id = auth.uid() and o.status in ('accepted', 'printing', 'ready')));
create policy "job photos printer update" on storage.objects for update to authenticated
  using (bucket_id = 'job-photos' and exists (select 1 from public.orders o where o.id::text = (storage.foldername(name))[1]
              and o.printer_id = auth.uid() and o.status in ('accepted', 'printing', 'ready')))
  with check (bucket_id = 'job-photos' and storage.filename(name) in ('start.jpg', 'middle.jpg', 'done.jpg'));
-- the customer, the printer and the admin can see them
create policy "job photos read" on storage.objects for select to authenticated using (
  bucket_id = 'job-photos' and (public.is_admin() or exists (
    select 1 from public.orders o where o.id::text = (storage.foldername(name))[1]
      and (o.customer_id = auth.uid() or o.printer_id = auth.uid()))));
