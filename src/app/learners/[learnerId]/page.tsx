import { notFound } from "next/navigation";
import { LearnerWorkspaceScreen } from "@/features/learner-lifecycle";
import {
  getReturnLink,
  parseFromContext,
  parseLearnerTab,
} from "@/features/shared-records";
import { getStandalonePorts } from "@/adapters/standalone";
import { requireLearnerWorkspaceAccess } from "@/shell/guards/learner-routes";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

type Props = {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LearnerPage({ params, searchParams }: Props) {
  const { learnerId } = await params;
  const query = await searchParams;
  await requireLearnerWorkspaceAccess(`/learners/${learnerId}`);

  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  const workspace = await ports.data.getLearnerWorkspace(learnerId);
  if (!workspace) notFound();

  const activeTab = parseLearnerTab(query.tab);
  const from = parseFromContext(query.from);
  const { href: returnHref, label: returnLabel } = getReturnLink(from);

  const canViewSupportDetail = session
    ? hasPermission(session, PERMISSIONS.SUPPORT_PLANS_MANAGE) ||
      hasPermission(session, PERMISSIONS.SAFEGUARDING_CONFIDENTIAL_VIEW)
    : false;

  return (
    <LearnerWorkspaceScreen
      workspace={workspace}
      activeTab={activeTab}
      from={from}
      returnHref={returnHref}
      returnLabel={returnLabel}
      canViewSupportDetail={canViewSupportDetail}
    />
  );
}
