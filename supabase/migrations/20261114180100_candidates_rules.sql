-- Candidates business rules. NOT APPLIED. Runs after 20261114180000_candidates_onboarding.sql.

create or replace function public.candidate_review_due(p_first_contact date, p_responsiveness text)
returns date
language sql
immutable
as $$
  select (p_first_contact + make_interval(months => case when p_responsiveness = 'unresponsive' then 3 else 12 end))::date;
$$;

create or replace function public.candidate_bump_counter(
  p_year integer, p_centre text, p_programme uuid, p_measure text
) returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.candidate_aggregate_counters (year, centre_code, programme_id, measure, total)
  values (p_year, p_centre, p_programme, p_measure, 1)
  on conflict (year, centre_code, programme_id, measure)
  do update set total = public.candidate_aggregate_counters.total + 1, updated_at = now();
end;
$$;

create or replace function public.book_interview_attempt(
  p_candidate_id text, p_session_id uuid, p_frees_on_cancel boolean default false
) returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_session public.interview_sessions%rowtype;
  v_used integer;
  v_failures integer;
  v_third date;
  v_final boolean;
  v_attempt integer;
  v_id uuid;
begin
  if not public.candidates_staff_write() then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_session from public.interview_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Interview session not found' using errcode = 'P0002';
  end if;
  if v_session.kind = 'group' then
    if extract(isodow from v_session.session_on) <> 1 then
      raise exception 'Group interviews are on Mondays' using errcode = '23514';
    end if;
    if exists (select 1 from public.candidate_bank_holidays h where h.holiday_on = v_session.session_on) then
      raise exception 'That Monday is a bank holiday' using errcode = '23514';
    end if;
  end if;
  select count(*) into v_used
  from public.interview_bookings b
  where b.session_id = p_session_id
    and not (b.attendance in ('cancelled', 'rescheduled') and b.frees_place);
  if v_used >= v_session.capacity then
    raise exception 'This session is full' using errcode = '23514';
  end if;
  select count(*) into v_failures
  from public.interview_bookings b
  where b.candidate_id = p_candidate_id and b.outcome = 'failed';
  if exists (
    select 1 from public.interview_bookings b
    where b.candidate_id = p_candidate_id and b.is_final_attempt and b.outcome <> 'awaiting'
  ) then
    raise exception 'The final attempt has already been used' using errcode = '23514';
  end if;
  if v_failures >= 3 then
    select max(b.actual_on) into v_third
    from public.interview_bookings b
    where b.candidate_id = p_candidate_id and b.outcome = 'failed';
    if v_third is null or v_session.session_on < (v_third + interval '6 months')::date then
      raise exception 'A final attempt is only available 6 months after the third failure' using errcode = '23514';
    end if;
    v_attempt := 4;
    v_final := true;
  else
    v_attempt := v_failures + 1;
    v_final := false;
  end if;
  insert into public.interview_bookings
    (candidate_id, session_id, attempt_number, is_final_attempt, frees_place, entered_by)
  values (p_candidate_id, p_session_id, v_attempt, v_final, p_frees_on_cancel, v_uid)
  returning id into v_id;
  insert into public.candidate_events (candidate_id, event_type, actual_on, entered_by, detail)
  values (p_candidate_id, 'interview_booked', v_session.session_on, v_uid,
          jsonb_build_object('session_id', p_session_id, 'attempt', v_attempt, 'final', v_final));
  return v_id;
end;
$$;

create or replace function public.allocate_vacancy_place(p_vacancy_id uuid, p_candidate_id text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_vacancy public.employer_vacancies%rowtype;
  v_candidate public.candidates%rowtype;
  v_taken integer;
  v_id uuid;
begin
  if not public.candidates_staff_write() then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_vacancy from public.employer_vacancies where id = p_vacancy_id for update;
  if not found then
    raise exception 'Vacancy not found' using errcode = 'P0002';
  end if;
  if v_vacancy.status not in ('potential', 'open') then
    raise exception 'This vacancy is not open' using errcode = '23514';
  end if;
  select * into v_candidate from public.candidates where candidate_id = p_candidate_id for update;
  if not found then
    raise exception 'Candidate not found' using errcode = 'P0002';
  end if;
  if v_candidate.employer_status is distinct from 'confirmed' or v_candidate.stage2_approved_at is null then
    raise exception 'Stage 2 stays locked until the employer is confirmed and Anne-Marie has approved' using errcode = '23514';
  end if;
  select count(*) into v_taken from public.vacancy_allocations
   where vacancy_id = p_vacancy_id and released_at is null;
  if v_taken >= v_vacancy.total_places then
    raise exception 'That would over-allocate this vacancy' using errcode = '23514';
  end if;
  insert into public.vacancy_allocations (vacancy_id, candidate_id, allocated_by)
  values (p_vacancy_id, p_candidate_id, v_uid)
  returning id into v_id;
  insert into public.candidate_events (candidate_id, event_type, actual_on, entered_by, detail)
  values (p_candidate_id, 'allocated', (now() at time zone 'Europe/London')::date, v_uid,
          jsonb_build_object('vacancy_id', p_vacancy_id));
  return v_id;
end;
$$;

create or replace function public.confirm_induction_attendance(p_booking_id uuid, p_actual_on date)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_booking public.induction_bookings%rowtype;
  v_candidate public.candidates%rowtype;
  v_gta text;
  v_centre text;
begin
  if not public.candidates_staff_write() then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_booking from public.induction_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Induction booking not found' using errcode = 'P0002';
  end if;
  select * into v_candidate from public.candidates where candidate_id = v_booking.candidate_id for update;
  if v_candidate.actual_start_on is not null then
    raise exception 'A start is counted only once' using errcode = '23514';
  end if;
  select 'GTA-' || lpad((coalesce(max(substring(gta_id from 5)::int), 0) + 1)::text, 6, '0')
    into v_gta
  from public.apprentices
  where gta_id ~ '^GTA-[0-9]{6}$';
  insert into public.apprentices (gta_id, first_name, middle_names, last_name, email, programme_id, status)
  values (v_gta, v_candidate.first_name, v_candidate.middle_names, v_candidate.last_name, v_candidate.email, v_candidate.programme_id, 'active');
  if v_candidate.employer_id is not null
     and v_candidate.employer_site_id is not null
     and v_candidate.employer_manager_id is not null then
    insert into public.apprentice_employments (gta_id, employer_id, site_id, manager_id, start_date)
    values (v_gta, v_candidate.employer_id, v_candidate.employer_site_id, v_candidate.employer_manager_id, p_actual_on);
  end if;
  update public.induction_bookings
     set attendance = 'attended', actual_on = p_actual_on, entered_at = now(), entered_by = v_uid
   where id = p_booking_id;
  update public.candidates
     set status = 'converted', actual_start_on = p_actual_on, converted_gta_id = v_gta, updated_at = now()
   where candidate_id = v_candidate.candidate_id;
  select code into v_centre from public.candidate_centres where id = v_candidate.centre_id;
  perform public.candidate_bump_counter(extract(year from p_actual_on)::int, v_centre, v_candidate.programme_id, 'starts');
  insert into public.candidate_events (candidate_id, event_type, actual_on, entered_by, detail)
  values (v_candidate.candidate_id, 'started', p_actual_on, v_uid, jsonb_build_object('gta_id', v_gta));
  return v_gta;
end;
$$;

create or replace function public.delete_candidate_personal_data(p_candidate_id text, p_confirmed_name text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
begin
  if not public.candidates_staff_write() then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select btrim(first_name || ' ' || last_name) into v_name
  from public.candidates where candidate_id = p_candidate_id;
  if v_name is null then
    raise exception 'Candidate not found' using errcode = 'P0002';
  end if;
  if btrim(p_confirmed_name) is distinct from v_name then
    raise exception 'Type the candidate''s full name to confirm permanent deletion' using errcode = '22023';
  end if;
  insert into public.candidate_deletion_requests
    (candidate_id, candidate_name_confirmed, requested_by, approved_by, approved_at, completed_at, reason_note)
  values (p_candidate_id, v_name, v_uid, v_uid, now(), now(), 'Named confirm');
  delete from public.candidate_events where candidate_id = p_candidate_id;
  delete from public.candidate_check_results where candidate_id = p_candidate_id;
  update public.candidates
     set first_name = 'Removed',
         middle_names = null,
         last_name = 'Candidate',
         email = null,
         phone = null,
         notes = null,
         external_id = null,
         enquiry_source_detail = null,
         status = 'archived',
         updated_at = now()
   where candidate_id = p_candidate_id;
  update public.candidate_deletion_requests
     set candidate_name_confirmed = 'removed'
   where candidate_id = p_candidate_id and completed_at is not null;
end;
$$;

revoke all on function public.delete_candidate_personal_data(text, text) from public, anon;
grant execute on function public.delete_candidate_personal_data(text, text) to authenticated, service_role;

revoke all on function public.book_interview_attempt(text, uuid, boolean) from public, anon;
revoke all on function public.allocate_vacancy_place(uuid, text) from public, anon;
revoke all on function public.confirm_induction_attendance(uuid, date) from public, anon;
revoke all on function public.candidate_bump_counter(integer, text, uuid, text) from public, anon;
grant execute on function public.book_interview_attempt(text, uuid, boolean) to authenticated, service_role;
grant execute on function public.allocate_vacancy_place(uuid, text) to authenticated, service_role;
grant execute on function public.confirm_induction_attendance(uuid, date) to authenticated, service_role;
grant execute on function public.candidate_review_due(date, text) to authenticated, service_role;
