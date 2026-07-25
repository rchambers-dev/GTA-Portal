import { listLearnerSearchHits } from "@/adapters/fictional";
import { LearnerPackSearchScreen } from "@/features/learner-lifecycle";
import { requireLearnerWorkspaceAccess } from "@/shell/guards/learner-routes";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Blank search entry for the shared learner file pack.
 * Selecting a learner opens `/learners/[learnerId]`.
 * Used from Progress Mentor, Administration, and other workspaces.
 */
export default async function LearnersIndexPage({ searchParams }: Props) {
  await requireLearnerWorkspaceAccess("/learners");
  const params = await searchParams;
  const fromRaw = params.from;
  const from =
    typeof fromRaw === "string" && fromRaw.trim()
      ? fromRaw.trim()
      : "learners";
  const learners = listLearnerSearchHits();

  return <LearnerPackSearchScreen learners={learners} fromContext={from} />;
}
