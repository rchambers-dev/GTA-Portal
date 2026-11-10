"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canManageApprenticeProgramme } from "../domain/apprentice-programme";
import { recordLearnerExit, reverseLearnerExit } from "../domain/learner-exit-repository";
import { EXIT_PERMISSION_ERROR, type ExitActionResult } from "../domain/learner-exit";
import { londonToday } from "../domain/apprentice-tutor";

const SIGN_IN_ERROR = "Sign in again to change an exit.";

async function authorised(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> }
  | { ok: false; formError: string }
> {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false, formError: SIGN_IN_ERROR };
  if (!canManageApprenticeProgramme(session)) {
    return { ok: false, formError: EXIT_PERMISSION_ERROR };
  }
  return { ok: true, supabase: await createSupabaseServerClient() };
}

export async function recordLearnerExitAction(input: {
  gtaId: string;
  exitType: string;
  exitDate: string;
  reasonId: string;
  notes: string;
}): Promise<ExitActionResult> {
  const access = await authorised();
  if (!access.ok) return access;
  return recordLearnerExit(access.supabase, { ...input, today: londonToday() });
}

export async function reverseLearnerExitAction(input: {
  exitId: string;
  note: string;
}): Promise<ExitActionResult> {
  const access = await authorised();
  if (!access.ok) return access;
  return reverseLearnerExit(access.supabase, input);
}
