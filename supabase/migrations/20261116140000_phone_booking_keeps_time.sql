-- A phone review can keep the day and the 9:00–10:00 time.
-- The old rule refused any appointment date on a phone booking, so Book
-- Appointment rolled back. A phone booking that only has a weekday is still
-- allowed. Apply this in the SQL editor after review. Do not run it against
-- production from a test.

alter table public.review_bookings drop constraint review_bookings_no_appointment_for_phone;

alter table public.review_bookings add constraint review_bookings_phone_slot check (
  method <> 'phone'
  or (
    phone_day is not null
    and (
      (appointment_on is null and appointment_minutes is null)
      or (
        appointment_on is not null
        and appointment_minutes is not null
        and appointment_minutes >= 540
        and appointment_minutes + 20 <= 600
        and (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])[extract(isodow from appointment_on)::int] = phone_day
      )
    )
  )
);
