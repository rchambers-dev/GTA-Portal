-- Filed for review. Not applied. Do not run this migration until it is approved.
-- Proposed Open Days schema for the GTA Portal Marketing section.
-- Target project: GTA-Portal (ref cjtgjxgghfiskqnuttzd).
--
-- NOT APPLIED. This file is a proposal only. Do not run it until Reiss
-- has approved the tables, columns and access model.
--
-- Conventions follow existing portal tables (see
-- supabase/migrations/20261114180000_candidates_onboarding.sql):
--   snake_case, uuid PKs default gen_random_uuid(),
--   created_at / updated_at timestamptz default now(),
--   public.touch_updated_at() before-update trigger,
--   text status columns with CHECK constraints,
--   RLS enabled, staff access via has_portal_role('Administrator','Management')
--   (same helper as candidates / recruitment; a finer marketing permission
--   does not exist yet).
--
-- Why this project, not GTA-Website (jyiauabvpkgnflihtvdy):
--   Staff already sign in here. The Marketing & Recruitment nav lives in
--   this app. The website Supabase project is paused and the website repo
--   has no Supabase client today.
--
-- Public access model:
--   Do not put the portal anon key in the website's browser bundle — this
--   database also holds apprentice and candidate PII, and many public
--   tables still have default GRANTs to anon (RLS is the only barrier).
--   The website should keep using its existing /api/open-day/* routes and
--   call the security-definer RPCs below with a server-only portal URL +
--   anon key (or a portal public API route). Direct table INSERT from
--   anon is revoked; bookings are created only through the submit RPCs
--   so the booking and its vehicles are written in one transaction.
--   RLS policies below are defence in depth for staff and for any future
--   direct client use.

-- ---------------------------------------------------------------------------
-- Staff helper (mirrors public.candidates_staff_write)
-- ---------------------------------------------------------------------------
create or replace function public.open_days_staff_write()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.has_portal_role('Administrator', 'Management');
$$;

revoke all on function public.open_days_staff_write() from public, anon;
grant execute on function public.open_days_staff_write() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. open_days — event "headers" managed in the portal
-- ---------------------------------------------------------------------------
create table public.open_days (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text not null,
  -- Optional display override, e.g. "Saturday 15 August 2026".
  date_label text,
  date_on date not null,
  start_time time,
  end_time time,
  -- Optional link to the existing Doncaster / Sheffield centres.
  centre_id uuid references public.candidate_centres(id),
  location_name text,
  address text,
  description text,
  hero_image_url text,
  -- draft: staff only
  -- published: listed on the website; new bookings allowed when bookings_open
  -- closed: still listed, but new bookings are rejected
  -- cancelled: hidden from the public site
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'cancelled')),
  bookings_open boolean not null default true,
  bookings_open_from timestamptz,
  bookings_open_until timestamptz,
  capacity_trade_stands integer check (capacity_trade_stands is null or capacity_trade_stands >= 0),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint open_days_title_not_blank check (btrim(title) <> ''),
  constraint open_days_times_order check (
    start_time is null or end_time is null or end_time > start_time
  ),
  constraint open_days_booking_window check (
    bookings_open_from is null
    or bookings_open_until is null
    or bookings_open_until > bookings_open_from
  )
);

comment on table public.open_days is
  'Open Day event headers. Staff create/edit these in Marketing; the public website reads published rows.';

create index open_days_status_date_idx on public.open_days (status, date_on);
create index open_days_centre_id_idx on public.open_days (centre_id);

drop trigger if exists touch_open_days_updated_at on public.open_days;
create trigger touch_open_days_updated_at
before update on public.open_days
for each row
execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. open_day_bookings — exhibitor and trade-stand sign-ups
-- ---------------------------------------------------------------------------
create table public.open_day_bookings (
  id uuid primary key default gen_random_uuid(),
  open_day_id uuid not null references public.open_days(id) on delete restrict,
  booking_type text not null check (booking_type in ('exhibitor', 'trade_stand')),
  status text not null default 'pending' check (status in (
    'pending', 'confirmed', 'waitlist', 'cancelled', 'checked_in'
  )),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  marketing_consent boolean not null default false,
  calendar_invite_requested boolean not null default false,
  terms_accepted boolean not null default false,
  -- Trade stand fields (null for exhibitor bookings).
  company_name text,
  business_type text,
  space_package_id text check (
    space_package_id is null
    or space_package_id in ('1v_3x3', '1v_6x3', '2v_6x3')
  ),
  vehicle_regs text,
  insurance_confirmed boolean,
  risk_assessment_confirmed boolean,
  staff_notes text,
  source text not null default 'website',
  submitted_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint open_day_bookings_names_not_blank check (
    btrim(first_name) <> '' and btrim(last_name) <> ''
  ),
  constraint open_day_bookings_email_not_blank check (btrim(email) <> ''),
  constraint open_day_bookings_terms check (
    status = 'cancelled' or terms_accepted
  ),
  constraint open_day_bookings_trade_stand_fields check (
    booking_type <> 'trade_stand'
    or (
      business_type is not null and btrim(business_type) <> ''
      and space_package_id is not null
      and vehicle_regs is not null and btrim(vehicle_regs) <> ''
      and insurance_confirmed is true
      and risk_assessment_confirmed is true
    )
  ),
  constraint open_day_bookings_exhibitor_has_no_stand check (
    booking_type <> 'exhibitor'
    or (
      space_package_id is null
      and insurance_confirmed is null
      and risk_assessment_confirmed is null
    )
  ),
  constraint open_day_bookings_cancel_pair check (
    (cancelled_at is null and cancelled_by is null)
    or cancelled_at is not null
  ),
  constraint open_day_bookings_checkin_pair check (
    (checked_in_at is null and checked_in_by is null)
    or checked_in_at is not null
  )
);

comment on table public.open_day_bookings is
  'Public Open Day sign-ups (exhibitor or trade stand). PII — staff only, never readable by anon.';

create index open_day_bookings_day_submitted_idx
  on public.open_day_bookings (open_day_id, submitted_at desc);
create index open_day_bookings_day_type_status_idx
  on public.open_day_bookings (open_day_id, booking_type, status);
create index open_day_bookings_email_idx
  on public.open_day_bookings (email);

-- One active booking per email, per type, per event (matches the current
-- website API). A cancelled row does not block a later re-booking.
create unique index open_day_bookings_one_active_email
  on public.open_day_bookings (open_day_id, booking_type, email)
  where status is distinct from 'cancelled';

drop trigger if exists touch_open_day_bookings_updated_at on public.open_day_bookings;
create trigger touch_open_day_bookings_updated_at
before update on public.open_day_bookings
for each row
execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. open_day_booking_vehicles — exhibitor vehicles
-- ---------------------------------------------------------------------------
create table public.open_day_booking_vehicles (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.open_day_bookings(id) on delete cascade,
  -- Denormalised from the parent booking so uniqueness and listing stay simple.
  -- Kept in sync by open_day_booking_vehicles_normalise().
  open_day_id uuid not null references public.open_days(id) on delete restrict,
  make text,
  model text,
  year_text text,
  registration text not null,
  category text check (
    category is null
    or category in ('Classic', 'Modern', 'Modified', 'Commercial', 'Motorcycle', 'Other')
  ),
  car_club text,
  sort_order integer not null default 0,
  -- False when the parent booking is cancelled, so the same registration can
  -- be booked again later without deleting history.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint open_day_booking_vehicles_reg_not_blank check (btrim(registration) <> '')
);

comment on table public.open_day_booking_vehicles is
  'Vehicles on an exhibitor Open Day booking. Registration is unique per event while the booking is active.';

create index open_day_booking_vehicles_booking_id_idx
  on public.open_day_booking_vehicles (booking_id);

create unique index open_day_booking_vehicles_one_active_reg
  on public.open_day_booking_vehicles (open_day_id, registration)
  where is_active;

drop trigger if exists touch_open_day_booking_vehicles_updated_at on public.open_day_booking_vehicles;
create trigger touch_open_day_booking_vehicles_updated_at
before update on public.open_day_booking_vehicles
for each row
execute function public.touch_updated_at();

-- Keep open_day_id on vehicles in sync and normalise registration.
create or replace function public.open_day_booking_vehicles_normalise()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_day uuid;
  v_type text;
begin
  select b.open_day_id, b.booking_type
    into v_day, v_type
  from public.open_day_bookings b
  where b.id = new.booking_id;

  if not found then
    raise exception 'Booking % not found', new.booking_id using errcode = '23503';
  end if;
  if v_type <> 'exhibitor' then
    raise exception 'Vehicles can only be attached to exhibitor bookings' using errcode = '23514';
  end if;

  new.open_day_id := v_day;
  new.registration := upper(regexp_replace(btrim(new.registration), '\s+', '', 'g'));
  return new;
end;
$$;

drop trigger if exists open_day_booking_vehicles_normalise on public.open_day_booking_vehicles;
create trigger open_day_booking_vehicles_normalise
before insert or update of booking_id, registration
on public.open_day_booking_vehicles
for each row
execute function public.open_day_booking_vehicles_normalise();

-- Mark vehicles inactive when a booking is cancelled so the same
-- registration can be booked again.
create or replace function public.open_day_bookings_after_status()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.open_day_booking_vehicles
       set is_active = false
     where booking_id = new.id and is_active;
  elsif old.status = 'cancelled' and new.status is distinct from 'cancelled' then
    update public.open_day_booking_vehicles
       set is_active = true
     where booking_id = new.id and not is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists open_day_bookings_after_status on public.open_day_bookings;
create trigger open_day_bookings_after_status
after update of status on public.open_day_bookings
for each row
execute function public.open_day_bookings_after_status();

-- Lower-case and trim email on write.
create or replace function public.open_day_bookings_normalise()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.email := lower(btrim(new.email));
  new.first_name := btrim(new.first_name);
  new.last_name := btrim(new.last_name);
  new.phone := btrim(new.phone);
  if new.company_name is not null then
    new.company_name := nullif(btrim(new.company_name), '');
  end if;
  return new;
end;
$$;

drop trigger if exists open_day_bookings_normalise on public.open_day_bookings;
create trigger open_day_bookings_normalise
before insert or update of email, first_name, last_name, phone, company_name
on public.open_day_bookings
for each row
execute function public.open_day_bookings_normalise();

-- ---------------------------------------------------------------------------
-- Public read helpers (no PII)
-- ---------------------------------------------------------------------------
create or replace function public.open_day_is_publicly_listed(p_status text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select p_status in ('published', 'closed');
$$;

create or replace function public.open_day_accepts_bookings(
  p_status text,
  p_bookings_open boolean,
  p_from timestamptz,
  p_until timestamptz
)
returns boolean
language sql
stable
set search_path to ''
as $$
  select p_status = 'published'
     and p_bookings_open
     and (p_from is null or p_from <= now())
     and (p_until is null or p_until >= now());
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs — granted to anon. These are the website's write path.
-- ---------------------------------------------------------------------------
create or replace function public.list_published_open_days()
returns table (
  id uuid,
  slug text,
  title text,
  date_label text,
  date_on date,
  start_time time,
  end_time time,
  centre_id uuid,
  location_name text,
  address text,
  description text,
  hero_image_url text,
  status text,
  bookings_open boolean,
  capacity_trade_stands integer
)
language sql
stable
security definer
set search_path to ''
as $$
  select
    d.id,
    d.slug,
    d.title,
    d.date_label,
    d.date_on,
    d.start_time,
    d.end_time,
    d.centre_id,
    d.location_name,
    d.address,
    d.description,
    d.hero_image_url,
    d.status,
    public.open_day_accepts_bookings(
      d.status, d.bookings_open, d.bookings_open_from, d.bookings_open_until
    ) as bookings_open,
    d.capacity_trade_stands
  from public.open_days d
  where public.open_day_is_publicly_listed(d.status)
  order by d.date_on, d.start_time nulls last, d.title;
$$;

create or replace function public.submit_open_day_exhibitor_booking(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_day public.open_days%rowtype;
  v_booking_id uuid;
  v_vehicle jsonb;
  v_vehicle_id uuid;
  v_reg text;
  v_i integer := 0;
  v_vehicles jsonb := '[]'::jsonb;
begin
  if p_payload is null then
    raise exception 'Missing payload' using errcode = '22023';
  end if;

  select * into v_day
  from public.open_days
  where id = (p_payload->>'open_day_id')::uuid
  for update;

  if not found then
    raise exception 'Open Day not found' using errcode = 'P0002';
  end if;
  if not public.open_day_accepts_bookings(
    v_day.status, v_day.bookings_open, v_day.bookings_open_from, v_day.bookings_open_until
  ) then
    raise exception 'Open Day bookings are currently closed.' using errcode = 'P0001';
  end if;

  if coalesce(p_payload->>'terms_accepted', 'false') <> 'true' then
    raise exception 'Terms must be accepted' using errcode = '23514';
  end if;
  if jsonb_typeof(p_payload->'vehicles') is distinct from 'array'
     or jsonb_array_length(p_payload->'vehicles') < 1 then
    raise exception 'At least one vehicle is required' using errcode = '23514';
  end if;

  insert into public.open_day_bookings (
    open_day_id, booking_type, status,
    first_name, last_name, email, phone,
    marketing_consent, calendar_invite_requested, terms_accepted, source
  ) values (
    v_day.id,
    'exhibitor',
    'confirmed',
    p_payload->>'first_name',
    p_payload->>'last_name',
    p_payload->>'email',
    p_payload->>'phone',
    coalesce((p_payload->>'marketing_consent')::boolean, false),
    coalesce((p_payload->>'calendar_invite_requested')::boolean, false),
    true,
    coalesce(nullif(p_payload->>'source', ''), 'website')
  )
  returning id into v_booking_id;

  for v_vehicle in select value from jsonb_array_elements(p_payload->'vehicles')
  loop
    v_i := v_i + 1;
    v_reg := upper(regexp_replace(btrim(coalesce(v_vehicle->>'registration', '')), '\s+', '', 'g'));
    if v_reg = '' then
      raise exception 'Each vehicle needs a registration.' using errcode = '23514';
    end if;

    insert into public.open_day_booking_vehicles (
      booking_id, open_day_id, make, model, year_text, registration,
      category, car_club, sort_order
    ) values (
      v_booking_id,
      v_day.id,
      nullif(btrim(coalesce(v_vehicle->>'make', '')), ''),
      nullif(btrim(coalesce(v_vehicle->>'model', '')), ''),
      nullif(btrim(coalesce(v_vehicle->>'year', v_vehicle->>'year_text', '')), ''),
      v_reg,
      nullif(v_vehicle->>'category', ''),
      nullif(btrim(coalesce(v_vehicle->>'car_club', '')), ''),
      v_i
    )
    returning id into v_vehicle_id;

    v_vehicles := v_vehicles || jsonb_build_array(jsonb_build_object(
      'id', v_vehicle_id,
      'registration', v_reg
    ));
  end loop;

  return jsonb_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'status', 'confirmed',
    'vehicles', v_vehicles
  );
exception
  when unique_violation then
    raise exception 'A booking already exists for this email or vehicle registration.' using errcode = '23505';
end;
$$;

create or replace function public.submit_open_day_trade_stand_booking(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_day public.open_days%rowtype;
  v_booking_id uuid;
  v_pkg text;
begin
  if p_payload is null then
    raise exception 'Missing payload' using errcode = '22023';
  end if;

  select * into v_day
  from public.open_days
  where id = (p_payload->>'open_day_id')::uuid
  for update;

  if not found then
    raise exception 'Open Day not found' using errcode = 'P0002';
  end if;
  if not public.open_day_accepts_bookings(
    v_day.status, v_day.bookings_open, v_day.bookings_open_from, v_day.bookings_open_until
  ) then
    raise exception 'Open Day bookings are currently closed.' using errcode = 'P0001';
  end if;

  v_pkg := p_payload->>'space_package_id';
  if v_pkg not in ('1v_3x3', '1v_6x3', '2v_6x3') then
    raise exception 'Choose a valid space package.' using errcode = '23514';
  end if;
  if coalesce(p_payload->>'terms_accepted', 'false') <> 'true'
     or coalesce(p_payload->>'insurance_confirmed', 'false') <> 'true'
     or coalesce(p_payload->>'risk_assessment_confirmed', 'false') <> 'true' then
    raise exception 'Terms, insurance and risk assessment must be confirmed.' using errcode = '23514';
  end if;

  if v_day.capacity_trade_stands is not null then
    if (
      select count(*)
      from public.open_day_bookings b
      where b.open_day_id = v_day.id
        and b.booking_type = 'trade_stand'
        and b.status is distinct from 'cancelled'
    ) >= v_day.capacity_trade_stands then
      raise exception 'No trade stand spaces are left for this Open Day.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.open_day_bookings (
    open_day_id, booking_type, status,
    first_name, last_name, email, phone,
    marketing_consent, calendar_invite_requested, terms_accepted,
    company_name, business_type, space_package_id, vehicle_regs,
    insurance_confirmed, risk_assessment_confirmed, source
  ) values (
    v_day.id,
    'trade_stand',
    'confirmed',
    p_payload->>'first_name',
    p_payload->>'last_name',
    p_payload->>'email',
    p_payload->>'phone',
    coalesce((p_payload->>'marketing_consent')::boolean, false),
    coalesce((p_payload->>'calendar_invite_requested')::boolean, false),
    true,
    nullif(btrim(coalesce(p_payload->>'company_name', '')), ''),
    p_payload->>'business_type',
    v_pkg,
    p_payload->>'vehicle_regs',
    true,
    true,
    coalesce(nullif(p_payload->>'source', ''), 'website')
  )
  returning id into v_booking_id;

  return jsonb_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'status', 'confirmed'
  );
exception
  when unique_violation then
    raise exception 'A trade stand booking already exists for this email.' using errcode = '23505';
end;
$$;

revoke all on function public.list_published_open_days() from public;
revoke all on function public.submit_open_day_exhibitor_booking(jsonb) from public;
revoke all on function public.submit_open_day_trade_stand_booking(jsonb) from public;

grant execute on function public.list_published_open_days() to anon, authenticated, service_role;
grant execute on function public.submit_open_day_exhibitor_booking(jsonb) to anon, authenticated, service_role;
grant execute on function public.submit_open_day_trade_stand_booking(jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.open_days enable row level security;
alter table public.open_day_bookings enable row level security;
alter table public.open_day_booking_vehicles enable row level security;

-- Staff (Administrator / Management) can manage everything.
create policy open_days_staff on public.open_days
  for all to authenticated
  using (public.open_days_staff_write())
  with check (public.open_days_staff_write());

create policy open_day_bookings_staff on public.open_day_bookings
  for all to authenticated
  using (public.open_days_staff_write())
  with check (public.open_days_staff_write());

create policy open_day_booking_vehicles_staff on public.open_day_booking_vehicles
  for all to authenticated
  using (public.open_days_staff_write())
  with check (public.open_days_staff_write());

-- Public can read published/closed event headers. No write via the table.
create policy open_days_public_read on public.open_days
  for select to anon, authenticated
  using (public.open_day_is_publicly_listed(status));

-- Bookings and vehicles: no anon SELECT or INSERT on the base tables.
-- Public writes go through the submit RPCs (security definer).

revoke all on table public.open_days from public, anon, authenticated;
revoke all on table public.open_day_bookings from public, anon, authenticated;
revoke all on table public.open_day_booking_vehicles from public, anon, authenticated;

grant select on table public.open_days to anon, authenticated;
grant select, insert, update, delete on table public.open_days to authenticated;
grant select, insert, update, delete on table public.open_day_bookings to authenticated;
grant select, insert, update, delete on table public.open_day_booking_vehicles to authenticated;

grant select, insert, update, delete on table public.open_days to service_role;
grant select, insert, update, delete on table public.open_day_bookings to service_role;
grant select, insert, update, delete on table public.open_day_booking_vehicles to service_role;
