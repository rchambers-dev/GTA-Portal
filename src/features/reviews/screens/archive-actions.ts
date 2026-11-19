"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canAddApprentice } from "@/features/administration/domain/apprentice-record";

async function writer() {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false as const, formError: "Sign in again to change the archive." };
  if (!canAddApprentice(session)) {
    return { ok: false as const, formError: "You do not have permission to change the archive. Administrator and Management can." };
  }
  return { ok: true as const, supabase: await createSupabaseServerClient() };
}

function missing(error: { message?: string; code?: string } | null, name: string) {
  if (!error) return null;
  if (error.code === "PGRST202" || (error.message || "").includes(name) || (error.message || "").includes("shelved_at")) {
    return { ok: false as const, formError: "Moving a review to the archive is in the migration and is not on the database yet." };
  }
  return { ok: false as const, formError: error.message || "The archive could not be saved." };
}

function refresh() {
  revalidatePath("/administration/reviews/archive");
  revalidatePath("/management/reviews/archive");
  revalidatePath("/administration/reviews/cycle");
  revalidatePath("/management/reviews/cycle");
}

export async function shelveReviewAction(input: { reviewId: string }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("shelve_completed_review", { p_review_id: input.reviewId });
  const failed = missing(error, "shelve_completed_review");
  if (failed) return failed;
  refresh();
  return { ok: true as const };
}

export async function restoreReviewAction(input: { reviewId: string }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("restore_completed_review", { p_review_id: input.reviewId });
  const failed = missing(error, "restore_completed_review");
  if (failed) return failed;
  refresh();
  return { ok: true as const };
}
