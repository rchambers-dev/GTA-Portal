-- Verifying a stop keeps its arrive and leave times, and clears any stop lock.
-- Undoing verify does not put a lock back.
-- Apply this in the SQL editor after review. Do not run it against production from a test.

create or replace function public.verify_review_day_stop(
  p_date date, p_gta_id text, p_verified boolean,
  p_arrive double precision default null, p_leave double precision default null,
  p_day_gta_ids text[] default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_ids text[];
  v_arrive double precision;
  v_leave double precision;
begin
  perform public.review_plan_require_writer();
  perform public.review_day_ensure(p_date);
  if p_verified then
    select s.arrive_minutes, s.leave_minutes into v_arrive, v_leave
      from public.review_day_stops s
     where s.date_on = p_date and s.gta_id = p_gta_id;
    v_arrive := coalesce(v_arrive, p_arrive);
    v_leave := coalesce(v_leave, p_leave);
    if v_arrive is null or v_leave is null then
      raise exception 'Verifying needs the stop''s arrive and leave times' using errcode = '22023';
    end if;
    v_ids := coalesce(p_day_gta_ids, '{}');
    if not (p_gta_id = any (v_ids)) then
      v_ids := v_ids || p_gta_id;
    end if;
    insert into public.review_day_stops (date_on, gta_id, pinned, sort_order)
    select p_date, i, true, (ord - 1)::int from unnest(v_ids) with ordinality t(i, ord)
    on conflict (date_on, gta_id) do update set pinned = true, excluded = false, sort_order = excluded.sort_order;
    update public.review_day_stops
       set verified = true, arrive_minutes = v_arrive, leave_minutes = v_leave
     where date_on = p_date and gta_id = p_gta_id;
    update public.review_day_stops
       set locked_until_minutes = null,
           lock_arrive_minutes = null,
           lock_leave_minutes = null,
           locked_at = null,
           lock_expires_at = null
     where gta_id = p_gta_id
       and locked_at is not null;
    insert into public.review_lock_clears (gta_id, cleared_at)
    values (p_gta_id, now())
    on conflict (gta_id) do update set cleared_at = excluded.cleared_at;
  else
    insert into public.review_day_stops (date_on, gta_id) values (p_date, p_gta_id)
    on conflict (date_on, gta_id) do update set verified = false;
  end if;
  perform public.review_plan_audit('review_day_stop', p_date::text || '/' || p_gta_id, case when p_verified then 'verified' else 'unverified' end,
    format('%s %s for %s', p_gta_id, case when p_verified then 'verified' else 'unverified' end, p_date),
    jsonb_build_object('date_on', p_date, 'gta_id', p_gta_id, 'arrive', coalesce(v_arrive, p_arrive), 'leave', coalesce(v_leave, p_leave)));
end;
$$;

-- One verified stop still has a lock. Clear it the same way, and record the clear.
do $$
declare
  v_gta text;
begin
  for v_gta in
    select distinct s.gta_id
      from public.review_day_stops s
     where s.verified and s.locked_at is not null
  loop
    update public.review_day_stops
       set locked_until_minutes = null,
           lock_arrive_minutes = null,
           lock_leave_minutes = null,
           locked_at = null,
           lock_expires_at = null
     where gta_id = v_gta
       and verified
       and locked_at is not null;
    insert into public.review_lock_clears (gta_id, cleared_at)
    values (v_gta, now())
    on conflict (gta_id) do update set cleared_at = excluded.cleared_at;
  end loop;
end;
$$;
