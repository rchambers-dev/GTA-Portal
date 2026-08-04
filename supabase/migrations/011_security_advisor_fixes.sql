-- Security Advisor fixes:
-- 1) Immutable search_path on public.touch_updated_at
-- 2) Revoke client EXECUTE on public.rls_auto_enable (event-trigger only)
-- 3) Explicit deny policies + revoke client grants on service-role-only tables

-- ---------------------------------------------------------------------------
-- touch_updated_at: pin search_path (function_search_path_mutable)
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public;
revoke all on function public.touch_updated_at() from anon, authenticated;
grant execute on function public.touch_updated_at() to postgres, service_role;

-- ---------------------------------------------------------------------------
-- rls_auto_enable: keep event trigger, remove client callable EXECUTE
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public;
    revoke all on function public.rls_auto_enable() from anon, authenticated, service_role;
    grant execute on function public.rls_auto_enable() to postgres;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Service-role-only tables: keep RLS, add deny policies, revoke client grants
-- (writes go through service_role which bypasses RLS)
-- ---------------------------------------------------------------------------
alter table if exists public.audit_events enable row level security;
alter table if exists public.proxy_write_audit enable row level security;
alter table if exists public.schema_migrations enable row level security;

drop policy if exists audit_events_no_client_access on public.audit_events;
create policy audit_events_no_client_access
on public.audit_events
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists proxy_write_audit_no_client_access on public.proxy_write_audit;
create policy proxy_write_audit_no_client_access
on public.proxy_write_audit
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists schema_migrations_no_client_access on public.schema_migrations;
create policy schema_migrations_no_client_access
on public.schema_migrations
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

revoke all on table public.audit_events from anon, authenticated;
revoke all on table public.proxy_write_audit from anon, authenticated;
revoke all on table public.schema_migrations from anon, authenticated;

grant all on table public.audit_events to postgres, service_role;
grant all on table public.proxy_write_audit to postgres, service_role;
grant all on table public.schema_migrations to postgres, service_role;
