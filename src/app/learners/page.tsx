import { listLearnerSearchHits } from "@/adapters/fictional";
import { LearnerPackSearchScreen } from "@/features/learner-lifecycle";
import { requireLearnerWorkspaceAccess } from "@/shell/guards/learner-routes";

/**
 * Blank search entry for the shared ADM14 learner file pack.
 * Selecting a learner opens `/learners/[learnerId]`.
 */
export default async function LearnersIndexPage() {
  await requireLearnerWorkspaceAccess("/learners");
  const learners = listLearnerSearchHits();

  return (
    <LearnerPackSearchScreen learners={learners} fromContext="learners" />
  );
}
