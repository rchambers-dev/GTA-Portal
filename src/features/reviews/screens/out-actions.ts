"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canAddApprentice } from "@/features/administration/domain/apprentice-record";
import { revalidatePath } from "next/cache";

const DENIED = "You do not have permission to change the visit round. Administrator and Management can.";

async function writer() {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false as const, formError: "Sign in again to change the visit round." };
  if (!canAddApprentice(session)) return { ok: false as const, formError: DENIED };
  return { ok: true as const, supabase: await createSupabaseServerClient() };
}

function missing(error: { message?: string; code?: string } | null, name: string) {
  if (!error) return null;
  if (error.code === "PGRST202" || (error.message || "").includes(name)) {
    return { ok: false as const, formError: "That visit change is in the migration and is not on the database yet." };
  }
  return { ok: false as const, formError: error.message || "The visit could not be saved." };
}

export async function stampVisitAction(input: { date: string; gtaId: string; kind: "arrive" | "leave" }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("stamp_review_visit", {
    p_date: input.date,
    p_gta_id: input.gtaId,
    p_kind: input.kind,
  });
  const failed = missing(error, "stamp_review_visit");
  if (failed) return failed;
  revalidatePath("/administration/reviews/out");
  revalidatePath("/management/reviews/out");
  return { ok: true as const };
}

export async function saveOutSignatureAction(input: { packId: string; party: "apprentice" | "employer" | "reviewer"; name: string; image: string }) {
  const access = await writer();
  if (!access.ok) return access;
  const { error } = await access.supabase.rpc("record_review_signature", {
    p_pack_id: input.packId,
    p_party: input.party,
    p_signer_name: input.name,
    p_signature_image: input.image,
  });
  if (error) return { ok: false as const, formError: error.message || "The signature could not be saved." };
  revalidatePath("/administration/reviews/out");
  revalidatePath("/management/reviews/out");
  return { ok: true as const };
}
