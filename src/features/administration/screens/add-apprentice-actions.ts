"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { insertApprenticeRecord } from "../domain/apprentice-repository";
import {
  canAddApprentice,
  validateNewApprentice,
  type AddApprenticeResult,
  type NewApprenticeInput,
} from "../domain/apprentice-record";
import { revalidateAnalytics } from "@/features/reviews/domain/revalidate-analytics";

const PERMISSION_ERROR =
  "You do not have permission to add an apprentice. Administrator and Management can add apprentices.";

export async function addApprenticeAction(
  input: NewApprenticeInput,
): Promise<AddApprenticeResult> {
  const session = await getSupabaseEffectiveSession();
  if (!session) {
    return {
      ok: false,
      fieldErrors: {},
      formError: "Sign in again to add an apprentice.",
    };
  }
  if (!canAddApprentice(session)) {
    return { ok: false, fieldErrors: {}, formError: PERMISSION_ERROR };
  }

  const parsed = validateNewApprentice(input);
  if (!parsed.ok) {
    return { ok: false, fieldErrors: parsed.fieldErrors, formError: null };
  }

  const supabase = await createSupabaseServerClient();
  const saved = await insertApprenticeRecord(supabase, parsed.value);
  if (saved.ok) await revalidateAnalytics();
  return saved;
}
