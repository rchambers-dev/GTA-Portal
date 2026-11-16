"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import {
  canAddApprentice,
  explainApprenticeWriteError,
  isAssignedGtaId,
} from "../domain/apprentice-record";
import { validateContactPhone } from "../domain/uk-phone";

export type SetApprenticePhoneResult =
  | { ok: true; phone: string | null }
  | { ok: false; fieldError: string | null; formError: string | null };

export async function setApprenticePhoneAction(input: {
  gtaId: string;
  phone: string;
}): Promise<SetApprenticePhoneResult> {
  const session = await getSupabaseEffectiveSession();
  if (!session) {
    return { ok: false, fieldError: null, formError: "Sign in again to change this phone number." };
  }
  if (!canAddApprentice(session)) {
    return {
      ok: false,
      fieldError: null,
      formError: "You do not have permission to change this phone number. Administrator and Management can.",
    };
  }
  if (!isAssignedGtaId(input.gtaId)) {
    return { ok: false, fieldError: null, formError: "That apprentice could not be found." };
  }
  const parsed = validateContactPhone(input.phone);
  if (!parsed.ok) return { ok: false, fieldError: parsed.error, formError: null };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("apprentices").update({ phone: parsed.phone }).eq("gta_id", input.gtaId);
  if (error) {
    const explained = explainApprenticeWriteError(error);
    return {
      ok: false,
      fieldError: explained.fieldErrors.phone ?? null,
      formError: explained.fieldErrors.phone ? null : explained.formError,
    };
  }
  return { ok: true, phone: parsed.phone };
}
