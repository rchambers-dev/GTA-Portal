import { Suspense } from "react";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canManageApprenticeProgramme } from "../domain/apprentice-programme";
import { loadApprenticeProgramme } from "../domain/apprentice-programme-repository";
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
  const session = await getSupabaseEffectiveSession();
  const canManageProgramme = canManageApprenticeProgramme(session);
  const [page, programme] = await Promise.all([
    loadApprenticeLearner(gtaId),
    loadApprenticeProgramme(gtaId, { canManage: canManageProgramme }),
  ]);

  return (
    <Suspense fallback={null}>
      <ApprenticeLearnerView
        workspace={workspace}
        canAssign={canAssignApprenticeTutor(session)}
        canManageProgramme={canManageProgramme}
        page={page}
        programme={programme}
      />
    </Suspense>
  );
}
