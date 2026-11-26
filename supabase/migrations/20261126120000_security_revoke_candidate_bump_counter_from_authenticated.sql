-- Interstellar Security already applied this on live (cjtgjxgghfiskqnuttzd).
-- Recorded so the repo matches live. Do not apply it again if this version is already in schema_migrations.

revoke execute on function public.candidate_bump_counter(integer, text, uuid, text) from public, anon, authenticated;
grant execute on function public.candidate_bump_counter(integer, text, uuid, text) to service_role;
