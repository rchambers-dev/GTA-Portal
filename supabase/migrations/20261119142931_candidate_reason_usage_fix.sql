-- Already applied on cjtgjxgghfiskqnuttzd as version 20261119142931.
-- Recorded so the repo matches production. Do not apply this again.

create or replace function public.enforce_candidate_reason_usage()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.reasons%rowtype;
begin
  if new.status_reason_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status_reason_id is not distinct from old.status_reason_id then
    return new;
  end if;
  select * into r from public.reasons where id = new.status_reason_id;
  if not found then
    raise exception 'Reason not found' using errcode = '22023';
  end if;
  if not r.active then
    raise exception 'Reason "%" is not active', r.label using errcode = '22023';
  end if;
  if not r.used_for_candidates then
    raise exception 'Reason "%" cannot be used for candidates', r.label using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists candidates_reason on public.candidates;
create trigger candidates_reason
  before insert or update of status_reason_id on public.candidates
  for each row execute function public.enforce_candidate_reason_usage();

revoke execute on function public.enforce_candidate_reason_usage() from public, anon, authenticated;
grant execute on function public.enforce_candidate_reason_usage() to postgres, service_role;
