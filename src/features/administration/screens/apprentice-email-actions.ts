"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import {
  canAddApprentice,
  explainApprenticeWriteError,
  validateApprenticeEmail,
} from "../domain/apprentice-record";
import { isAssignedGtaId } from "../domain/apprentice-record";

export type SetApprenticeEmailResult =
  | { ok: true; email: string | null }
  | { ok: false; fieldError: string | null; formError: string | null };

export async function setApprenticeEmailAction(input: {
  gtaId: string;
  email: string;
}): Promise<SetApprenticeEmailResult> {
  const session = await getSupabaseEffectiveSession();
  if (!session) {
    return { ok: false, fieldError: null, formError: "Sign in again to change this email." };
  }
  if (!canAddApprentice(session)) {
    return {
      ok: false,
      fieldError: null,
      formError: "You do not have permission to change this email. Administrator and Management can.",
    };
  }
  if (!isAssignedGtaId(input.gtaId)) {
    return { ok: false, fieldError: null, formError: "That apprentice could not be found." };
  }
  const parsed = validateApprenticeEmail(input.email);
  if (!parsed.ok) return { ok: false, fieldError: parsed.error, formError: null };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("apprentices").update({ email: parsed.email }).eq("gta_id", input.gtaId);
  if (error) {
    const explained = explainApprenticeWriteError(error);
    return {
      ok: false,
      fieldError: explained.fieldErrors.email ?? null,
      formError: explained.fieldErrors.email ? null : explained.formError,
    };
  }
  return { ok: true, email: parsed.email };
}
