-- Guest (anonymous) accounts: customers can order without signing up.
-- Run after schema.sql and 002, in the SQL editor. Also turn on
-- Authentication → Sign In / Providers → "Allow anonymous sign-ins" (see README).
--
-- Anonymous users are ordinary "authenticated" users with is_anonymous = true, so the existing order and
-- storage policies already let them place and track their own orders. This file only adds three guards.

-- 1. Guests are always customers: the sign-up metadata can't make an anonymous account a printer.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}');
  r text := case when m->>'role' = 'printer' and not coalesce(new.is_anonymous, false) then 'printer' else 'customer' end;
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

-- 2. When a guest adds an email and confirms it, copy it to their profile so the admin page can reach them.
create or replace function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set email = new.email where id = new.id;
  return new;
end $$;
drop trigger if exists on_auth_user_email on auth.users;
create trigger on_auth_user_email after update of email on auth.users
  for each row when (new.email is distinct from old.email) execute function public.sync_profile_email();

-- 3. Anyone can make a guest account, so a guest may have at most 10 parts in progress (one full cart).
-- ponytail: a per-account cap; add Supabase's CAPTCHA (Auth → Bot protection) if guests start making many accounts.
create or replace function public.guest_order_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     and (select count(*) from orders where customer_id = auth.uid() and status not in ('completed', 'cancelled')) >= 10 then
    raise exception 'Guest accounts can have 10 parts in progress. Add an email in My orders to order more.';
  end if;
  return new;
end $$;
drop trigger if exists orders_guest_limit on public.orders;
create trigger orders_guest_limit before insert on public.orders
  for each row execute function public.guest_order_limit();
