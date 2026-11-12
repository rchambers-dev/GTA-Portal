-- One-off. Apply AFTER supabase/migrations/20261112211000_review_note_until.sql.
-- Copies the three Review Assistant plan notes onto the open reviews.
-- Do not put this file in supabase/migrations. Run it once by hand.

update public.reviews
   set notes = 'Check on the day too see if its ok',
       notes_until = date '2026-11-13'
 where gta_id = 'GTA-000026'
   and status = 'open';

update public.reviews
   set notes = 'This is going to be done by Mark Hadfield, Anne-Marie. they do need too let me know when they complete the review',
       notes_until = date '2026-11-17'
 where gta_id = 'GTA-000041'
   and status = 'open';

update public.reviews
   set notes = 'Do this next week',
       notes_until = date '2026-11-23'
 where gta_id = 'GTA-000027'
   and status = 'open';
