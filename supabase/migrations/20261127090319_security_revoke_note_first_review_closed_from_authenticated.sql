-- Already applied live on cjtgjxgghfiskqnuttzd as version 20261127090319
-- (approved by Reiss, 27 Nov 09:03 GMT). Must not be re-applied.
-- Rollback: grant execute on function public.note_first_review_closed(text, date) to authenticated;

revoke execute on function public.note_first_review_closed(text, date) from authenticated;
