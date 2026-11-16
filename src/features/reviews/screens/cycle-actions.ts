"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canAddApprentice } from "@/features/administration/domain/apprentice-record";
import { londonToday } from "@/features/administration/domain/apprentice-tutor";
import { formPayload, type TutorFormDraft } from "../domain/tutor-form-rules";
import { revalidateAnalytics } from "../domain/revalidate-analytics";

const DENIED = "You do not have permission to change this. Administrator and Management can.";

function fail(error: { message?: string; code?: string } | null, missing?: string) {
  if (!error) return null;
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message || "")) {
    return { ok: false as const, formError: missing || "This change is waiting for the database migration Reiss needs to approve." };
  }
  return { ok: false as const, formError: error.message || "That could not be saved." };
}

export async function signSafeguardingAction(input: { gtaIds: string[] }) {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false as const, formError: "Sign in again to sign safeguarding." };
  if (!canAddApprentice(session)) return { ok: false as const, formError: DENIED };
  const ids = [...new Set(input.gtaIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return { ok: false as const, formError: "Choose at least one apprentice." };
  const supabase = await createSupabaseServerClient();
  const { error, data } = await supabase.rpc("record_cycle_safeguarding", { p_gta_ids: ids });
  const blocked = fail(
    error,
    "Safeguarding sign-off is waiting for the one-way database change. It has not been written.",
  );
  if (blocked) return blocked;
  await revalidateAnalytics();
  return { ok: true as const, signed: typeof data === "number" ? data : ids.length, date: londonToday() };
}

export async function setReviewerAction(input: { reviewId: string; reviewerId: string }) {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false as const, formError: "Sign in again to change the reviewer." };
  if (!canAddApprentice(session)) return { ok: false as const, formError: DENIED };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_open_review_reviewer", {
    p_review_id: input.reviewId,
    p_reviewer_id: input.reviewerId,
  });
  const blocked = fail(error, "Changing the reviewer is waiting for the database change. It has not been written.");
  if (blocked) return blocked;
  await revalidateAnalytics();
  return { ok: true as const };
}

async function tutorWriter() {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false as const, formError: "Sign in again to save the review." };
  const role = session.account.baseRole;
  if (role !== "Tutor" && role !== "Administrator" && role !== "Management") {
    return { ok: false as const, formError: "Only the apprentice's tutor can save this review." };
  }
  return { ok: true as const, supabase: await createSupabaseServerClient() };
}

export async function saveTutorFormAction(input: { packId: string; form: TutorFormDraft }) {
  const access = await tutorWriter();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("save_review_tutor_form", {
    p_pack_id: input.packId,
    p_payload: formPayload(input.form),
  });
  const blocked = fail(error);
  if (blocked) return blocked;
  await revalidateAnalytics();
  return { ok: true as const };
}

export async function submitTutorFormAction(input: { packId: string; form: TutorFormDraft }) {
  const access = await tutorWriter();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("submit_review_tutor_form", {
    p_pack_id: input.packId,
    p_payload: formPayload(input.form),
  });
  const blocked = fail(error);
  if (blocked) return blocked;
  await revalidateAnalytics();
  return { ok: true as const };
}

export async function releaseReviewToTutorAction(input: { packId: string }) {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false as const, formError: "Sign in again to send this review to the tutor." };
  if (!canAddApprentice(session)) return { ok: false as const, formError: DENIED };
  const packId = input.packId.trim();
  if (!packId) return { ok: false as const, formError: "Choose a review to send." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("release_review_to_tutor", { p_pack_id: packId, p_note: null });
  const blocked = fail(error, "Sending a review to the tutor is waiting for the database change. Nothing was sent.");
  if (blocked) return blocked;
  await revalidateAnalytics();
  return { ok: true as const };
}
