-- Form templates are versioned separately from rounds.
-- A round keeps a pointer until invites are generated, then the questions are copied onto the round.

create table public.tutor_review_template_versions (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  is_default boolean not null default false,
  title text not null,
  intro text not null,
  rating_help text not null,
  scale jsonb not null,
  page_headings jsonb not null,
  created_at timestamptz not null default now(),
  constraint tutor_review_template_versions_label_key unique (label),
  constraint tutor_review_template_versions_scale_check check (jsonb_typeof(scale) = 'array' and jsonb_array_length(scale) = 5)
);

create unique index tutor_review_template_versions_one_default
  on public.tutor_review_template_versions (is_default)
  where is_default;

create table public.tutor_review_template_questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.tutor_review_template_versions (id) on delete cascade,
  page integer not null,
  position integer not null,
  code text not null,
  text text not null,
  help text,
  kind text not null,
  is_concern boolean not null default false,
  constraint tutor_review_template_questions_code_key unique (version_id, code),
  constraint tutor_review_template_questions_position_key unique (version_id, position),
  constraint tutor_review_template_questions_page_check check (page between 1 and 3),
  constraint tutor_review_template_questions_kind_check check (kind in ('rating_1_5', 'text'))
);

alter table public.tutor_review_rounds
  add column template_version_id uuid references public.tutor_review_template_versions (id),
  add column snapshotted_at timestamptz;

alter table public.tutor_review_template_versions enable row level security;
alter table public.tutor_review_template_questions enable row level security;

create policy tutor_review_template_versions_staff on public.tutor_review_template_versions
  for all to authenticated
  using ((select public.has_portal_role('Administrator', 'Management')))
  with check ((select public.has_portal_role('Administrator', 'Management')));
create policy tutor_review_template_questions_staff on public.tutor_review_template_questions
  for all to authenticated
  using ((select public.has_portal_role('Administrator', 'Management')))
  with check ((select public.has_portal_role('Administrator', 'Management')));

revoke all on public.tutor_review_template_versions, public.tutor_review_template_questions from public, anon;
grant select, insert, update, delete on public.tutor_review_template_versions, public.tutor_review_template_questions to authenticated, service_role;

insert into public.tutor_review_template_versions (label, is_default, title, intro, rating_help, scale, page_headings)
select 'v 13 Nov 2026', true, title, intro, rating_help, scale, page_headings
from public.tutor_review_rounds
where label = 'December 2026';

insert into public.tutor_review_template_questions (version_id, page, position, code, text, help, kind, is_concern)
select v.id, q.page, q.position, q.code, q.text, q.help, q.kind, q.is_concern
from public.tutor_review_template_versions v
join public.tutor_review_rounds r on r.label = 'December 2026'
join public.tutor_review_questions q on q.round_id = r.id
where v.label = 'v 13 Nov 2026';

update public.tutor_review_rounds
   set template_version_id = (select id from public.tutor_review_template_versions where label = 'v 13 Nov 2026')
 where label in ('December 2026', 'June 2027');

create or replace function public.snapshot_tutor_review_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_round public.tutor_review_rounds%rowtype;
begin
  if not public.has_portal_role('Administrator', 'Management') then
    raise exception 'You do not have permission to change tutor reviews.' using errcode = '42501';
  end if;
  select * into v_round from public.tutor_review_rounds where id = p_round_id for update;
  if not found then
    raise exception 'That round could not be found.' using errcode = 'P0002';
  end if;
  if v_round.snapshotted_at is not null then
    return;
  end if;
  if exists (select 1 from public.tutor_review_invites where round_id = p_round_id) then
    update public.tutor_review_rounds set snapshotted_at = now() where id = p_round_id and snapshotted_at is null;
    return;
  end if;
  if v_round.template_version_id is null then
    raise exception 'Choose a form template before sending invites.' using errcode = 'P0002';
  end if;

  delete from public.tutor_review_questions where round_id = p_round_id;
  insert into public.tutor_review_questions (round_id, page, position, code, text, help, kind, is_concern)
  select p_round_id, page, position, code, text, help, kind, is_concern
  from public.tutor_review_template_questions
  where version_id = v_round.template_version_id;

  update public.tutor_review_rounds r
     set title = v.title,
         intro = v.intro,
         rating_help = v.rating_help,
         scale = v.scale,
         page_headings = v.page_headings,
         snapshotted_at = now()
    from public.tutor_review_template_versions v
   where r.id = p_round_id
     and v.id = v_round.template_version_id;
end;
$$;

create or replace function public.enqueue_tutor_review_emails(
  p_round_id uuid,
  p_resend boolean,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_item jsonb;
  v_invite public.tutor_review_invites%rowtype;
  v_round public.tutor_review_rounds%rowtype;
  v_today date := (now() at time zone 'Europe/London')::date;
  v_queued integer := 0;
  v_skipped integer := 0;
begin
  if not public.has_portal_role('Administrator', 'Management') then
    raise exception 'You do not have permission to change tutor reviews.' using errcode = '42501';
  end if;
  perform public.snapshot_tutor_review_round(p_round_id);
  select * into v_round from public.tutor_review_rounds where id = p_round_id;
  if not found then
    raise exception 'That round could not be found.' using errcode = 'P0002';
  end if;
  if v_round.status = 'closed' or v_round.closed_early_at is not null or v_today > v_round.closes_on then
    raise exception 'Invites can be sent when a round is open or scheduled to open.' using errcode = '55000';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    begin
      select * into v_invite
        from public.tutor_review_invites
       where round_id = p_round_id and apprentice_id = v_item ->> 'apprenticeId'
       for update;
      if found and v_invite.used_at is not null then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      if nullif(btrim(coalesce(v_item ->> 'email', '')), '') is null then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      if found and exists (
        select 1 from public.tutor_review_email_attempts a
        where a.invite_id = v_invite.id
          and (
            a.status in ('queued', 'sending', 'sent', 'dry_run')
            or (not p_resend and a.status in ('failed', 'bounced'))
          )
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      if found then
        update public.tutor_review_invites
           set token_hash = v_item ->> 'tokenHash',
               tutor_id = (v_item ->> 'tutorId')::uuid
         where id = v_invite.id;
      else
        insert into public.tutor_review_invites (round_id, apprentice_id, tutor_id, token_hash)
        values (p_round_id, v_item ->> 'apprenticeId', (v_item ->> 'tutorId')::uuid, v_item ->> 'tokenHash')
        returning * into v_invite;
      end if;
      insert into public.tutor_review_email_attempts (invite_id, round_id, apprentice_id, email, status, dispatch_token)
      values (v_invite.id, p_round_id, v_item ->> 'apprenticeId', btrim(v_item ->> 'email'), 'queued', v_item ->> 'dispatchToken');
      v_queued := v_queued + 1;
    exception when unique_violation then
      v_skipped := v_skipped + 1;
    end;
  end loop;
  return jsonb_build_object('queued', v_queued, 'skipped', v_skipped);
end;
$$;

create or replace function public.save_tutor_review_template_version(
  p_label text,
  p_title text,
  p_intro text,
  p_rating_help text,
  p_scale jsonb,
  p_page_headings jsonb,
  p_questions jsonb,
  p_round_id uuid
) returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_position integer := 0;
  v_round public.tutor_review_rounds%rowtype;
begin
  if not public.has_portal_role('Administrator', 'Management') then
    raise exception 'You do not have permission to change tutor reviews.' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_label, '')), '') is null then
    raise exception 'Give this version a name.' using errcode = '22023';
  end if;
  insert into public.tutor_review_template_versions (label, is_default, title, intro, rating_help, scale, page_headings)
  values (btrim(p_label), false, btrim(p_title), btrim(p_intro), btrim(p_rating_help), p_scale, p_page_headings)
  returning id into v_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_position := v_position + 1;
    insert into public.tutor_review_template_questions (version_id, page, position, code, text, help, kind, is_concern)
    values (
      v_id,
      (v_item ->> 'page')::integer,
      v_position,
      v_item ->> 'code',
      btrim(v_item ->> 'text'),
      nullif(btrim(coalesce(v_item ->> 'help', '')), ''),
      v_item ->> 'kind',
      coalesce((v_item ->> 'isConcern')::boolean, false)
    );
  end loop;
  update public.tutor_review_template_versions set is_default = false where id <> v_id;
  update public.tutor_review_template_versions set is_default = true where id = v_id;
  if p_round_id is not null then
    select * into v_round from public.tutor_review_rounds where id = p_round_id;
    if found and v_round.snapshotted_at is null then
      update public.tutor_review_rounds set template_version_id = v_id where id = p_round_id;
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.set_tutor_review_template_default(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.has_portal_role('Administrator', 'Management') then
    raise exception 'You do not have permission to change tutor reviews.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tutor_review_template_versions where id = p_version_id) then
    raise exception 'That version could not be found.' using errcode = 'P0002';
  end if;
  update public.tutor_review_template_versions set is_default = false where is_default;
  update public.tutor_review_template_versions set is_default = true where id = p_version_id;
end;
$$;

create or replace function public.set_tutor_review_round_template(p_round_id uuid, p_version_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_round public.tutor_review_rounds%rowtype;
begin
  if not public.has_portal_role('Administrator', 'Management') then
    raise exception 'You do not have permission to change tutor reviews.' using errcode = '42501';
  end if;
  select * into v_round from public.tutor_review_rounds where id = p_round_id;
  if not found then
    raise exception 'That round could not be found.' using errcode = 'P0002';
  end if;
  if v_round.snapshotted_at is not null then
    raise exception 'This round already has a saved copy of the form from when invites were generated.' using errcode = '55000';
  end if;
  update public.tutor_review_rounds set template_version_id = p_version_id where id = p_round_id;
end;
$$;

revoke all on function public.snapshot_tutor_review_round(uuid) from public, anon;
revoke all on function public.save_tutor_review_template_version(text, text, text, text, jsonb, jsonb, jsonb, uuid) from public, anon;
revoke all on function public.set_tutor_review_template_default(uuid) from public, anon;
revoke all on function public.set_tutor_review_round_template(uuid, uuid) from public, anon;
grant execute on function public.snapshot_tutor_review_round(uuid) to authenticated, service_role;
grant execute on function public.save_tutor_review_template_version(text, text, text, text, jsonb, jsonb, jsonb, uuid) to authenticated, service_role;
grant execute on function public.set_tutor_review_template_default(uuid) to authenticated, service_role;
grant execute on function public.set_tutor_review_round_template(uuid, uuid) to authenticated, service_role;
