import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";
import { ManagementAuditScreen } from "@/shell/workspaces/ManagementAuditScreen";

export default async function ManagementAuditPage() {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect("/management/audit"));

  assertRouteAccess(session, "/management/audit");
  return <ManagementAuditScreen />;
}
