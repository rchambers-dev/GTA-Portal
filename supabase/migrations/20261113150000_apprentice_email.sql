-- Optional contact email on an apprentice.
-- Existing policies stay as they are: Administrator and Management can read and
-- write every apprentice, and a Tutor can read only the apprentices they can
-- already see. Other apprentices have no access. The new column is covered by
-- those row policies and the table grants, the same way as the other learner fields.

alter table public.apprentices
  add column email text;

alter table public.apprentices
  add constraint apprentices_email_format
  check (
    email is null
    or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

create or replace function public.apprentices_normalise_email()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.email is not null then
    new.email := nullif(lower(btrim(new.email)), '');
  end if;
  return new;
end;
$$;

drop trigger if exists apprentices_normalise_email on public.apprentices;
create trigger apprentices_normalise_email
before insert or update of email on public.apprentices
for each row
execute function public.apprentices_normalise_email();

create unique index apprentices_email_lower_key
  on public.apprentices (lower(email))
  where email is not null;

comment on column public.apprentices.email is
  'Optional contact email, stored trimmed and lower case. Staff read and write it under the existing apprentice policies.';

revoke all on function public.apprentices_normalise_email() from public, anon;
grant execute on function public.apprentices_normalise_email() to authenticated, service_role;
