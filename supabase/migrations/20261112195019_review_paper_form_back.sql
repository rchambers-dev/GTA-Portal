-- Paper forms: a tutor's form that comes back on paper is recorded through a function, not by hand.
-- 1. release (and the internal release helper) take an optional note on the 'released' event.
-- 2. submit_review_paper_form: with the tutor -> to_book for a form that is back on paper. It does not run the on-screen
--    completeness check (the content is on paper), marks the form entry_method 'paper', records the 'submitted' event with the
--    note, and leaves any booking as it is (a dated booking moves the pack on to booked, a missing one does not create one).
-- The daily job still calls the helper with three arguments (the note defaults to null).
drop function if exists public.review_pack_release_core(uuid, text, boolean);
drop function if exists public.release_review_to_tutor(uuid);

create or replace function public.review_pack_release_core(p_pack_id uuid, p_source text, p_system boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pack public.review_packs%rowtype;
  v_rev public.reviews%rowtype;
  v_tutor uuid;
  v_prev_pack uuid;
begin
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if v_pack.stage <> 'waiting' then
    raise exception 'Only a waiting pack can be released to the tutor (this one is %)', v_pack.stage using errcode = '23514';
  end if;
  if v_pack.hold_reason is not null then
    raise exception 'This pack is on hold (%). Release the hold first.', v_pack.hold_reason using errcode = '23514';
  end if;
  select * into v_rev from public.reviews r where r.id = v_pack.review_id;
  if v_rev.status <> 'open' then
    raise exception 'The review is already completed' using errcode = '23514';
  end if;
  select t.tutor_id into v_tutor
    from public.apprentice_tutors t where t.apprentice_id = v_pack.gta_id and t.end_date is null;
  if v_tutor is null then
    raise exception 'Apprentice % has no current tutor to release the pack to', v_pack.gta_id using errcode = '23514';
  end if;
  update public.review_packs
     set tutor_id = v_tutor, learner_snapshot = public.review_pack_snapshot(v_pack.review_id), snapshot_at = now()
   where id = p_pack_id;
  -- an empty form, the 7 progress areas, and last cycle's new targets as this cycle's previous targets
  insert into public.review_tutor_forms (pack_id) values (p_pack_id) on conflict (pack_id) do nothing;
  insert into public.review_progress_rows (pack_id, area)
  select p_pack_id, a.area
  from unnest(array['overall_progress','knowledge_theory','practical_skills','behaviours_attendance','english_maths','off_the_job','epa_gateway']) as a(area)
  on conflict (pack_id, area) do nothing;
  select p.id into v_prev_pack
    from public.review_packs p join public.reviews r on r.id = p.review_id
   where p.gta_id = v_pack.gta_id and r.status = 'completed' and p.stage = 'completed'
   order by r.actual_on desc limit 1;
  if v_prev_pack is not null then
    insert into public.review_targets (pack_id, kind, slot, action, owner, measure, target_date, status, carried_from_id)
    select p_pack_id, 'previous', t.slot, t.action, t.owner, t.measure, t.target_date, 'open', t.id
      from public.review_targets t
     where t.pack_id = v_prev_pack and t.kind = 'new' and t.action is not null
    on conflict (pack_id, kind, slot) do nothing;
  end if;
  perform public.review_pack_record(p_pack_id, 'released', 'with_tutor', p_source, p_system, now(),
    jsonb_build_object('tutor_id', v_tutor, 'planned_on', v_rev.planned_on, 'note', nullif(btrim(p_note), '')));
end;
$$;

create or replace function public.release_review_to_tutor(p_pack_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  perform public.review_pack_release_core(p_pack_id, 'user', false, p_note);
end;
$$;

create or replace function public.submit_review_paper_form(p_pack_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pack public.review_packs%rowtype;
  v_note text := nullif(btrim(p_note), '');
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if v_pack.stage <> 'with_tutor' then
    raise exception 'Only a pack that is with the tutor can have its paper form recorded back (this one is %)', v_pack.stage using errcode = '23514';
  end if;
  update public.review_tutor_forms
     set submitted_at = now(), submitted_by = v_uid, entry_method = 'paper'
   where pack_id = p_pack_id;
  perform public.review_pack_record(p_pack_id, 'submitted', 'to_book', 'user', false, now(),
    jsonb_build_object('on_paper', true, 'note', v_note));
  perform public.review_pack_sync_booking(v_pack.review_id);
end;
$$;

revoke all on function public.review_pack_release_core(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.review_pack_release_core(uuid, text, boolean, text) to service_role;
revoke all on function public.release_review_to_tutor(uuid, text) from public, anon;
grant execute on function public.release_review_to_tutor(uuid, text) to authenticated, service_role;
revoke all on function public.submit_review_paper_form(uuid, text) from public, anon;
grant execute on function public.submit_review_paper_form(uuid, text) to authenticated, service_role;
