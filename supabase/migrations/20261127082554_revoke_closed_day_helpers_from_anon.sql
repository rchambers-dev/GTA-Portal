-- Already applied live as version 20261127082554. Recorded so the repo matches.
-- Do not apply this again.

revoke all on function public.apprentice_open_weekdays(text) from public, anon;
revoke all on function public.assert_bookable_day(date, text) from public, anon;
revoke all on function public.calendar_closures_audit() from public, anon;
revoke all on function public.calendar_closures_guard() from public, anon;
revoke all on function public.closed_day_reason(date, text) from public, anon;
revoke all on function public.doncaster_centre_id() from public, anon;
revoke all on function public.is_open_day(date, text) from public, anon;
revoke all on function public.next_open_day(date, text) from public, anon;
revoke all on function public.note_first_review_closed(text, date) from public, anon;
revoke all on function public.previous_open_day(date, text) from public, anon;
revoke all on function public.review_bookings_closed_day() from public, anon;
revoke all on function public.review_is_immovable(uuid, text) from public, anon;
revoke all on function public.roll_planned_on(date, text) from public, anon;
revoke all on function public.week_is_excluded(date, text) from public, anon;
revoke all on function public.week_open_day_count(date, text) from public, anon;

grant execute on function public.apprentice_open_weekdays(text) to authenticated, service_role;
grant execute on function public.assert_bookable_day(date, text) to authenticated, service_role;
grant execute on function public.calendar_closures_audit() to authenticated, service_role;
grant execute on function public.calendar_closures_guard() to authenticated, service_role;
grant execute on function public.closed_day_reason(date, text) to authenticated, service_role;
grant execute on function public.doncaster_centre_id() to authenticated, service_role;
grant execute on function public.is_open_day(date, text) to authenticated, service_role;
grant execute on function public.next_open_day(date, text) to authenticated, service_role;
grant execute on function public.note_first_review_closed(text, date) to authenticated, service_role;
grant execute on function public.previous_open_day(date, text) to authenticated, service_role;
grant execute on function public.review_bookings_closed_day() to authenticated, service_role;
grant execute on function public.review_is_immovable(uuid, text) to authenticated, service_role;
grant execute on function public.roll_planned_on(date, text) to authenticated, service_role;
grant execute on function public.week_is_excluded(date, text) to authenticated, service_role;
grant execute on function public.week_open_day_count(date, text) to authenticated, service_role;
