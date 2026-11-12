-- Plan notes keep an end date, the same way the Review Assistant keeps noteUntil.
-- Not applied here. Apply this file yourself.

alter table public.reviews
  add column notes_until date;

alter table public.reviews
  add constraint reviews_notes_until_needs_note
  check (notes_until is null or notes is not null);

create or replace function public.set_review_notes(p_review_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
  v_notes text := nullif(btrim(p_notes), '');
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.notes is not distinct from v_notes and (v_notes is not null or v_rev.notes_until is null) then
    return;
  end if;
  update public.reviews
     set notes = v_notes,
         notes_until = case when v_notes is null then null else notes_until end
   where id = p_review_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'notes_set',
          format('Review notes changed for %s', v_rev.gta_id),
          jsonb_build_object('gta_id', v_rev.gta_id, 'notes_until', case when v_notes is null then null else v_rev.notes_until end));
end;
$$;

create or replace function public.set_review_plan_note(p_review_id uuid, p_notes text, p_until date)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
  v_notes text := nullif(btrim(p_notes), '');
  v_until date := case when v_notes is null then null else p_until end;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.notes is not distinct from v_notes and v_rev.notes_until is not distinct from v_until then
    return;
  end if;
  update public.reviews set notes = v_notes, notes_until = v_until where id = p_review_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'notes_set',
          format('Review notes changed for %s', v_rev.gta_id),
          jsonb_build_object('gta_id', v_rev.gta_id, 'notes_until', v_until));
end;
$$;

revoke all on function public.set_review_plan_note(uuid, text, date) from public, anon;
grant execute on function public.set_review_plan_note(uuid, text, date) to authenticated, service_role;
