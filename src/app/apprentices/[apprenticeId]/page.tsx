import { ApprenticeWorkspaceClient } from "@/features/apprentice-lifecycle/components/ApprenticeWorkspaceClient";
import {
  getReturnLink,
  parseFromContext,
  parseApprenticeTab,
} from "@/features/shared-records";
import { getStandalonePorts } from "@/adapters/standalone";
import { requireApprenticeWorkspaceAccess } from "@/shell/guards/apprentice-routes";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

type Props = {
  params: Promise<{ apprenticeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApprenticePage({ params, searchParams }: Props) {
  const { apprenticeId } = await params;
  const query = await searchParams;
  await requireApprenticeWorkspaceAccess(`/apprentices/${apprenticeId}`);

  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  const workspace = await ports.data.getApprenticeWorkspace(apprenticeId);

  const activeTab = parseApprenticeTab(query.tab);
  const from = parseFromContext(query.from);
  const { href: returnHref, label: returnLabel } = getReturnLink(from);

  const canViewSupportDetail = session
    ? hasPermission(session, PERMISSIONS.SUPPORT_PLANS_MANAGE) ||
      hasPermission(session, PERMISSIONS.SAFEGUARDING_CONFIDENTIAL_VIEW)
    : false;

  return (
    <ApprenticeWorkspaceClient
      apprenticeId={apprenticeId}
      initialWorkspace={workspace}
      activeTab={activeTab}
      from={from}
      returnHref={returnHref}
      returnLabel={returnLabel}
      canViewSupportDetail={canViewSupportDetail}
    />
  );
}
