import { Suspense } from "react";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { loadApprenticeLearner } from "../domain/apprentice-tutor-repository";
import { canAssignApprenticeTutor } from "../domain/apprentice-tutor";
import { ApprenticeLearnerView } from "./ApprenticeLearnerView";

/**
 * Onboarding → one apprentice.
 * Loads and saves through the signed-in Supabase session so RLS applies.
 */
export async function ApprenticeLearnerScreen({
  workspace,
  gtaId,
}: {
  workspace: "administration" | "management";
  gtaId: string;
}) {
  const [session, page] = await Promise.all([
    getSupabaseEffectiveSession(),
    loadApprenticeLearner(gtaId),
  ]);

  return (
    <Suspense fallback={null}>
      <ApprenticeLearnerView
        workspace={workspace}
        canAssign={canAssignApprenticeTutor(session)}
        page={page}
      />
    </Suspense>
  );
}
