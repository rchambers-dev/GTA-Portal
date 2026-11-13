-- Book Appointment and Back To Queue run as one transaction.
-- A failure rolls back the exclude, so a learner cannot be left off the missed
-- day without the new booking (or the cleared booking).
-- Stop kind follows the booking method: in person -> visit, Teams -> teams, phone -> phone.
-- Apply this in the SQL editor at merge time, after 20261113103000_release_unverified_after_call_end.sql.
-- Do not run it against production from a test.

create or replace function public.rebook_review_appointment(
  p_review_id uuid,
  p_gta_id text,
  p_missed_date date,
  p_date date,
  p_method text,
  p_kind text,
  p_arrive double precision,
  p_leave double precision,
  p_gta_ids text[],
  p_back_to_queue boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_method text := coalesce(p_method, 'in_person');
  v_kind text := coalesce(p_kind, 'visit');
  v_ids text[] := coalesce(p_gta_ids, '{}');
  v_weekday text;
  v_sort integer;
begin
  if p_back_to_queue then
    perform public.exclude_review_day_stop(p_missed_date, p_gta_id);
    perform public.clear_review_booking(p_review_id);
    return;
  end if;

  if v_method not in ('in_person', 'teams', 'phone') then
    raise exception 'Method must be in_person, teams or phone' using errcode = '22023';
  end if;
  if v_method = 'teams' and v_kind <> 'teams'
     or v_method = 'phone' and v_kind <> 'phone'
     or v_method = 'in_person' and v_kind <> 'visit' then
    raise exception 'Stop kind must match the booking method' using errcode = '22023';
  end if;
  if p_date is null then
    raise exception 'A rebooked visit needs a day' using errcode = '22023';
  end if;
  if v_method = 'phone' then
    if p_arrive is not null or p_leave is not null then
      raise exception 'A phone review has no arrival time' using errcode = '22023';
    end if;
  elsif p_arrive is null or p_leave is null then
    raise exception 'Give both the arrival and leave times' using errcode = '22023';
  end if;

  perform public.exclude_review_day_stop(p_missed_date, p_gta_id);

  if v_method = 'phone' then
    v_weekday := (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])[extract(isodow from p_date)::int];
    perform public.book_review(p_review_id, 'phone', null, null, v_weekday);
    perform public.review_day_ensure(p_date);
    select coalesce(max(s.sort_order), -1) + 1 into v_sort
      from public.review_day_stops s
     where s.date_on = p_date and s.gta_id <> p_gta_id and not s.excluded;
    insert into public.review_day_stops (date_on, gta_id, kind, pinned, excluded, sort_order, arrive_minutes, leave_minutes)
    values (p_date, p_gta_id, 'phone', true, false, v_sort, null, null)
    on conflict (date_on, gta_id) do update
      set kind = 'phone', pinned = true, excluded = false, arrive_minutes = null, leave_minutes = null;
    perform public.review_plan_audit(
      'review_day_stop', p_date::text || '/' || p_gta_id, 'rebooked',
      format('%s rebooked by phone on %s', p_gta_id, p_date),
      jsonb_build_object('date_on', p_date, 'gta_id', p_gta_id, 'kind', 'phone', 'missed_date', p_missed_date)
    );
    return;
  end if;

  if (select count(*) from unnest(v_ids)) <> (select count(distinct i) from unnest(v_ids) i) then
    raise exception 'Each learner can be pinned once per day' using errcode = '22023';
  end if;
  if not (p_gta_id = any (v_ids)) then
    v_ids := v_ids || p_gta_id;
  end if;
  perform public.set_review_day_pins(p_date, v_ids);
  perform public.set_review_day_stop_times(p_date, p_gta_id, p_arrive, p_leave);
  update public.review_day_stops
     set kind = v_kind
   where date_on = p_date and gta_id = p_gta_id;
  perform public.book_review(p_review_id, v_method, p_date, round(p_arrive)::integer, null);
end;
$$;

revoke all on function public.rebook_review_appointment(uuid, text, date, date, text, text, double precision, double precision, text[], boolean) from public, anon;
grant execute on function public.rebook_review_appointment(uuid, text, date, date, text, text, double precision, double precision, text[], boolean) to authenticated, service_role;
