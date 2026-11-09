"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { assignApprenticeTutor } from "../domain/apprentice-tutor-repository";
import {
  canAssignApprenticeTutor,
  londonToday,
  validateTutorAssignment,
  type AssignTutorResult,
} from "../domain/apprentice-tutor";

const PERMISSION_ERROR =
  "You do not have permission to change the tutor. Administrator and Management can assign a tutor.";

export async function assignApprenticeTutorAction(input: {
  gtaId: string;
  tutorId: string;
}): Promise<AssignTutorResult> {
  const session = await getSupabaseEffectiveSession();
  if (!session) {
    return { ok: false, formError: "Sign in again to change the tutor." };
  }
  if (!canAssignApprenticeTutor(session)) {
    return { ok: false, formError: PERMISSION_ERROR };
  }

  const parsed = validateTutorAssignment(input);
  if (!parsed.ok) return { ok: false, formError: parsed.formError };

  const supabase = await createSupabaseServerClient();
  return assignApprenticeTutor(supabase, parsed.value, londonToday());
}
