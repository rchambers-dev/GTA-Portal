-- Found by the rolled-back test: a NULL arrival time slipped past the "both or neither" check (NULL between 0 and 1439 is NULL, which a CHECK accepts).
alter table public.review_bookings drop constraint review_bookings_appointment_consistent;
alter table public.review_bookings add constraint review_bookings_appointment_consistent check (
  (appointment_on is null and appointment_minutes is null)
  or (appointment_on is not null and appointment_minutes is not null and appointment_minutes between 0 and 1439)
);
