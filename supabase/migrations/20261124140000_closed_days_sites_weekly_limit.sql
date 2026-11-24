-- Closed days, apprentice sites, and the weekly review limit.
-- NOT APPLIED. Reiss approves, then this is run by hand. It does not rebalance live reviews.

-- ===== sites
alter table public.candidate_centres
  add column if not exists open_weekdays smallint[] not null default '{1,2,3,4,5}';

update public.candidate_centres set open_weekdays = '{1,2,3,4,5}' where code = 'doncaster';
update public.candidate_centres set open_weekdays = '{1,2}' where code = 'sheffield';

alter table public.apprentices
  add column if not exists centre_id uuid references public.candidate_centres(id);

-- Everyone starts at Doncaster. Reiss moves Sheffield learners on the Programme tab.
do $$
declare
  v_doncaster uuid;
begin
  select id into v_doncaster from public.candidate_centres where code = 'doncaster';
  if v_doncaster is null then
    raise exception 'Doncaster centre is missing' using errcode = 'P0002';
  end if;
  update public.apprentices set centre_id = v_doncaster where centre_id is null;
end $$;

create or replace function public.doncaster_centre_id()
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select id from public.candidate_centres where code = 'doncaster' limit 1
$$;

alter table public.apprentices alter column centre_id set default public.doncaster_centre_id();
alter table public.apprentices alter column centre_id set not null;

comment on column public.apprentices.centre_id is
  'Training site. New and existing apprentices default to Doncaster.';

-- ===== weekly limit settings
alter table public.review_settings
  add column if not exists max_reviews_per_week integer not null default 25,
  add column if not exists earliest_move_weeks integer not null default 8,
  add column if not exists latest_move_weeks integer not null default 12;

alter table public.review_settings
  drop constraint if exists review_settings_week_limit;
alter table public.review_settings
  add constraint review_settings_week_limit check (
    max_reviews_per_week > 0 and earliest_move_weeks > 0 and latest_move_weeks >= earliest_move_weeks
  );

-- ===== closed days
create table public.calendar_closures (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  kind text not null check (kind in ('closure', 'bank_holiday')),
  source text not null check (source in ('gta_shutdown_sheet', 'gov_uk', 'manual')),
  external_ref text unique,
  locked boolean not null default false,
  locked_at timestamptz,
  locked_by uuid references public.profiles(id),
  removed_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_closures_range check (ends_on >= starts_on)
);

create index calendar_closures_span on public.calendar_closures (starts_on, ends_on) where removed_at is null;

create table public.calendar_closure_audit (
  id uuid primary key default gen_random_uuid(),
  closure_id uuid,
  action text not null,
  before_row jsonb,
  after_row jsonb,
  actor uuid,
  created_at timestamptz not null default now()
);

create table public.calendar_open_overrides (
  day_on date primary key,
  reason text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.review_plan_moves (
  id uuid primary key default gen_random_uuid(),
  review_id uuid,
  gta_id text not null,
  from_on date,
  to_on date,
  reason text not null check (reason in ('closed_day', 'weekly_limit')),
  detail text,
  actor uuid,
  created_at timestamptz not null default now()
);

create table public.review_plan_flags (
  id uuid primary key default gen_random_uuid(),
  gta_id text not null,
  planned_on date,
  kind text not null,
  message text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index review_plan_flags_open on public.review_plan_flags (gta_id, kind) where resolved_at is null;

alter table public.calendar_closures enable row level security;
alter table public.calendar_closure_audit enable row level security;
alter table public.calendar_open_overrides enable row level security;
alter table public.review_plan_moves enable row level security;
alter table public.review_plan_flags enable row level security;

create policy calendar_closures_read on public.calendar_closures for select to authenticated using (true);
create policy calendar_closures_write on public.calendar_closures for all to authenticated
  using (public.has_portal_role('Management')) with check (public.has_portal_role('Management'));
create policy calendar_closure_audit_read on public.calendar_closure_audit for select to authenticated using (true);
create policy calendar_open_overrides_read on public.calendar_open_overrides for select to authenticated using (true);
create policy calendar_open_overrides_write on public.calendar_open_overrides for all to authenticated
  using (public.has_portal_role('Management')) with check (public.has_portal_role('Management'));
create policy review_plan_moves_read on public.review_plan_moves for select to authenticated
  using (public.has_portal_role('Administrator','Management'));
create policy review_plan_flags_read on public.review_plan_flags for select to authenticated
  using (public.has_portal_role('Administrator','Management'));

grant select on public.calendar_closures, public.calendar_closure_audit, public.calendar_open_overrides to authenticated;
grant select, insert, update, delete on public.calendar_closures, public.calendar_open_overrides to authenticated;
grant select on public.review_plan_moves, public.review_plan_flags to authenticated;

-- ===== helpers
create or replace function public.apprentice_open_weekdays(p_gta_id text)
returns smallint[]
language sql stable security definer set search_path to ''
as $$
  select coalesce(
    (select c.open_weekdays from public.apprentices a join public.candidate_centres c on c.id = a.centre_id where a.gta_id = p_gta_id),
    (select c.open_weekdays from public.candidate_centres c where c.code = 'doncaster'),
    '{1,2,3,4,5}'::smallint[]
  );
$$;

create or replace function public.is_open_day(p_date date, p_gta_id text)
returns boolean
language sql stable security definer set search_path to ''
as $$
  select p_date is not null
    and extract(isodow from p_date)::int = any (public.apprentice_open_weekdays(p_gta_id))
    and not exists (
      select 1 from public.calendar_closures c
      where c.removed_at is null and p_date between c.starts_on and c.ends_on
    );
$$;

create or replace function public.week_open_day_count(p_week_start date, p_gta_id text)
returns integer
language sql stable security definer set search_path to ''
as $$
  select count(*)::int
  from generate_series(p_week_start, p_week_start + 6, interval '1 day') as d(day)
  where public.is_open_day(d.day::date, p_gta_id);
$$;

create or replace function public.week_is_excluded(p_date date, p_gta_id text)
returns boolean
language sql stable security definer set search_path to ''
as $$
  select public.week_open_day_count(date_trunc('week', p_date)::date, p_gta_id) < 3;
$$;

create or replace function public.next_open_day(p_date date, p_gta_id text)
returns date
language plpgsql stable security definer set search_path to ''
as $$
declare v_day date := p_date; v_i int := 0;
begin
  loop
    v_i := v_i + 1;
    v_day := p_date + v_i;
    exit when public.is_open_day(v_day, p_gta_id) or v_i > 370;
  end loop;
  if public.is_open_day(v_day, p_gta_id) then return v_day; end if;
  return null;
end;
$$;

create or replace function public.previous_open_day(p_date date, p_gta_id text)
returns date
language plpgsql stable security definer set search_path to ''
as $$
declare v_day date := p_date; v_i int := 0;
begin
  loop
    v_i := v_i + 1;
    v_day := p_date - v_i;
    exit when public.is_open_day(v_day, p_gta_id) or v_i > 370;
  end loop;
  if public.is_open_day(v_day, p_gta_id) then return v_day; end if;
  return null;
end;
$$;

create or replace function public.roll_planned_on(p_date date, p_gta_id text)
returns date
language plpgsql stable security definer set search_path to ''
as $$
declare
  v_week date := date_trunc('week', p_date)::date;
  v_cursor date;
  v_day date;
  v_i int;
begin
  if p_date is null then return null; end if;
  if public.week_is_excluded(p_date, p_gta_id) then
    v_cursor := v_week - 7;
    for v_i in 1..60 loop
      if not public.week_is_excluded(v_cursor, p_gta_id) then
        for v_day in select generate_series(v_cursor, v_cursor + 6, interval '1 day')::date loop
          if public.is_open_day(v_day, p_gta_id) then
            -- keep walking so the last open day wins
            null;
          end if;
        end loop;
        select max(d)::date into v_day from generate_series(v_cursor, v_cursor + 6, interval '1 day') d
        where public.is_open_day(d::date, p_gta_id);
        return coalesce(v_day, p_date);
      end if;
      v_cursor := v_cursor - 7;
    end loop;
    return p_date;
  end if;
  if public.is_open_day(p_date, p_gta_id) then return p_date; end if;
  if p_date = v_week then
    return coalesce(public.next_open_day(p_date - 1, p_gta_id), p_date);
  end if;
  select max(d)::date into v_day from generate_series(v_week, p_date - 1, interval '1 day') d
  where public.is_open_day(d::date, p_gta_id);
  if v_day is not null then return v_day; end if;
  v_cursor := v_week - 7;
  for v_i in 1..60 loop
    if not public.week_is_excluded(v_cursor, p_gta_id) then
      select max(d)::date into v_day from generate_series(v_cursor, v_cursor + 6, interval '1 day') d
      where public.is_open_day(d::date, p_gta_id);
      return coalesce(v_day, p_date);
    end if;
    v_cursor := v_cursor - 7;
  end loop;
  return p_date;
end;
$$;

create or replace function public.closed_day_reason(p_date date, p_gta_id text)
returns text
language sql stable security definer set search_path to ''
as $$
  select case
    when p_date is null then 'Choose a date'
    when public.week_is_excluded(p_date, p_gta_id) then 'That week is closed'
    when not (extract(isodow from p_date)::int = any (public.apprentice_open_weekdays(p_gta_id))) then 'That weekday is not open at this site'
    else (
      select c.name from public.calendar_closures c
      where c.removed_at is null and p_date between c.starts_on and c.ends_on
      order by c.starts_on limit 1
    )
  end
  where not public.is_open_day(p_date, p_gta_id) or public.week_is_excluded(p_date, p_gta_id);
$$;

create or replace function public.assert_bookable_day(p_date date, p_gta_id text)
returns void
language plpgsql stable security definer set search_path to ''
as $$
declare v_reason text;
begin
  if p_date is null then return; end if;
  if public.is_open_day(p_date, p_gta_id) and not public.week_is_excluded(p_date, p_gta_id) then return; end if;
  v_reason := coalesce(public.closed_day_reason(p_date, p_gta_id), 'That day is closed');
  raise exception '%', v_reason using errcode = '23514';
end;
$$;

create or replace function public.note_first_review_closed(p_gta_id text, p_date date)
returns void
language plpgsql security definer set search_path to ''
as $$
begin
  if p_date is null then return; end if;
  if exists (select 1 from public.reviews r where r.gta_id = p_gta_id and r.status = 'completed') then return; end if;
  if public.is_open_day(p_date, p_gta_id) and not public.week_is_excluded(p_date, p_gta_id) then return; end if;
  update public.review_plan_flags
     set planned_on = p_date, message = 'First review on a closed day'
   where gta_id = p_gta_id and kind = 'first_review_closed' and resolved_at is null;
  if not found then
    insert into public.review_plan_flags (gta_id, planned_on, kind, message)
    values (p_gta_id, p_date, 'first_review_closed', 'First review on a closed day');
  end if;
end;
$$;

-- ===== lock guard and audit
create or replace function public.calendar_closures_guard()
returns trigger
language plpgsql security definer set search_path to ''
as $$
begin
  if current_setting('gta.calendar_sync', true) = '1' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.locked and new.locked
     and (new.name is distinct from old.name or new.starts_on is distinct from old.starts_on
          or new.ends_on is distinct from old.ends_on or new.kind is distinct from old.kind
          or new.notes is distinct from old.notes) then
    raise exception 'This closed day is locked. Unlock it before editing.' using errcode = '23514';
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger calendar_closures_guard before update on public.calendar_closures
  for each row execute function public.calendar_closures_guard();

create or replace function public.calendar_closures_audit()
returns trigger
language plpgsql security definer set search_path to ''
as $$
begin
  insert into public.calendar_closure_audit (closure_id, action, before_row, after_row, actor)
  values (
    coalesce(new.id, old.id),
    tg_op,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    (select auth.uid())
  );
  return coalesce(new, old);
end;
$$;

create trigger calendar_closures_audit after insert or update or delete on public.calendar_closures
  for each row execute function public.calendar_closures_audit();

-- ===== booking guard. rebook_review_appointment calls book_review, which writes this table.
create or replace function public.review_bookings_closed_day()
returns trigger
language plpgsql security definer set search_path to ''
as $$
declare v_gta text;
begin
  if new.appointment_on is null then return new; end if;
  select r.gta_id into v_gta from public.reviews r where r.id = new.review_id;
  perform public.assert_bookable_day(new.appointment_on, v_gta);
  return new;
end;
$$;

create trigger review_bookings_closed_day before insert or update of appointment_on on public.review_bookings
  for each row execute function public.review_bookings_closed_day();

-- ===== seeds. Locked. No rebalance.
insert into public.calendar_closures (name, starts_on, ends_on, kind, source, external_ref, locked, locked_at)
values
  ('Christmas and New Year shutdown', '2026-12-24', '2027-01-04', 'closure', 'gta_shutdown_sheet', 'gta:2026-12-24:2027-01-04', true, now()),
  ('Easter shutdown', '2027-03-29', '2027-04-02', 'closure', 'gta_shutdown_sheet', 'gta:2027-03-29:2027-04-02', true, now()),
  ('Early May bank holiday', '2027-05-03', '2027-05-03', 'closure', 'gta_shutdown_sheet', 'gta:2027-05-03', true, now()),
  ('Spring half term', '2027-05-31', '2027-06-04', 'closure', 'gta_shutdown_sheet', 'gta:2027-05-31:2027-06-04', true, now()),
  ('Summer shutdown', '2027-08-23', '2027-08-27', 'closure', 'gta_shutdown_sheet', 'gta:2027-08-23:2027-08-27', true, now()),
  ('Summer bank holiday', '2027-08-30', '2027-08-30', 'closure', 'gta_shutdown_sheet', 'gta:2027-08-30', true, now()),
  ('Christmas Eve', '2027-12-24', '2027-12-24', 'closure', 'gta_shutdown_sheet', 'gta:2027-12-24', true, now()),
  ('Christmas shutdown', '2027-12-27', '2027-12-31', 'closure', 'gta_shutdown_sheet', 'gta:2027-12-27:2027-12-31', true, now()),
  ('New Year', '2028-01-03', '2028-01-03', 'closure', 'gta_shutdown_sheet', 'gta:2028-01-03', true, now());

insert into public.calendar_open_overrides (day_on, reason)
values ('2027-03-26', 'Good Friday stays open. The bank holiday sync must not close it.');

insert into public.calendar_closures (name, starts_on, ends_on, kind, source, external_ref, locked, locked_at)
select h.name, h.holiday_on, h.holiday_on, 'bank_holiday', 'gov_uk', 'govuk:england-and-wales:' || h.holiday_on::text, true, now()
from public.candidate_bank_holidays h
on conflict (external_ref) do nothing;

-- ===== bank holiday sync
create or replace function public.sync_bank_holidays(p_events jsonb)
returns integer
language plpgsql security definer set search_path to ''
as $$
declare
  v_row jsonb;
  v_date date;
  v_ref text;
  v_count integer := 0;
begin
  if current_user not in ('service_role', 'postgres') and (select auth.role()) is distinct from 'service_role' then
    raise exception 'Bank holiday sync is for the scheduled job' using errcode = '42501';
  end if;
  perform set_config('gta.calendar_sync', '1', true);
  for v_row in select value from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    v_date := (v_row->>'date')::date;
    if v_date is null then continue; end if;
    if exists (select 1 from public.calendar_open_overrides o where o.day_on = v_date) then continue; end if;
    v_ref := 'govuk:england-and-wales:' || v_date::text;
    if exists (select 1 from public.calendar_closures c where c.external_ref = v_ref and c.removed_at is not null) then
      continue;
    end if;
    insert into public.calendar_closures (name, starts_on, ends_on, kind, source, external_ref, locked, locked_at)
    values (coalesce(v_row->>'title', 'Bank holiday'), v_date, v_date, 'bank_holiday', 'gov_uk', v_ref, true, now())
    on conflict (external_ref) do update
      set name = excluded.name, updated_at = now()
      where public.calendar_closures.removed_at is null;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.sync_bank_holidays(jsonb) from public, anon, authenticated;
grant execute on function public.sync_bank_holidays(jsonb) to service_role;

-- ===== weekly rebalance. Not called by this migration.
create or replace function public.review_is_immovable(p_review_id uuid, p_gta_id text)
returns boolean
language sql stable security definer set search_path to ''
as $$
  select
    exists (select 1 from public.review_bookings b where b.review_id = p_review_id and b.appointment_on is not null)
    or exists (
      select 1 from public.review_day_stops s
      where s.gta_id = p_gta_id and s.locked_at is not null
        and coalesce(s.lock_expires_at, public.review_lock_expiry(s.locked_at)) > now()
    )
    or exists (
      select 1 from public.review_day_stops s
      where s.gta_id = p_gta_id
        and s.date_on >= (now() at time zone 'Europe/London')::date
        and coalesce(s.excluded, false) = false
        and (s.verified or s.accepted or coalesce(s.pinned, false))
    );
$$;

create or replace function public.rebalance_review_weeks(p_apply boolean default false)
returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare
  v_max int;
  v_early int;
  v_late int;
  v_today date := (now() at time zone 'Europe/London')::date;
  v_current date := date_trunc('week', v_today)::date;
  v_week date;
  v_count int;
  v_rec record;
  v_target date;
  v_day date;
  v_dow int;
  v_moves jsonb := '[]'::jsonb;
  v_weeks jsonb := '[]'::jsonb;
  v_before int;
  v_room int;
begin
  select max_reviews_per_week, earliest_move_weeks, latest_move_weeks
    into v_max, v_early, v_late from public.review_settings where id;
  v_max := coalesce(v_max, 25);
  v_early := coalesce(v_early, 8);
  v_late := coalesce(v_late, 12);

  create temp table if not exists _rebalance_load (week_on date primary key, total int) on commit drop;
  truncate _rebalance_load;
  insert into _rebalance_load (week_on, total)
  select date_trunc('week', r.planned_on)::date, count(*)::int
  from public.reviews r
  where r.status = 'open' and r.planned_on is not null
  group by 1;

  for v_week in select week_on from _rebalance_load where total > v_max and week_on > v_current order by week_on loop
    for v_rec in
      select r.id, r.gta_id, r.planned_on, max(c.actual_on) as last_on
      from public.reviews r
      join public.reviews c on c.gta_id = r.gta_id and c.status = 'completed'
      where r.status = 'open' and date_trunc('week', r.planned_on)::date = v_week
        and r.planned_on >= v_today
        and not public.review_is_immovable(r.id, r.gta_id)
      group by r.id, r.gta_id, r.planned_on
      order by max(c.actual_on) asc nulls last, r.gta_id
    loop
      if (select total from _rebalance_load where week_on = v_week) <= v_max then exit; end if;
      v_target := null;
      v_day := null;
      for v_target in
        select week_on from generate_series(v_week - 7, greatest(v_current + 7, coalesce(v_rec.last_on, v_today) + (v_early * 7)), interval '-7 days') d(week_on)
      loop
        if public.week_is_excluded(v_target, v_rec.gta_id) then continue; end if;
        if v_rec.last_on is not null and v_target < v_rec.last_on + (v_early * 7) then continue; end if;
        select total into v_room from _rebalance_load where week_on = v_target;
        if coalesce(v_room, 0) >= v_max then continue; end if;
        v_dow := extract(isodow from v_rec.planned_on)::int;
        v_day := v_target + (v_dow - 1);
        if not public.is_open_day(v_day, v_rec.gta_id) then
          select min(d)::date into v_day from generate_series(v_target, v_target + 6, interval '1 day') d
          where public.is_open_day(d::date, v_rec.gta_id);
        end if;
        exit when v_day is not null;
      end loop;
      if v_day is null then continue; end if;
      v_moves := v_moves || jsonb_build_array(jsonb_build_object(
        'reviewId', v_rec.id, 'gtaId', v_rec.gta_id, 'from', v_rec.planned_on, 'to', v_day, 'reason', 'weekly_limit'));
      update _rebalance_load set total = total - 1 where week_on = v_week;
      insert into _rebalance_load (week_on, total) values (date_trunc('week', v_day)::date, 1)
      on conflict (week_on) do update set total = _rebalance_load.total + 1;
      if p_apply then
        update public.reviews set planned_on = v_day where id = v_rec.id;
        insert into public.review_plan_moves (review_id, gta_id, from_on, to_on, reason, detail, actor)
        values (v_rec.id, v_rec.gta_id, v_rec.planned_on, v_day, 'weekly_limit', 'Moved to keep the week within the limit', (select auth.uid()));
      end if;
    end loop;

    for v_rec in
      select r.id, r.gta_id, r.planned_on, max(c.actual_on) as last_on
      from public.reviews r
      join public.reviews c on c.gta_id = r.gta_id and c.status = 'completed'
      where r.status = 'open' and date_trunc('week', r.planned_on)::date = v_week
        and r.planned_on >= v_today
        and not public.review_is_immovable(r.id, r.gta_id)
        and not exists (select 1 from jsonb_array_elements(v_moves) m where (m->>'reviewId')::uuid = r.id)
      group by r.id, r.gta_id, r.planned_on
      order by max(c.actual_on) desc nulls last, r.gta_id
    loop
      if (select total from _rebalance_load where week_on = v_week) <= v_max then exit; end if;
      v_day := null;
      for v_target in
        select week_on from generate_series(v_week + 7, coalesce(v_rec.last_on, v_today) + (v_late * 7), interval '7 days') d(week_on)
      loop
        if public.week_is_excluded(v_target, v_rec.gta_id) then continue; end if;
        if v_rec.last_on is not null and v_target > v_rec.last_on + (v_late * 7) then continue; end if;
        select total into v_room from _rebalance_load where week_on = v_target;
        if coalesce(v_room, 0) >= v_max then continue; end if;
        v_dow := extract(isodow from v_rec.planned_on)::int;
        v_day := v_target + (v_dow - 1);
        if not public.is_open_day(v_day, v_rec.gta_id) then
          select min(d)::date into v_day from generate_series(v_target, v_target + 6, interval '1 day') d
          where public.is_open_day(d::date, v_rec.gta_id);
        end if;
        exit when v_day is not null;
      end loop;
      if v_day is null then continue; end if;
      v_moves := v_moves || jsonb_build_array(jsonb_build_object(
        'reviewId', v_rec.id, 'gtaId', v_rec.gta_id, 'from', v_rec.planned_on, 'to', v_day, 'reason', 'weekly_limit'));
      update _rebalance_load set total = total - 1 where week_on = v_week;
      insert into _rebalance_load (week_on, total) values (date_trunc('week', v_day)::date, 1)
      on conflict (week_on) do update set total = _rebalance_load.total + 1;
      if p_apply then
        update public.reviews set planned_on = v_day where id = v_rec.id;
        insert into public.review_plan_moves (review_id, gta_id, from_on, to_on, reason, detail, actor)
        values (v_rec.id, v_rec.gta_id, v_rec.planned_on, v_day, 'weekly_limit', 'Moved to keep the week within the limit', (select auth.uid()));
      end if;
    end loop;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('week', week_on, 'count', total) order by week_on), '[]'::jsonb)
    into v_weeks from _rebalance_load;
  return jsonb_build_object('max', v_max, 'weeks', v_weeks, 'moves', v_moves, 'applied', p_apply);
end;
$$;

revoke all on function public.rebalance_review_weeks(boolean) from public, anon;
grant execute on function public.rebalance_review_weeks(boolean) to authenticated, service_role;

-- ===== planned date: roll computed dates, reject a hand-picked closed day
create or replace function public.review_next_planned_on(p_gta_id text)
returns date
language plpgsql stable security definer set search_path to ''
as $$
declare v_raw date;
begin
  select max(r.actual_on) + (public.review_interval_weeks(p_gta_id) * 7) into v_raw
  from public.reviews r
  where r.gta_id = p_gta_id and r.status = 'completed';
  if v_raw is null then return null; end if;
  return public.roll_planned_on(v_raw, p_gta_id);
end;
$$;

create or replace function public.review_lock_expiry(p_set_at timestamptz, p_gta_id text)
returns timestamptz
language plpgsql stable set search_path to ''
as $$
declare
  v_day date := ((p_set_at at time zone 'Europe/London')::date);
  v_next date;
begin
  v_next := public.next_open_day(v_day, p_gta_id);
  if v_next is null then v_next := v_day + 1; end if;
  return timezone('Europe/London', v_next + time '10:00');
end;
$$;

create or replace function public.review_lock_expiry(p_set_at timestamptz)
returns timestamptz
language sql stable set search_path to ''
as $$
  select public.review_lock_expiry(p_set_at, null::text);
$$;

create or replace function public.review_day_ensure(p_date date)
returns void
language plpgsql security definer set search_path to ''
as $$
begin
  if p_date is null then
    raise exception 'A date is required' using errcode = '22023';
  end if;
  perform public.assert_bookable_day(p_date, null);
  insert into public.review_days (date_on) values (p_date) on conflict (date_on) do nothing;
end;
$$;

create or replace function public.set_review_working_dates(p_dates date[])
returns void
language plpgsql security definer set search_path to ''
as $$
declare
  v_today date := (now() at time zone 'Europe/London')::date;
  v_dates date[];
  v_bad date;
begin
  perform public.review_plan_require_writer();
  select d into v_bad from unnest(coalesce(p_dates, '{}')) d
  where not public.is_open_day(d, null) or public.week_is_excluded(d, null)
  limit 1;
  if v_bad is not null then
    raise exception '%', coalesce(public.closed_day_reason(v_bad, null), 'That day is closed') using errcode = '23514';
  end if;
  select coalesce(array_agg(distinct d order by d), '{}') into v_dates
  from unnest(coalesce(p_dates, '{}')) d where d >= v_today;
  update public.review_settings set working_dates = v_dates, updated_by = (select auth.uid()) where id;
  perform public.review_plan_audit('review_settings', 'default', 'working_dates_set', 'Planning days set', jsonb_build_object('working_dates', v_dates));
end;
$$;

create or replace function public.reschedule_review(p_review_id uuid, p_planned_on date)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_planned_on is null then
    raise exception 'Planned date is required' using errcode = '22023';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then raise exception 'Review not found' using errcode = 'P0002'; end if;
  if v_rev.status <> 'open' then
    raise exception 'Only an open review can be rescheduled' using errcode = '23514';
  end if;
  if exists (select 1 from public.reviews r where r.gta_id = v_rev.gta_id and r.status = 'completed') then
    perform public.assert_bookable_day(p_planned_on, v_rev.gta_id);
  else
    perform public.note_first_review_closed(v_rev.gta_id, p_planned_on);
  end if;
  if v_rev.planned_on is not distinct from p_planned_on then return; end if;
  update public.reviews set planned_on = p_planned_on where id = p_review_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'rescheduled',
          format('Review for %s planned date %s -> %s', v_rev.gta_id, v_rev.planned_on, p_planned_on),
          jsonb_build_object('gta_id', v_rev.gta_id, 'old', v_rev.planned_on, 'new', p_planned_on, 'reason', 'manual'));
  perform public.rebalance_review_weeks(true);
end;
$$;

-- Latest repo body is 20261112190146, plus the closed-day and rebalance calls.
create or replace function public.open_review(p_gta_id text, p_planned_on date default null::date)
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_planned date;
  v_reviewer uuid;
  v_id uuid;
  v_first boolean;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  perform 1 from public.apprentices a where a.gta_id = p_gta_id for update;
  if not found then raise exception 'Apprentice % not found', p_gta_id using errcode = 'P0002'; end if;
  if exists (select 1 from public.reviews r where r.gta_id = p_gta_id and r.status = 'open') then
    raise exception 'Apprentice % already has an open review', p_gta_id using errcode = '23505';
  end if;
  v_first := not exists (select 1 from public.reviews r where r.gta_id = p_gta_id and r.status = 'completed');
  v_planned := coalesce(p_planned_on, public.review_next_planned_on(p_gta_id));
  if v_planned is null then raise exception 'A planned date is required' using errcode = '22023'; end if;
  if v_first then
    perform public.note_first_review_closed(p_gta_id, v_planned);
  elsif p_planned_on is not null then
    perform public.assert_bookable_day(p_planned_on, p_gta_id);
  end if;
  select rr.profile_id into v_reviewer from public.review_reviewers rr where rr.is_default;
  insert into public.reviews (gta_id, reviewer_id, planned_on, interval_weeks, status, source)
  values (p_gta_id, v_reviewer, v_planned, public.review_interval_weeks(p_gta_id), 'open', 'entered')
  returning id into v_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', v_id::text, 'opened',
          format('Review opened for %s, planned %s', p_gta_id, v_planned),
          jsonb_build_object('gta_id', p_gta_id, 'planned_on', v_planned, 'interval_weeks', public.review_interval_weeks(p_gta_id)));
  perform public.rebalance_review_weeks(true);
  return v_id;
end;
$$;

create or replace function public.complete_review(p_review_id uuid, p_actual_on date, p_method text default null::text, p_notes text default null::text)
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
  v_method text;
  v_next date;
  v_new uuid;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_actual_on is null then raise exception 'Actual review date is required' using errcode = '22023'; end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then raise exception 'Review not found' using errcode = 'P0002'; end if;
  if v_rev.status <> 'open' then raise exception 'Review is already completed' using errcode = '23514'; end if;
  v_method := coalesce(p_method, v_rev.method, 'in_person');
  if v_method not in ('in_person','phone','teams') then
    raise exception 'Method must be in_person, phone or teams' using errcode = '22023';
  end if;
  perform 1 from public.apprentices a where a.gta_id = v_rev.gta_id for update;
  perform public.review_pack_complete(p_review_id, p_actual_on);
  delete from public.review_bookings where review_id = p_review_id;
  update public.reviews
     set status = 'completed', actual_on = p_actual_on, method = v_method,
         notes = coalesce(nullif(btrim(p_notes), ''), notes)
   where id = p_review_id;
  v_next := public.review_next_planned_on(v_rev.gta_id);
  insert into public.reviews (gta_id, reviewer_id, planned_on, interval_weeks, status, source)
  values (v_rev.gta_id, v_rev.reviewer_id, v_next, public.review_interval_weeks(v_rev.gta_id), 'open', 'entered')
  returning id into v_new;
  if v_next is distinct from (p_actual_on + (public.review_interval_weeks(v_rev.gta_id) * 7)) then
    insert into public.review_plan_moves (review_id, gta_id, from_on, to_on, reason, detail, actor)
    values (v_new, v_rev.gta_id, p_actual_on + (public.review_interval_weeks(v_rev.gta_id) * 7), v_next, 'closed_day', 'Computed date landed on a closed day', v_uid);
  end if;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'completed',
          format('Review for %s completed on %s; next planned %s', v_rev.gta_id, p_actual_on, v_next),
          jsonb_build_object('gta_id', v_rev.gta_id, 'planned_on', v_rev.planned_on, 'actual_on', p_actual_on,
                             'method', v_method, 'next_review_id', v_new, 'next_planned_on', v_next,
                             'interval_weeks', public.review_interval_weeks(v_rev.gta_id)));
  perform public.rebalance_review_weeks(true);
  return v_new;
end;
$$;

create or replace function public.review_apply_concern_schedule(p_gta_id text)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/London')::date;
  v_rev public.reviews%rowtype;
  v_appt date;
  v_next date;
  v_weeks integer := public.review_interval_weeks(p_gta_id);
begin
  select * into v_rev from public.reviews r where r.gta_id = p_gta_id and r.status = 'open' for update;
  if not found then return; end if;
  select b.appointment_on into v_appt from public.review_bookings b where b.review_id = v_rev.id;
  if v_appt is not null and v_appt >= v_today then return; end if;
  v_next := public.review_next_planned_on(p_gta_id);
  if v_next is null then return; end if;
  if v_rev.planned_on is not distinct from v_next then
    if v_rev.interval_weeks <> v_weeks then
      update public.reviews set interval_weeks = v_weeks where id = v_rev.id;
    end if;
    return;
  end if;
  update public.reviews set planned_on = v_next, interval_weeks = v_weeks where id = v_rev.id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', v_rev.id::text, 'rescheduled',
          format('Review for %s planned date %s -> %s (concern schedule)', p_gta_id, v_rev.planned_on, v_next),
          jsonb_build_object('gta_id', p_gta_id, 'old', v_rev.planned_on, 'new', v_next, 'reason', 'concern', 'interval_weeks', v_weeks));
  perform public.rebalance_review_weeks(true);
end;
$$;

create or replace function public.return_from_break(p_break_id uuid, p_return_date date default null::date)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
  v_break public.breaks_in_learning%rowtype;
  v_check uuid;
  v_signed timestamptz;
  v_date date;
  v_next date;
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_break from public.breaks_in_learning b where b.id = p_break_id for update;
  if not found then raise exception 'Break not found' using errcode = 'P0002'; end if;
  if v_break.actual_return is not null then raise exception 'Break has already ended' using errcode = '23514'; end if;
  v_date := coalesce(p_return_date, (now() at time zone 'Europe/London')::date);
  if v_date < v_break.start_date then
    raise exception 'Return date cannot be before the break start date' using errcode = '23514';
  end if;
  select c.id, c.signed_off_at into v_check, v_signed from public.return_to_learning_checks c where c.break_id = p_break_id;
  if v_signed is null then
    raise exception 'Return-to-learning sign-off is required before returning from a break' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.return_checklist_items i
    where i.active and not exists (
      select 1 from public.return_check_results r where r.check_id = v_check and r.item_id = i.id and r.passed
    )
  ) then
    raise exception 'Every active return-to-learning checklist item must be passed' using errcode = '23514';
  end if;
  update public.breaks_in_learning set actual_return = v_date where id = p_break_id;
  update public.apprentices set status = 'in_learning' where gta_id = v_break.apprentice_id and status = 'break_in_learning';
  v_next := public.roll_planned_on(v_date + 70, v_break.apprentice_id);
  select * into v_rev from public.reviews r where r.gta_id = v_break.apprentice_id and r.status = 'open' for update;
  if found and v_rev.planned_on is distinct from v_next then
    update public.reviews set planned_on = v_next, interval_weeks = 10 where id = v_rev.id;
    insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
    values (v_uid, 'review', v_rev.id::text, 'rescheduled',
            format('Review for %s planned date %s -> %s (10 weeks after return from break)', v_break.apprentice_id, v_rev.planned_on, v_next),
            jsonb_build_object('gta_id', v_break.apprentice_id, 'old', v_rev.planned_on, 'new', v_next,
                               'reason', 'return_from_break', 'break_id', p_break_id, 'interval_weeks', 10));
    if v_next is distinct from (v_date + 70) then
      insert into public.review_plan_moves (review_id, gta_id, from_on, to_on, reason, detail, actor)
      values (v_rev.id, v_break.apprentice_id, v_date + 70, v_next, 'closed_day', 'Return date plus 70 days was closed', v_uid);
    end if;
  end if;
end;
$$;

create or replace function public.book_interview_attempt(
  p_candidate_id text, p_session_id uuid, p_frees_on_cancel boolean default false
) returns uuid
language plpgsql security definer set search_path to ''
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
  if not found then raise exception 'Interview session not found' using errcode = 'P0002'; end if;
  if v_session.kind = 'group' then
    if extract(isodow from v_session.session_on) <> 1 then
      raise exception 'Group interviews are on Mondays' using errcode = '23514';
    end if;
    if not public.is_open_day(v_session.session_on, null) or public.week_is_excluded(v_session.session_on, null) then
      raise exception '%', coalesce(public.closed_day_reason(v_session.session_on, null), 'That Monday is closed') using errcode = '23514';
    end if;
  end if;
  select count(*) into v_used from public.interview_bookings b
  where b.session_id = p_session_id and not (b.attendance in ('cancelled', 'rescheduled') and b.frees_place);
  if v_used >= v_session.capacity then raise exception 'This session is full' using errcode = '23514'; end if;
  select count(*) into v_failures from public.interview_bookings b
  where b.candidate_id = p_candidate_id and b.outcome = 'failed';
  if exists (select 1 from public.interview_bookings b where b.candidate_id = p_candidate_id and b.is_final_attempt and b.outcome <> 'awaiting') then
    raise exception 'The final attempt has already been used' using errcode = '23514';
  end if;
  if v_failures >= 3 then
    select max(b.actual_on) into v_third from public.interview_bookings b
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
  insert into public.interview_bookings (candidate_id, session_id, attempt_number, is_final_attempt, frees_place, entered_by)
  values (p_candidate_id, p_session_id, v_attempt, v_final, p_frees_on_cancel, v_uid)
  returning id into v_id;
  insert into public.candidate_events (candidate_id, event_type, actual_on, entered_by, detail)
  values (p_candidate_id, 'interview_booked', v_session.session_on, v_uid,
          jsonb_build_object('session_id', p_session_id, 'attempt', v_attempt, 'final', v_final));
  return v_id;
end;
$$;

-- Old bank-holiday table is unused once interviews read calendar_closures.
drop table public.candidate_bank_holidays;

-- ===== UI RPCs
create or replace function public.list_calendar_closures(p_year int)
returns jsonb
language sql stable security definer set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'startsOn', c.starts_on, 'endsOn', c.ends_on,
    'kind', c.kind, 'source', c.source, 'locked', c.locked, 'notes', c.notes
  ) order by c.starts_on), '[]'::jsonb)
  from public.calendar_closures c
  where c.removed_at is null
    and c.ends_on >= make_date(p_year, 1, 1)
    and c.starts_on <= make_date(p_year, 12, 31);
$$;

create or replace function public.preview_closure_impact(p_starts date, p_ends date)
returns jsonb
language sql stable security definer set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'gtaId', r.gta_id, 'plannedOn', r.planned_on,
    'wouldMoveTo', public.roll_planned_on(r.planned_on, r.gta_id)
  ) order by r.planned_on, r.gta_id), '[]'::jsonb)
  from public.reviews r
  where r.status = 'open' and r.planned_on between p_starts and p_ends
    and exists (select 1 from public.reviews c where c.gta_id = r.gta_id and c.status = 'completed')
    and public.roll_planned_on(r.planned_on, r.gta_id) is distinct from r.planned_on;
$$;

create or replace function public.save_calendar_closure(
  p_id uuid, p_name text, p_starts date, p_ends date, p_kind text, p_notes text
) returns uuid
language plpgsql security definer set search_path to ''
as $$
declare v_id uuid := p_id;
begin
  if not public.has_portal_role('Management') then
    raise exception 'Management role required' using errcode = '42501';
  end if;
  if p_ends < p_starts then raise exception 'The end date is before the start date' using errcode = '23514'; end if;
  if p_kind not in ('closure', 'bank_holiday') then raise exception 'Kind must be closure or bank holiday' using errcode = '22023'; end if;
  if v_id is null then
    insert into public.calendar_closures (name, starts_on, ends_on, kind, source, notes, created_by)
    values (btrim(p_name), p_starts, p_ends, p_kind, 'manual', nullif(btrim(p_notes), ''), (select auth.uid()))
    returning id into v_id;
  else
    update public.calendar_closures
       set name = btrim(p_name), starts_on = p_starts, ends_on = p_ends, kind = p_kind, notes = nullif(btrim(p_notes), '')
     where id = v_id and removed_at is null;
  end if;
  perform public.rebalance_review_weeks(true);
  return v_id;
end;
$$;

create or replace function public.set_calendar_closure_lock(p_id uuid, p_locked boolean)
returns void
language plpgsql security definer set search_path to ''
as $$
begin
  if not public.has_portal_role('Management') then
    raise exception 'Management role required' using errcode = '42501';
  end if;
  update public.calendar_closures
     set locked = p_locked,
         locked_at = case when p_locked then now() else null end,
         locked_by = case when p_locked then (select auth.uid()) else null end
   where id = p_id and removed_at is null;
end;
$$;

create or replace function public.remove_calendar_closure(p_id uuid)
returns void
language plpgsql security definer set search_path to ''
as $$
begin
  if not public.has_portal_role('Management') then
    raise exception 'Management role required' using errcode = '42501';
  end if;
  update public.calendar_closures set removed_at = now() where id = p_id and removed_at is null;
end;
$$;

create or replace function public.get_review_week_limits()
returns jsonb
language sql stable security definer set search_path to ''
as $$
  select jsonb_build_object(
    'max', max_reviews_per_week,
    'earliestWeeks', earliest_move_weeks,
    'latestWeeks', latest_move_weeks
  ) from public.review_settings where id;
$$;

create or replace function public.update_review_week_limits(p_max int, p_earliest int, p_latest int)
returns void
language plpgsql security definer set search_path to ''
as $$
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_max < 1 or p_earliest < 1 or p_latest < p_earliest then
    raise exception 'Check the weekly limit and the 8 to 12 week window' using errcode = '22023';
  end if;
  update public.review_settings
     set max_reviews_per_week = p_max, earliest_move_weeks = p_earliest, latest_move_weeks = p_latest,
         updated_by = (select auth.uid())
   where id;
end;
$$;

create or replace function public.set_apprentice_centre(p_gta_id text, p_centre_id uuid)
returns void
language plpgsql security definer set search_path to ''
as $$
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_centre_id is null or not exists (select 1 from public.candidate_centres c where c.id = p_centre_id) then
    raise exception 'Choose Doncaster or Sheffield' using errcode = '22023';
  end if;
  update public.apprentices set centre_id = p_centre_id where gta_id = p_gta_id;
  if not found then raise exception 'Apprentice % not found', p_gta_id using errcode = 'P0002'; end if;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values ((select auth.uid()), 'apprentice', p_gta_id, 'site_set',
          format('Site for %s set', p_gta_id),
          jsonb_build_object('gta_id', p_gta_id, 'centre_id', p_centre_id));
end;
$$;

revoke all on function public.list_calendar_closures(int) from public, anon;
revoke all on function public.preview_closure_impact(date, date) from public, anon;
revoke all on function public.save_calendar_closure(uuid, text, date, date, text, text) from public, anon;
revoke all on function public.set_calendar_closure_lock(uuid, boolean) from public, anon;
revoke all on function public.remove_calendar_closure(uuid) from public, anon;
revoke all on function public.get_review_week_limits() from public, anon;
revoke all on function public.update_review_week_limits(int, int, int) from public, anon;
revoke all on function public.set_apprentice_centre(text, uuid) from public, anon;
grant execute on function public.list_calendar_closures(int) to authenticated, service_role;
grant execute on function public.preview_closure_impact(date, date) to authenticated, service_role;
grant execute on function public.save_calendar_closure(uuid, text, date, date, text, text) to authenticated, service_role;
grant execute on function public.set_calendar_closure_lock(uuid, boolean) to authenticated, service_role;
grant execute on function public.remove_calendar_closure(uuid) to authenticated, service_role;
grant execute on function public.get_review_week_limits() to authenticated, service_role;
grant execute on function public.update_review_week_limits(int, int, int) to authenticated, service_role;
grant execute on function public.set_apprentice_centre(text, uuid) to authenticated, service_role;
