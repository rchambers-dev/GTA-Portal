import { redirect } from "next/navigation";
import { learnerRecordHref } from "@/features/shared-records";
import { requireLearnerWorkspaceAccess } from "@/shell/guards/learner-routes";

type Props = {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LearnerActionsRedirect({
  params,
  searchParams,
}: Props) {
  const { learnerId } = await params;
  const query = await searchParams;
  await requireLearnerWorkspaceAccess(`/learners/${learnerId}`);
  const from = typeof query.from === "string" ? query.from : "lifecycle";
  redirect(learnerRecordHref(learnerId, { tab: "actions", from }));
}
