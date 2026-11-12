-- Overview tab: safeguarding sign-offs. Records are never edited, only reversed. One active sign-off per learner.
create table public.apprentice_safeguarding_signoffs (
  id uuid primary key default gen_random_uuid(),
  gta_id text not null references public.apprentices(gta_id) on delete restrict,
  signed_on date not null,
  source text not null check (source in ('entered','imported')),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(id) on delete restrict,
  reversal_reason text,
  constraint safeguarding_signoffs_notes_not_blank check (notes is null or btrim(notes) <> ''),
  constraint safeguarding_signoffs_reversal_consistent check (
    (reversed_at is null and reversed_by is null and reversal_reason is null)
    or (reversed_at is not null and reversed_by is not null and reversal_reason is not null and btrim(reversal_reason) <> '')
  )
);

create unique index safeguarding_signoffs_one_active_idx on public.apprentice_safeguarding_signoffs (gta_id) where reversed_at is null;
create index safeguarding_signoffs_gta_id_idx on public.apprentice_safeguarding_signoffs (gta_id, signed_on desc);
create index safeguarding_signoffs_recorded_by_idx on public.apprentice_safeguarding_signoffs (recorded_by);
create index safeguarding_signoffs_reversed_by_idx on public.apprentice_safeguarding_signoffs (reversed_by);

-- A sign-off cannot be edited. The only permitted change is to reverse an active one.
create or replace function public.safeguarding_signoffs_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if old.reversed_at is not null then
    raise exception 'A reversed safeguarding sign-off cannot be changed' using errcode = '23514';
  end if;
  if (new.id, new.gta_id, new.signed_on, new.source, new.recorded_by, new.notes, new.created_at)
     is distinct from (old.id, old.gta_id, old.signed_on, old.source, old.recorded_by, old.notes, old.created_at) then
    raise exception 'A safeguarding sign-off cannot be edited; reverse it and record a new one' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger safeguarding_signoffs_guard
  before update on public.apprentice_safeguarding_signoffs
  for each row execute function public.safeguarding_signoffs_guard();

alter table public.apprentice_safeguarding_signoffs enable row level security;

create policy safeguarding_signoffs_select_admin_mgmt on public.apprentice_safeguarding_signoffs
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));

revoke all on table public.apprentice_safeguarding_signoffs from public, anon, authenticated;
grant select on table public.apprentice_safeguarding_signoffs to authenticated;
grant select, insert, update, delete on table public.apprentice_safeguarding_signoffs to service_role;

create or replace function public.record_safeguarding_signoff(p_gta_id text, p_signed_on date, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/London')::date;
  v_id uuid;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_signed_on is null then
    raise exception 'Sign-off date is required' using errcode = '22023';
  end if;
  if p_signed_on > v_today then
    raise exception 'Sign-off date cannot be in the future' using errcode = '23514';
  end if;
  perform 1 from public.apprentices a where a.gta_id = p_gta_id for update;
  if not found then
    raise exception 'Apprentice % not found', p_gta_id using errcode = 'P0002';
  end if;
  if exists (select 1 from public.apprentice_safeguarding_signoffs s where s.gta_id = p_gta_id and s.reversed_at is null) then
    raise exception 'Apprentice % already has an active safeguarding sign-off', p_gta_id using errcode = '23505';
  end if;
  insert into public.apprentice_safeguarding_signoffs (gta_id, signed_on, source, recorded_by, notes)
  values (p_gta_id, p_signed_on, 'entered', v_uid, nullif(btrim(p_notes), ''))
  returning id into v_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'safeguarding_signoff', v_id::text, 'recorded',
          format('Safeguarding sign-off recorded for %s on %s', p_gta_id, p_signed_on),
          jsonb_build_object('gta_id', p_gta_id, 'signed_on', p_signed_on, 'source', 'entered'));
  return v_id;
end;
$$;

create or replace function public.reverse_safeguarding_signoff(p_signoff_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.apprentice_safeguarding_signoffs%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reversal reason is required' using errcode = '23514';
  end if;
  select * into v_row from public.apprentice_safeguarding_signoffs s where s.id = p_signoff_id for update;
  if not found then
    raise exception 'Safeguarding sign-off not found' using errcode = 'P0002';
  end if;
  if v_row.reversed_at is not null then
    raise exception 'Safeguarding sign-off has already been reversed' using errcode = '23514';
  end if;
  update public.apprentice_safeguarding_signoffs
     set reversed_at = now(), reversed_by = v_uid, reversal_reason = btrim(p_reason)
   where id = p_signoff_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'safeguarding_signoff', p_signoff_id::text, 'reversed',
          format('Safeguarding sign-off for %s reversed', v_row.gta_id),
          jsonb_build_object('gta_id', v_row.gta_id, 'signed_on', v_row.signed_on, 'source', v_row.source));
end;
$$;

-- Read path for everyone with a staff role. Tutors get the dates but never the notes or reversal reason.
create or replace function public.get_safeguarding_signoffs(p_gta_id text default null)
returns table (
  id uuid, gta_id text, signed_on date, source text, recorded_by uuid, notes text,
  created_at timestamptz, reversed_at timestamptz, reversed_by uuid, reversal_reason text
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v_full boolean;
begin
  v_full := public.has_portal_role('Administrator','Management');
  if not v_full and not public.has_portal_role('Tutor') then
    raise exception 'Staff role required' using errcode = '42501';
  end if;
  return query
  select s.id, s.gta_id, s.signed_on, s.source, s.recorded_by,
         case when v_full then s.notes else null end,
         s.created_at, s.reversed_at, s.reversed_by,
         case when v_full then s.reversal_reason else null end
  from public.apprentice_safeguarding_signoffs s
  where p_gta_id is null or s.gta_id = p_gta_id
  order by s.signed_on desc, s.created_at desc, s.id;
end;
$$;

revoke all on function public.safeguarding_signoffs_guard() from public, anon, authenticated;
grant execute on function public.safeguarding_signoffs_guard() to service_role;
revoke all on function public.record_safeguarding_signoff(text, date, text) from public, anon;
grant execute on function public.record_safeguarding_signoff(text, date, text) to authenticated, service_role;
revoke all on function public.reverse_safeguarding_signoff(uuid, text) from public, anon;
grant execute on function public.reverse_safeguarding_signoff(uuid, text) to authenticated, service_role;
revoke all on function public.get_safeguarding_signoffs(text) from public, anon;
grant execute on function public.get_safeguarding_signoffs(text) to authenticated, service_role;
