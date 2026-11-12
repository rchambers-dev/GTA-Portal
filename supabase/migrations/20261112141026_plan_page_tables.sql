-- Plan page tables, mirroring the Review Assistant's planner state (12 Nov 2026, approved by Reiss, pt156u).
-- Employer visit rules (learner.employer blockedDays / window) are NOT built: Reiss dropped them (0 learners had any set).
--
-- Where each Assistant field lives:
--   settings.*                      -> review_settings (one row)
--   analyticsSince                  -> review_settings.analytics_since
--   settings.workingDates           -> review_settings.working_dates
--   acceptedRoutes[date]            -> review_days (accepted, route totals, settings copy) + review_day_stops (accepted_* columns per stop)
--   completedRoutes[date].at / ids  -> review_days.completed_at + review_day_stops.completed
--   callAnchors[date]               -> review_days.call_anchor_minutes
--   pinnedRoutes[date] (ordered)    -> review_day_stops.pinned + sort_order
--   frozenTimes[date][id]           -> review_day_stops.arrive_minutes / leave_minutes
--   excludedFromDate[date]          -> review_day_stops.excluded
--   verifiedByDate[date]            -> review_day_stops.verified   (the ONE source of truth; review_bookings.verified_on is dropped)
--   awaitingReply[date][id]         -> review_day_stops.locked_until_minutes / lock_arrive_minutes / lock_leave_minutes / locked_at
--   awaitingClearedAt[id]           -> review_lock_clears (per learner, not per day, so it cannot live on a day row)
-- The counters Waiting / To book / Locked / Booked stay computed.

-- ===== review_settings: a single row
create table public.review_settings (
  id boolean primary key default true,
  skip_today boolean not null default true,
  office_postcode text not null default 'DN3 3DY',
  start_time time not null default '10:00',
  call_minutes integer not null default 60,
  lunch_start time not null default '13:00',
  lunch_minutes integer not null default 30,
  return_by time not null default '16:45',
  stay_minutes integer not null default 30,
  extra_emails text[] not null default '{}',
  hidden_tutor_ids uuid[] not null default '{}',
  out_enabled boolean not null default false,
  report_auto_email boolean not null default true,
  analytics_since date,
  working_dates date[] not null default '{}',
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_settings_single_row check (id),
  constraint review_settings_call_minutes check (call_minutes >= 0),
  constraint review_settings_stay_minutes check (stay_minutes > 0),
  constraint review_settings_lunch_minutes check (lunch_minutes > 0),
  constraint review_settings_postcode check (upper(regexp_replace(office_postcode, '\s', '', 'g')) ~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$')
);

-- The Assistant rewrites a stored 08:30 start to 09:00 (storage.js normaliseState).
create or replace function public.review_settings_normalise()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.start_time = time '08:30' then
    new.start_time := time '09:00';
  end if;
  new.office_postcode := regexp_replace(upper(regexp_replace(new.office_postcode, '\s', '', 'g')), '^(.*)([0-9][A-Z]{2})$', '\1 \2');
  return new;
end;
$$;
create trigger review_settings_normalise before insert or update on public.review_settings
  for each row execute function public.review_settings_normalise();
create trigger touch_review_settings_updated_at before update on public.review_settings
  for each row execute function public.touch_updated_at();

insert into public.review_settings (id) values (true);

-- ===== review_days: one row per date
create table public.review_days (
  date_on date primary key,
  accepted boolean not null default false,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  call_anchor_minutes integer,
  -- the day's settings, copied from review_settings when the route is accepted
  office_postcode text,
  start_time time,
  lunch_start time,
  lunch_minutes integer,
  return_by time,
  stay_minutes integer,
  call_minutes integer,
  -- the accepted route's own numbers (snapshotDay)
  route_start_minutes double precision,
  route_leave_minutes double precision,
  route_call_start_minutes double precision,
  route_call_end_minutes double precision,
  route_return_arrive_minutes double precision,
  route_return_travel_minutes double precision,
  route_drive_total_minutes double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_days_weekday check (extract(isodow from date_on) <= 5),
  constraint review_days_accepted_stamp check (accepted or (accepted_at is null and accepted_by is null)),
  constraint review_days_call_anchor check (call_anchor_minutes is null or call_anchor_minutes between 0 and 1439)
);
create trigger touch_review_days_updated_at before update on public.review_days
  for each row execute function public.touch_updated_at();
create index review_days_accepted_by_idx on public.review_days (accepted_by) where accepted_by is not null;
create index review_days_completed_by_idx on public.review_days (completed_by) where completed_by is not null;

-- ===== review_day_stops: one row per learner per day
create table public.review_day_stops (
  id uuid primary key default gen_random_uuid(),
  date_on date not null references public.review_days(date_on) on delete cascade,
  gta_id text not null references public.apprentices(gta_id),
  sort_order integer not null default 0,
  kind text not null default 'visit',
  pinned boolean not null default false,
  excluded boolean not null default false,
  verified boolean not null default false,
  completed boolean not null default false,
  arrive_minutes double precision,
  leave_minutes double precision,
  locked_until_minutes integer,
  lock_arrive_minutes double precision,
  lock_leave_minutes double precision,
  locked_at timestamptz,
  accepted boolean not null default false,
  accepted_arrive_minutes double precision,
  accepted_leave_minutes double precision,
  accepted_travel_minutes double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_day_stops_unique unique (date_on, gta_id),
  constraint review_day_stops_kind check (kind in ('visit','phone','teams')),
  constraint review_day_stops_excluded_exclusive check (not excluded or not (pinned or verified or accepted)),
  constraint review_day_stops_lock_consistent check ((locked_until_minutes is null) = (locked_at is null)
    and (locked_until_minutes is not null or (lock_arrive_minutes is null and lock_leave_minutes is null))),
  constraint review_day_stops_minutes check (
    coalesce(arrive_minutes, 0) >= 0 and coalesce(leave_minutes, 0) >= 0 and coalesce(lock_arrive_minutes, 0) >= 0
    and coalesce(lock_leave_minutes, 0) >= 0 and coalesce(accepted_arrive_minutes, 0) >= 0 and coalesce(accepted_leave_minutes, 0) >= 0
    and coalesce(accepted_travel_minutes, 0) >= 0 and coalesce(locked_until_minutes, 0) >= 0)
);
create index review_day_stops_gta_idx on public.review_day_stops (gta_id, date_on);
create trigger touch_review_day_stops_updated_at before update on public.review_day_stops
  for each row execute function public.touch_updated_at();

-- ===== review_lock_clears: awaitingClearedAt is per learner (clearing a lock clears it on every day)
create table public.review_lock_clears (
  gta_id text primary key references public.apprentices(gta_id),
  cleared_at timestamptz not null
);

-- ===== RLS: staff read, writes only through the audited functions
alter table public.review_settings enable row level security;
alter table public.review_days enable row level security;
alter table public.review_day_stops enable row level security;
alter table public.review_lock_clears enable row level security;
create policy review_settings_select_admin on public.review_settings for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));
create policy review_days_select_staff on public.review_days for select to authenticated
  using ((select public.has_portal_role('Administrator','Management','Tutor')));
create policy review_day_stops_select_staff on public.review_day_stops for select to authenticated
  using ((select public.has_portal_role('Administrator','Management','Tutor')));
create policy review_lock_clears_select_staff on public.review_lock_clears for select to authenticated
  using ((select public.has_portal_role('Administrator','Management','Tutor')));
revoke all on table public.review_settings, public.review_days, public.review_day_stops, public.review_lock_clears from public, anon, authenticated;
grant select on table public.review_settings, public.review_days, public.review_day_stops, public.review_lock_clears to authenticated;
grant select, insert, update, delete on table public.review_settings, public.review_days, public.review_day_stops, public.review_lock_clears to service_role;

-- ===== verified now lives in review_day_stops only: carry the two existing values across, then drop the old column and function
insert into public.review_days (date_on)
select distinct b.verified_on from public.review_bookings b where b.verified_on is not null on conflict do nothing;
insert into public.review_day_stops (date_on, gta_id, verified, pinned)
select b.verified_on, r.gta_id, true, true from public.review_bookings b join public.reviews r on r.id = b.review_id where b.verified_on is not null
on conflict (date_on, gta_id) do update set verified = true;
drop function public.set_review_verified(uuid, date);
alter table public.review_bookings drop column verified_on;

-- ===== internal helper
create or replace function public.review_day_ensure(p_date date)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_date is null then
    raise exception 'A date is required' using errcode = '22023';
  end if;
  if extract(isodow from p_date) > 5 then
    raise exception 'A visit day must be a weekday' using errcode = '23514';
  end if;
  insert into public.review_days (date_on) values (p_date) on conflict (date_on) do nothing;
end;
$$;

create or replace function public.review_plan_require_writer()
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.review_plan_audit(p_type text, p_id text, p_action text, p_summary text, p_payload jsonb)
returns void
language sql
security definer
set search_path to ''
as $$
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values ((select auth.uid()), p_type, p_id, p_action, p_summary, p_payload)
$$;

-- ===== settings
create or replace function public.update_review_settings(
  p_skip_today boolean default null,
  p_office_postcode text default null,
  p_start_time time default null,
  p_call_minutes integer default null,
  p_lunch_start time default null,
  p_lunch_minutes integer default null,
  p_return_by time default null,
  p_stay_minutes integer default null,
  p_extra_emails text[] default null,
  p_hidden_tutor_ids uuid[] default null,
  p_out_enabled boolean default null,
  p_report_auto_email boolean default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_old public.review_settings%rowtype;
  v_pc text;
  v_emails text[];
  v_hidden uuid[];
begin
  perform public.review_plan_require_writer();
  select * into v_old from public.review_settings where id for update;
  if p_office_postcode is not null then
    v_pc := upper(regexp_replace(p_office_postcode, '\s', '', 'g'));
    if v_pc !~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$' then
      raise exception 'Office postcode does not look valid' using errcode = '22023';
    end if;
  end if;
  if p_call_minutes is not null and p_call_minutes < 0 then
    raise exception 'Calls before start cannot be negative' using errcode = '22023';
  end if;
  if p_stay_minutes is not null and p_stay_minutes <= 0 then
    raise exception 'Stay must be more than 0 minutes' using errcode = '22023';
  end if;
  if p_lunch_minutes is not null and p_lunch_minutes <= 0 then
    raise exception 'Lunch must be more than 0 minutes' using errcode = '22023';
  end if;
  if p_extra_emails is not null then
    select coalesce(array_agg(e order by first_pos), '{}') into v_emails
      from (select btrim(x) e, min(ord) first_pos from unnest(p_extra_emails) with ordinality t(x, ord) where btrim(x) <> '' group by btrim(x)) s;
  end if;
  if p_hidden_tutor_ids is not null then
    select coalesce(array_agg(distinct i), '{}') into v_hidden from unnest(p_hidden_tutor_ids) i;
    if exists (select 1 from unnest(v_hidden) i where not exists (select 1 from public.profiles p where p.id = i)) then
      raise exception 'Hidden tutor is not a known profile' using errcode = '22023';
    end if;
  end if;
  update public.review_settings set
    skip_today = coalesce(p_skip_today, skip_today),
    office_postcode = coalesce(p_office_postcode, office_postcode),
    start_time = coalesce(p_start_time, start_time),
    call_minutes = coalesce(p_call_minutes, call_minutes),
    lunch_start = coalesce(p_lunch_start, lunch_start),
    lunch_minutes = coalesce(p_lunch_minutes, lunch_minutes),
    return_by = coalesce(p_return_by, return_by),
    stay_minutes = coalesce(p_stay_minutes, stay_minutes),
    extra_emails = coalesce(v_emails, extra_emails),
    hidden_tutor_ids = coalesce(v_hidden, hidden_tutor_ids),
    out_enabled = coalesce(p_out_enabled, out_enabled),
    report_auto_email = coalesce(p_report_auto_email, report_auto_email),
    updated_by = (select auth.uid())
  where id;
  perform public.review_plan_audit('review_settings', 'default', 'updated', 'Plan and Out settings updated',
    jsonb_build_object('skip_today', p_skip_today, 'office_postcode', p_office_postcode, 'start_time', p_start_time,
      'call_minutes', p_call_minutes, 'lunch_start', p_lunch_start, 'lunch_minutes', p_lunch_minutes, 'return_by', p_return_by,
      'stay_minutes', p_stay_minutes, 'extra_emails_changed', p_extra_emails is not null, 'hidden_tutor_ids', v_hidden,
      'out_enabled', p_out_enabled, 'report_auto_email', p_report_auto_email));
end;
$$;

create or replace function public.set_review_working_dates(p_dates date[])
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_today date := (now() at time zone 'Europe/London')::date;
  v_dates date[];
begin
  perform public.review_plan_require_writer();
  if exists (select 1 from unnest(coalesce(p_dates, '{}')) d where extract(isodow from d) > 5) then
    raise exception 'Planning days must be weekdays' using errcode = '23514';
  end if;
  -- past dates are dropped, as the Assistant does on load
  select coalesce(array_agg(distinct d order by d), '{}') into v_dates from unnest(coalesce(p_dates, '{}')) d where d >= v_today;
  update public.review_settings set working_dates = v_dates, updated_by = (select auth.uid()) where id;
  perform public.review_plan_audit('review_settings', 'default', 'working_dates_set', 'Planning days set', jsonb_build_object('working_dates', v_dates));
end;
$$;

create or replace function public.set_review_analytics_since(p_date date)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.review_plan_require_writer();
  update public.review_settings set analytics_since = p_date, updated_by = (select auth.uid()) where id;
  perform public.review_plan_audit('review_settings', 'default', 'analytics_since_set', 'Analytics start date set', jsonb_build_object('analytics_since', p_date));
end;
$$;

-- Tutors read the settings through here; the extra email addresses are hidden from them.
create or replace function public.get_review_settings()
returns table (id boolean, skip_today boolean, office_postcode text, start_time time, call_minutes integer, lunch_start time,
  lunch_minutes integer, return_by time, stay_minutes integer, extra_emails text[], hidden_tutor_ids uuid[], out_enabled boolean,
  report_auto_email boolean, analytics_since date, working_dates date[], updated_at timestamptz)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_full boolean;
begin
  if not public.has_portal_role('Administrator','Management','Tutor') then
    raise exception 'Staff role required' using errcode = '42501';
  end if;
  v_full := public.has_portal_role('Administrator','Management');
  return query
    select s.id, s.skip_today, s.office_postcode, s.start_time, s.call_minutes, s.lunch_start, s.lunch_minutes, s.return_by,
           s.stay_minutes, case when v_full then s.extra_emails else '{}'::text[] end, s.hidden_tutor_ids, s.out_enabled,
           s.report_auto_email, s.analytics_since, s.working_dates, s.updated_at
    from public.review_settings s;
end;
$$;

-- ===== day-level
create or replace function public.set_review_call_anchor(p_date date, p_minutes integer)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.review_plan_require_writer();
  if p_minutes is not null and (p_minutes < 0 or p_minutes > 1439) then
    raise exception 'Call anchor must be minutes from midnight (0 to 1439)' using errcode = '22023';
  end if;
  perform public.review_day_ensure(p_date);
  update public.review_days set call_anchor_minutes = p_minutes where date_on = p_date;
  perform public.review_plan_audit('review_day', p_date::text, 'call_anchor_set', format('Call anchor for %s set', p_date), jsonb_build_object('date_on', p_date, 'minutes', p_minutes));
end;
$$;

-- Pin the people on a day, in route order (pinnedRoutes[date] = ordered list). Anyone else on the day is unpinned.
create or replace function public.set_review_day_pins(p_date date, p_gta_ids text[])
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_ids text[] := coalesce(p_gta_ids, '{}');
begin
  perform public.review_plan_require_writer();
  if (select count(*) from unnest(v_ids)) <> (select count(distinct i) from unnest(v_ids) i) then
    raise exception 'Each learner can be pinned once per day' using errcode = '22023';
  end if;
  perform public.review_day_ensure(p_date);
  update public.review_day_stops set pinned = false where date_on = p_date and pinned and gta_id <> all (v_ids);
  insert into public.review_day_stops (date_on, gta_id, pinned, sort_order)
  select p_date, i, true, (ord - 1)::int from unnest(v_ids) with ordinality t(i, ord)
  on conflict (date_on, gta_id) do update set pinned = true, excluded = false, sort_order = excluded.sort_order;
  perform public.review_plan_audit('review_day', p_date::text, 'pins_set', format('Pinned %s learner(s) on %s', cardinality(v_ids), p_date),
    jsonb_build_object('date_on', p_date, 'gta_ids', v_ids));
end;
$$;

-- Take a learner off a day (detachLearnerFromDay): unpin, unverify, drop kept times and the accepted slot, clear their lock everywhere, mark excluded.
create or replace function public.exclude_review_day_stop(p_date date, p_gta_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.review_plan_require_writer();
  perform public.review_day_ensure(p_date);
  update public.review_day_stops set locked_until_minutes = null, lock_arrive_minutes = null, lock_leave_minutes = null, locked_at = null
   where gta_id = p_gta_id and locked_at is not null;
  insert into public.review_lock_clears (gta_id, cleared_at) values (p_gta_id, now())
    on conflict (gta_id) do update set cleared_at = excluded.cleared_at;
  insert into public.review_day_stops (date_on, gta_id, excluded, sort_order)
  values (p_date, p_gta_id, true, 0)
  on conflict (date_on, gta_id) do update set
    excluded = true, pinned = false, verified = false, accepted = false, arrive_minutes = null, leave_minutes = null,
    accepted_arrive_minutes = null, accepted_leave_minutes = null, accepted_travel_minutes = null;
  perform public.review_plan_audit('review_day_stop', p_date::text || '/' || p_gta_id, 'excluded',
    format('%s taken off %s', p_gta_id, p_date), jsonb_build_object('date_on', p_date, 'gta_id', p_gta_id));
end;
$$;

create or replace function public.include_review_day_stop(p_date date, p_gta_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.review_plan_require_writer();
  update public.review_day_stops set excluded = false where date_on = p_date and gta_id = p_gta_id and excluded;
  if found then
    perform public.review_plan_audit('review_day_stop', p_date::text || '/' || p_gta_id, 'included',
      format('%s allowed back on %s', p_gta_id, p_date), jsonb_build_object('date_on', p_date, 'gta_id', p_gta_id));
  end if;
end;
$$;

-- Kept (manual) times for a stop (frozenTimes). Nulls clear them.
create or replace function public.set_review_day_stop_times(p_date date, p_gta_id text, p_arrive double precision, p_leave double precision)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.review_plan_require_writer();
  if (p_arrive is null) <> (p_leave is null) then
    raise exception 'Give both arrive and leave, or neither' using errcode = '22023';
  end if;
  perform public.review_day_ensure(p_date);
  insert into public.review_day_stops (date_on, gta_id, arrive_minutes, leave_minutes)
  values (p_date, p_gta_id, p_arrive, p_leave)
  on conflict (date_on, gta_id) do update set arrive_minutes = excluded.arrive_minutes, leave_minutes = excluded.leave_minutes;
  perform public.review_plan_audit('review_day_stop', p_date::text || '/' || p_gta_id, 'times_set',
    format('Times for %s on %s set', p_gta_id, p_date), jsonb_build_object('date_on', p_date, 'gta_id', p_gta_id, 'arrive', p_arrive, 'leave', p_leave));
end;
$$;

-- Verify / un-verify (toggleVerify). Verifying keeps the stop's times and pins it (and the others shown on the day, in order).
-- Un-verifying drops the kept times.
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
begin
  perform public.review_plan_require_writer();
  perform public.review_day_ensure(p_date);
  if p_verified then
    if p_arrive is null or p_leave is null then
      raise exception 'Verifying needs the stop''s arrive and leave times' using errcode = '22023';
    end if;
    v_ids := coalesce(p_day_gta_ids, '{}');
    if not (p_gta_id = any (v_ids)) then
      v_ids := v_ids || p_gta_id;
    end if;
    insert into public.review_day_stops (date_on, gta_id, pinned, sort_order)
    select p_date, i, true, (ord - 1)::int from unnest(v_ids) with ordinality t(i, ord)
    on conflict (date_on, gta_id) do update set pinned = true, excluded = false, sort_order = excluded.sort_order;
    update public.review_day_stops set verified = true, arrive_minutes = p_arrive, leave_minutes = p_leave
     where date_on = p_date and gta_id = p_gta_id;
  else
    insert into public.review_day_stops (date_on, gta_id) values (p_date, p_gta_id)
    on conflict (date_on, gta_id) do update set verified = false, arrive_minutes = null, leave_minutes = null;
  end if;
  perform public.review_plan_audit('review_day_stop', p_date::text || '/' || p_gta_id, case when p_verified then 'verified' else 'unverified' end,
    format('%s %s for %s', p_gta_id, case when p_verified then 'verified' else 'unverified' end, p_date),
    jsonb_build_object('date_on', p_date, 'gta_id', p_gta_id, 'arrive', p_arrive, 'leave', p_leave));
end;
$$;

-- Lock a learner's slot while waiting for a reply (toggleAwaitingReply). Default hold until 23:45 (1425).
create or replace function public.lock_review_day_stop(p_date date, p_gta_id text, p_arrive double precision, p_leave double precision, p_until_minutes integer default 1425)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.review_plan_require_writer();
  if p_until_minutes is null or p_until_minutes < 0 or p_until_minutes > 1439 then
    raise exception 'Hold time must be minutes from midnight (0 to 1439)' using errcode = '22023';
  end if;
  perform public.review_day_ensure(p_date);
  delete from public.review_lock_clears where gta_id = p_gta_id;
  insert into public.review_day_stops (date_on, gta_id, locked_until_minutes, lock_arrive_minutes, lock_leave_minutes, locked_at)
  values (p_date, p_gta_id, p_until_minutes, p_arrive, p_leave, now())
  on conflict (date_on, gta_id) do update set
    locked_until_minutes = excluded.locked_until_minutes,
    lock_arrive_minutes = coalesce(excluded.lock_arrive_minutes, public.review_day_stops.lock_arrive_minutes),
    lock_leave_minutes = coalesce(excluded.lock_leave_minutes, public.review_day_stops.lock_leave_minutes),
    locked_at = coalesce(public.review_day_stops.locked_at, excluded.locked_at);
  perform public.review_plan_audit('review_day_stop', p_date::text || '/' || p_gta_id, 'locked',
    format('%s locked on %s until %s min', p_gta_id, p_date, p_until_minutes),
    jsonb_build_object('date_on', p_date, 'gta_id', p_gta_id, 'until_minutes', p_until_minutes, 'arrive', p_arrive, 'leave', p_leave));
end;
$$;

-- Unlock (clearAwaitingForLearner): clears the learner's lock on every day and stamps when.
create or replace function public.unlock_review_day_stop(p_gta_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.review_plan_require_writer();
  update public.review_day_stops set locked_until_minutes = null, lock_arrive_minutes = null, lock_leave_minutes = null, locked_at = null
   where gta_id = p_gta_id and locked_at is not null;
  insert into public.review_lock_clears (gta_id, cleared_at) values (p_gta_id, now())
    on conflict (gta_id) do update set cleared_at = excluded.cleared_at;
  perform public.review_plan_audit('review_day_stop', p_gta_id, 'unlocked', format('%s unlocked', p_gta_id), jsonb_build_object('gta_id', p_gta_id));
end;
$$;

-- Accept a day's route (acceptDay + snapshotDay). p_route:
--   { start_minutes, leave_minutes, call_start_minutes, call_end_minutes, return_arrive_minutes, return_travel_minutes, drive_total_minutes,
--     stops: [ { gta_id, kind, arrive, leave, travel_minutes } ] }   (kind visit / phone / teams)
-- Every stop must be verified, have a visit booked for that day, or hold an active lock (stopIsValidated).
create or replace function public.accept_review_day(p_date date, p_route jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/London')::date;
  v_now_min integer := (extract(hour from (now() at time zone 'Europe/London')) * 60 + extract(minute from (now() at time zone 'Europe/London')))::int;
  v_set public.review_settings%rowtype;
  v_stop jsonb;
  v_gta text;
  v_kind text;
  v_ord integer := 0;
  v_ids text[] := '{}';
  v_ok boolean;
begin
  perform public.review_plan_require_writer();
  if p_route is null or jsonb_typeof(p_route -> 'stops') <> 'array' or jsonb_array_length(p_route -> 'stops') = 0 then
    raise exception 'A route needs at least one stop' using errcode = '22023';
  end if;
  perform public.review_day_ensure(p_date);
  for v_stop in select * from jsonb_array_elements(p_route -> 'stops') loop
    v_gta := v_stop ->> 'gta_id';
    v_kind := coalesce(v_stop ->> 'kind', 'visit');
    if v_gta is null or v_kind not in ('visit','phone','teams') then
      raise exception 'Each stop needs a gta_id and a kind of visit, phone or teams' using errcode = '22023';
    end if;
    if v_gta = any (v_ids) then
      raise exception 'Learner % appears twice in the route', v_gta using errcode = '22023';
    end if;
    v_ids := v_ids || v_gta;
    select exists (
      select 1 from public.review_day_stops s where s.date_on = p_date and s.gta_id = v_gta and s.verified
      union all
      select 1 from public.review_bookings b join public.reviews r on r.id = b.review_id
       where r.gta_id = v_gta and r.status = 'open' and b.appointment_on = p_date
      union all
      select 1 from public.review_day_stops s where s.date_on = p_date and s.gta_id = v_gta and s.locked_at is not null
         and (p_date > v_today or (p_date = v_today and v_now_min < s.locked_until_minutes))
    ) into v_ok;
    if not v_ok then
      raise exception 'Verify every learner on this day before accepting the route, unless they already have a booked time or are locked (%)', v_gta using errcode = '23514';
    end if;
  end loop;
  select * into v_set from public.review_settings where id;
  -- reset any earlier accepted slots on this day, then write the new ones
  update public.review_day_stops set accepted = false, accepted_arrive_minutes = null, accepted_leave_minutes = null, accepted_travel_minutes = null
   where date_on = p_date and accepted;
  for v_stop in select * from jsonb_array_elements(p_route -> 'stops') loop
    v_ord := v_ord + 1;
    insert into public.review_day_stops (date_on, gta_id, sort_order, kind, pinned, accepted, accepted_arrive_minutes, accepted_leave_minutes, accepted_travel_minutes)
    values (p_date, v_stop ->> 'gta_id', v_ord - 1, coalesce(v_stop ->> 'kind', 'visit'), true, true,
            (v_stop ->> 'arrive')::double precision, (v_stop ->> 'leave')::double precision, (v_stop ->> 'travel_minutes')::double precision)
    on conflict (date_on, gta_id) do update set
      sort_order = excluded.sort_order, kind = excluded.kind, pinned = true, excluded = false, accepted = true,
      accepted_arrive_minutes = excluded.accepted_arrive_minutes, accepted_leave_minutes = excluded.accepted_leave_minutes,
      accepted_travel_minutes = excluded.accepted_travel_minutes;
  end loop;
  update public.review_days set
    accepted = true, accepted_at = now(), accepted_by = v_uid,
    office_postcode = v_set.office_postcode, start_time = v_set.start_time, lunch_start = v_set.lunch_start, lunch_minutes = v_set.lunch_minutes,
    return_by = v_set.return_by, stay_minutes = v_set.stay_minutes, call_minutes = v_set.call_minutes,
    route_start_minutes = (p_route ->> 'start_minutes')::double precision, route_leave_minutes = (p_route ->> 'leave_minutes')::double precision,
    route_call_start_minutes = (p_route ->> 'call_start_minutes')::double precision, route_call_end_minutes = (p_route ->> 'call_end_minutes')::double precision,
    route_return_arrive_minutes = (p_route ->> 'return_arrive_minutes')::double precision,
    route_return_travel_minutes = (p_route ->> 'return_travel_minutes')::double precision,
    route_drive_total_minutes = (p_route ->> 'drive_total_minutes')::double precision
  where date_on = p_date;
  perform public.review_plan_audit('review_day', p_date::text, 'accepted', format('Route for %s accepted with %s stop(s)', p_date, cardinality(v_ids)),
    jsonb_build_object('date_on', p_date, 'gta_ids', v_ids));
end;
$$;

-- Unlock a day (unlockDay): the accepted route is dropped; pins, verifications and times stay.
create or replace function public.unlock_review_day(p_date date)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.review_plan_require_writer();
  if not exists (select 1 from public.review_days where date_on = p_date and accepted) then
    return;
  end if;
  update public.review_day_stops set accepted = false, accepted_arrive_minutes = null, accepted_leave_minutes = null, accepted_travel_minutes = null
   where date_on = p_date and accepted;
  update public.review_days set accepted = false, accepted_at = null, accepted_by = null,
    office_postcode = null, start_time = null, lunch_start = null, lunch_minutes = null, return_by = null, stay_minutes = null, call_minutes = null,
    route_start_minutes = null, route_leave_minutes = null, route_call_start_minutes = null, route_call_end_minutes = null,
    route_return_arrive_minutes = null, route_return_travel_minutes = null, route_drive_total_minutes = null
   where date_on = p_date;
  perform public.review_plan_audit('review_day', p_date::text, 'unlocked', format('Route for %s unlocked', p_date), jsonb_build_object('date_on', p_date));
end;
$$;

-- Mark learners' reviews done on a day (markRouteCompleted + recordReview): each must have an open review, which is completed on that date
-- with the booked method (in person if none) and the next one opened, exactly as complete_review does. The day keeps the first completed_at.
create or replace function public.complete_review_day(p_date date, p_gta_ids text[])
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ids text[] := coalesce(p_gta_ids, '{}');
  v_id text;
  v_rev uuid;
begin
  perform public.review_plan_require_writer();
  if cardinality(v_ids) = 0 then
    raise exception 'Pick at least one learner' using errcode = '22023';
  end if;
  if p_date > (now() at time zone 'Europe/London')::date then
    raise exception 'A future day cannot be completed' using errcode = '23514';
  end if;
  perform public.review_day_ensure(p_date);
  foreach v_id in array v_ids loop
    select r.id into v_rev from public.reviews r where r.gta_id = v_id and r.status = 'open';
    if v_rev is null then
      raise exception 'Learner % has no open review to complete', v_id using errcode = 'P0002';
    end if;
    perform public.complete_review(v_rev, p_date);
    insert into public.review_day_stops (date_on, gta_id, completed) values (p_date, v_id, true)
    on conflict (date_on, gta_id) do update set completed = true;
  end loop;
  update public.review_days set completed_at = coalesce(completed_at, now()), completed_by = coalesce(completed_by, v_uid) where date_on = p_date;
  perform public.review_plan_audit('review_day', p_date::text, 'completed', format('%s learner(s) completed on %s', cardinality(v_ids), p_date),
    jsonb_build_object('date_on', p_date, 'gta_ids', v_ids));
end;
$$;

-- ===== grants
revoke all on function public.review_settings_normalise() from public, anon, authenticated;
revoke all on function public.review_day_ensure(date) from public, anon, authenticated;
revoke all on function public.review_plan_require_writer() from public, anon, authenticated;
revoke all on function public.review_plan_audit(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.review_day_ensure(date) to service_role;
grant execute on function public.review_plan_require_writer() to service_role;
grant execute on function public.review_plan_audit(text, text, text, text, jsonb) to service_role;

revoke all on function public.update_review_settings(boolean, text, time, integer, time, integer, time, integer, text[], uuid[], boolean, boolean) from public, anon;
revoke all on function public.set_review_working_dates(date[]) from public, anon;
revoke all on function public.set_review_analytics_since(date) from public, anon;
revoke all on function public.get_review_settings() from public, anon;
revoke all on function public.set_review_call_anchor(date, integer) from public, anon;
revoke all on function public.set_review_day_pins(date, text[]) from public, anon;
revoke all on function public.exclude_review_day_stop(date, text) from public, anon;
revoke all on function public.include_review_day_stop(date, text) from public, anon;
revoke all on function public.set_review_day_stop_times(date, text, double precision, double precision) from public, anon;
revoke all on function public.verify_review_day_stop(date, text, boolean, double precision, double precision, text[]) from public, anon;
revoke all on function public.lock_review_day_stop(date, text, double precision, double precision, integer) from public, anon;
revoke all on function public.unlock_review_day_stop(text) from public, anon;
revoke all on function public.accept_review_day(date, jsonb) from public, anon;
revoke all on function public.unlock_review_day(date) from public, anon;
revoke all on function public.complete_review_day(date, text[]) from public, anon;
grant execute on function public.update_review_settings(boolean, text, time, integer, time, integer, time, integer, text[], uuid[], boolean, boolean) to authenticated, service_role;
grant execute on function public.set_review_working_dates(date[]) to authenticated, service_role;
grant execute on function public.set_review_analytics_since(date) to authenticated, service_role;
grant execute on function public.get_review_settings() to authenticated, service_role;
grant execute on function public.set_review_call_anchor(date, integer) to authenticated, service_role;
grant execute on function public.set_review_day_pins(date, text[]) to authenticated, service_role;
grant execute on function public.exclude_review_day_stop(date, text) to authenticated, service_role;
grant execute on function public.include_review_day_stop(date, text) to authenticated, service_role;
grant execute on function public.set_review_day_stop_times(date, text, double precision, double precision) to authenticated, service_role;
grant execute on function public.verify_review_day_stop(date, text, boolean, double precision, double precision, text[]) to authenticated, service_role;
grant execute on function public.lock_review_day_stop(date, text, double precision, double precision, integer) to authenticated, service_role;
grant execute on function public.unlock_review_day_stop(text) to authenticated, service_role;
grant execute on function public.accept_review_day(date, jsonb) to authenticated, service_role;
grant execute on function public.unlock_review_day(date) to authenticated, service_role;
grant execute on function public.complete_review_day(date, text[]) to authenticated, service_role;
