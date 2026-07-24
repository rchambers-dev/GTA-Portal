import { redirect } from "next/navigation";
import { requireMentorWorkspace } from "@/shell/guards/mentor-workspace";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Progress Mentor "Learners" nav uses the shared pack search entry.
 * Avoids a second caseload page duplicating learner pack information.
 */
export default async function MentorLearnersPage({ searchParams }: Props) {
  await requireMentorWorkspace("/workspaces/progress-mentor/learners");
  const params = await searchParams;
  const from = params.from === "lifecycle" ? "?from=lifecycle" : "";
  redirect(`/learners${from}`);
}
