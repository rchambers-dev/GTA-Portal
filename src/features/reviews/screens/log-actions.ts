"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canAddApprentice } from "@/features/administration/domain/apprentice-record";

const DENIED = "You do not have permission to undo a review event. Administrator and Management can.";
const WAITING = "Undo is waiting for the database change Reiss needs to approve. Nothing was changed.";

export async function undoReviewPackEventAction(eventId: string) {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false as const, formError: "Sign in again to undo this event." };
  if (!canAddApprentice(session)) return { ok: false as const, formError: DENIED };
  const id = eventId.trim();
  if (!id) return { ok: false as const, formError: "Choose an event to undo." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("undo_review_pack_event", { p_event_id: id });
  if (!error) return { ok: true as const };
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message || "")) {
    return { ok: false as const, formError: WAITING };
  }
  return { ok: false as const, formError: error.message || "That event could not be undone." };
}
