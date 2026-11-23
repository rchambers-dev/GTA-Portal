-- A waiting pack has never been released, so learner_snapshot, snapshot_at and tutor_id are null.
-- Moving it to to_book fails review_packs_snapshot_once_released and review_packs_tutor_once_released
-- unless those fields are filled first.
--
-- This is not a release. No 'released' event is written and review_pack_release_core is not called,
-- so analytics still treat the return as sent_known false.
-- The tutor, snapshot and previous-cycle targets are copied the same way a daily release copies them.
-- Undo is unchanged: with no released event it sends the pack back to waiting. Waiting may keep
-- a tutor and a snapshot, so the existing constraints still hold.

create or replace function public.record_paper_review_return(p_pack_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pack public.review_packs%rowtype;
  v_tutor uuid;
  v_prev_pack uuid;
  v_sent boolean;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if v_pack.stage not in ('waiting', 'with_tutor') then
    raise exception 'Only a waiting review, or one still with the tutor, can be marked received (this one is %)', v_pack.stage using errcode = '23514';
  end if;
  v_sent := v_pack.stage = 'with_tutor';
  if v_pack.stage = 'waiting' then
    select t.tutor_id into v_tutor
      from public.apprentice_tutors t
     where t.apprentice_id = v_pack.gta_id and t.end_date is null;
    if v_tutor is null then
      raise exception 'Apprentice % has no current tutor, so this review cannot be marked received', v_pack.gta_id using errcode = '23514';
    end if;
    update public.review_packs
       set tutor_id = v_tutor,
           learner_snapshot = public.review_pack_snapshot(v_pack.review_id),
           snapshot_at = now()
     where id = p_pack_id;
    select p.id into v_prev_pack
      from public.review_packs p
      join public.reviews r on r.id = p.review_id
     where p.gta_id = v_pack.gta_id and r.status = 'completed' and p.stage = 'completed'
     order by r.actual_on desc
     limit 1;
    if v_prev_pack is not null then
      insert into public.review_targets (pack_id, kind, slot, action, owner, measure, target_date, status, carried_from_id)
      select p_pack_id, 'previous', t.slot, t.action, t.owner, t.measure, t.target_date, 'open', t.id
        from public.review_targets t
       where t.pack_id = v_prev_pack and t.kind = 'new' and t.action is not null
      on conflict (pack_id, kind, slot) do nothing;
    end if;
  end if;
  insert into public.review_tutor_forms (pack_id) values (p_pack_id) on conflict (pack_id) do nothing;
  insert into public.review_progress_rows (pack_id, area)
  select p_pack_id, a.area
  from unnest(array['overall_progress','knowledge_theory','practical_skills','behaviours_attendance','english_maths','off_the_job','epa_gateway']) as a(area)
  on conflict (pack_id, area) do nothing;
  update public.review_tutor_forms
     set submitted_at = now(), submitted_by = v_uid, entry_method = 'paper'
   where pack_id = p_pack_id;
  perform public.review_pack_record(
    p_pack_id, 'submitted', 'to_book', 'user', false, now(),
    jsonb_build_object('on_paper', true, 'sent_known', v_sent, 'return_method', 'paper')
  );
  perform public.review_pack_sync_booking(v_pack.review_id);
end;
$$;

revoke all on function public.record_paper_review_return(uuid) from public, anon;
grant execute on function public.record_paper_review_return(uuid) to authenticated, service_role;
