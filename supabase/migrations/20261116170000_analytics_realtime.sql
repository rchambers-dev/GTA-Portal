-- Let Analytics hear row changes. The page subscribes to these tables and
-- loads again after a short pause. Nothing here changes stored data.
-- Apply this in the SQL editor after review. Do not run it against production
-- from a test.
--
-- It adds the tables Analytics reads, and the learner, review, plan, concern
-- and candidate tables whose edits change those numbers, to the
-- supabase_realtime publication. Until this is applied, the page still loads
-- fresh data on each visit, but it cannot hear a change while it is open.

alter publication supabase_realtime add table
  public.apprentices,
  public.apprentice_employments,
  public.apprentice_tutors,
  public.apprentice_safeguarding_signoffs,
  public.breaks_in_learning,
  public.learner_concerns,
  public.employers,
  public.programmes,
  public.profiles,
  public.reviews,
  public.review_packs,
  public.review_pack_events,
  public.review_bookings,
  public.review_day_stops,
  public.candidates;
