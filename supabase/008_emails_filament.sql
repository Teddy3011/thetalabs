-- Order emails and automatic filament use. Run after 007, in the SQL editor.
--
-- 1. email_sent: the order-email function claims each email here first, so a change Supabase delivers twice is
--    only emailed once. Only the service role touches it.
-- 2. Marking a part ready takes its filament off the printer's spools: the part's weight × quantity, split evenly
--    across its colors, from the matching material + color spool that has the least left (the open one, usually).

create table public.email_sent (
  key     text primary key,  -- '<cart_id>:priced', '<order_id>:ready', '<order_id>:note:<time>', '<order_id>:photo'
  sent_at timestamptz not null default now()
);
alter table public.email_sent enable row level security;  -- no policies: only the service role touches it

-- ponytail: a part that needs more than one spool holds is only taken from one (down to 0); fine for a hand-kept count
create function public.use_filament(o public.orders) returns void
language plpgsql security definer set search_path = public as $$
declare p printer_profiles; sp jsonb; c text; per numeric; i int; best int; g numeric;
begin
  select * into p from printer_profiles where user_id = o.printer_id for update;
  if not found then return; end if;
  sp := p.spools;
  per := o.est_weight_g * o.quantity / greatest(cardinality(o.color_choices), 1);
  foreach c in array (case when cardinality(o.color_choices) > 0 then o.color_choices else array[null::text] end) loop
    best := null;
    for i in 0 .. jsonb_array_length(sp) - 1 loop
      g := (sp -> i ->> 'grams')::numeric;
      if sp -> i ->> 'material' = o.material and (c is null or sp -> i ->> 'color' = c) and g > 0
         and (best is null or g < (sp -> best ->> 'grams')::numeric) then best := i; end if;
    end loop;
    if best is not null then
      sp := jsonb_set(sp, array[best::text, 'grams'], to_jsonb(greatest(0, round((sp -> best ->> 'grams')::numeric - per))));
    end if;
  end loop;
  update printer_profiles set spools = sp where user_id = o.printer_id;
end $$;
revoke execute on function public.use_filament(public.orders) from public, anon, authenticated;

create or replace function public.set_job_status(order_id uuid, new_status text) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if not (is_approved_printer() or is_admin()) then raise exception 'Only approved printers can update jobs'; end if;
  update orders set status = new_status
   where id = order_id and printer_id = auth.uid()
     and (status, new_status) in (('accepted', 'printing'), ('printing', 'ready'), ('ready', 'completed'))
   returning * into o;
  if not found then raise exception 'That status change is not allowed for this job'; end if;
  if new_status = 'ready' then perform use_filament(o); end if;
  return o;
end $$;
