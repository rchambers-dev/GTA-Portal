-- release_review_pack_hold takes an optional note, recorded on the hold_released event and its audit row
-- (e.g. why the hold was lifted). The old one-argument function is replaced; calling it with just the pack still works.
drop function if exists public.release_review_pack_hold(uuid);

create or replace function public.release_review_pack_hold(p_pack_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pack public.review_packs%rowtype;
  v_note text := nullif(btrim(p_note), '');
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if v_pack.hold_reason is null then
    return;
  end if;
  update public.review_packs set hold_reason = null, held_until = null where id = p_pack_id;
  perform public.review_pack_record(p_pack_id, 'hold_released', null, 'user', false, now(),
    jsonb_build_object('reason', v_pack.hold_reason, 'held_until', v_pack.held_until, 'note', v_note));
end;
$$;

revoke all on function public.release_review_pack_hold(uuid, text) from public, anon;
grant execute on function public.release_review_pack_hold(uuid, text) to authenticated, service_role;
