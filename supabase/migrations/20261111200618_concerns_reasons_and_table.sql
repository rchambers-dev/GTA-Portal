-- Concerns tab: shared reasons flag + learner_concerns table.
alter table public.reasons add column used_for_concerns boolean not null default false;

-- Let the shared reason-usage trigger check the new flag too.
create or replace function public.enforce_reason_usage()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.reasons%rowtype;
  ok boolean;
begin
  if new.reason_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.reason_id is not distinct from old.reason_id then
    return new;
  end if;
  select * into r from public.reasons where id = new.reason_id;
  if not found then
    raise exception 'Reason not found' using errcode = '22023';
  end if;
  if not r.active then
    raise exception 'Reason "%" is not active', r.label using errcode = '22023';
  end if;
  ok := case tg_argv[0]
    when 'breaks' then r.used_for_breaks
    when 'withdrawals' then r.used_for_withdrawals
    when 'date_changes' then r.used_for_date_changes
    when 'concerns' then r.used_for_concerns
    else false end;
  if not ok then
    raise exception 'Reason "%" cannot be used for %', r.label, replace(tg_argv[0], '_', ' ') using errcode = '22023';
  end if;
  return new;
end;
$$;

-- Existing reasons that are valid concern reasons (matched by name).
do $$
declare n int;
begin
  update public.reasons set used_for_concerns = true
   where label in (
     'Illness, injury or medical treatment',
     'Mental health',
     'Learner needs more time to complete the work',
     'Learner not ready for gateway',
     'Additional learning support needs',
     'Safeguarding');
  get diagnostics n = row_count;
  if n <> 6 then
    raise exception 'Expected to flag 6 existing reasons for concerns, flagged %', n;
  end if;
end $$;

-- New concern-only reasons.
insert into public.reasons (label, used_for_breaks, used_for_withdrawals, used_for_date_changes, is_safeguarding, used_for_concerns, sort_order, active)
values
  ('Low attendance', false, false, false, false, true, 260, true),
  ('Behind on progress or off-the-job hours', false, false, false, false, true, 270, true),
  ('Behaviour or conduct', false, false, false, false, true, 280, true);

create table public.learner_concerns (
  id uuid primary key default gen_random_uuid(),
  gta_id text not null references public.apprentices(gta_id) on delete restrict,
  raised_on date not null,
  raised_by uuid not null references public.profiles(id) on delete restrict,
  reason_id uuid not null references public.reasons(id) on delete restrict,
  notes text,
  resolved_on date,
  resolved_by uuid references public.profiles(id) on delete restrict,
  resolution_note text,
  created_at timestamptz not null default now(),
  constraint learner_concerns_notes_not_blank check (notes is null or btrim(notes) <> ''),
  constraint learner_concerns_resolution_note_not_blank check (resolution_note is null or btrim(resolution_note) <> ''),
  constraint learner_concerns_resolution_consistent check (
    (resolved_on is null and resolved_by is null and resolution_note is null)
    or (resolved_on is not null and resolved_by is not null)
  ),
  constraint learner_concerns_resolved_after_raised check (resolved_on is null or resolved_on >= raised_on)
);

create unique index learner_concerns_one_open_idx on public.learner_concerns (gta_id) where resolved_on is null;
create index learner_concerns_gta_id_idx on public.learner_concerns (gta_id, raised_on desc);
create index learner_concerns_raised_by_idx on public.learner_concerns (raised_by);
create index learner_concerns_reason_id_idx on public.learner_concerns (reason_id);
create index learner_concerns_resolved_by_idx on public.learner_concerns (resolved_by);

create trigger learner_concerns_reason_usage
  before insert or update of reason_id on public.learner_concerns
  for each row execute function public.enforce_reason_usage('concerns');

-- Only the resolution fields may change, and only once.
create or replace function public.learner_concerns_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if old.resolved_on is not null then
    raise exception 'A resolved concern cannot be changed' using errcode = '23514';
  end if;
  if (new.id, new.gta_id, new.raised_on, new.raised_by, new.reason_id, new.notes, new.created_at)
     is distinct from (old.id, old.gta_id, old.raised_on, old.raised_by, old.reason_id, old.notes, old.created_at) then
    raise exception 'A concern cannot be edited; resolve it and raise a new one' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger learner_concerns_guard
  before update on public.learner_concerns
  for each row execute function public.learner_concerns_guard();

alter table public.learner_concerns enable row level security;

create policy learner_concerns_select_admin_mgmt on public.learner_concerns
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));

revoke all on table public.learner_concerns from public, anon, authenticated;
grant select on table public.learner_concerns to authenticated;
grant select, insert, update, delete on table public.learner_concerns to service_role;

-- Read path for staff. Tutors never see notes on a safeguarding concern.
create or replace function public.get_learner_concerns(p_gta_id text default null)
returns table (
  id uuid, gta_id text, raised_on date, raised_by uuid, reason_id uuid, reason text, is_safeguarding boolean,
  notes text, resolved_on date, resolved_by uuid, resolution_note text, created_at timestamptz
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
  select c.id, c.gta_id, c.raised_on, c.raised_by, c.reason_id, r.label, coalesce(r.is_safeguarding, false),
         case when coalesce(r.is_safeguarding, false) and not v_full then null else c.notes end,
         c.resolved_on, c.resolved_by,
         case when coalesce(r.is_safeguarding, false) and not v_full then null else c.resolution_note end,
         c.created_at
  from public.learner_concerns c
  left join public.reasons r on r.id = c.reason_id
  where p_gta_id is null or c.gta_id = p_gta_id
  order by c.raised_on desc, c.created_at desc, c.id;
end;
$$;

revoke all on function public.learner_concerns_guard() from public, anon, authenticated;
grant execute on function public.learner_concerns_guard() to service_role;
revoke all on function public.get_learner_concerns(text) from public, anon;
grant execute on function public.get_learner_concerns(text) to authenticated, service_role;
