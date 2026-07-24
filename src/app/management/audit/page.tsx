import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { assertRouteAccess } from "@/shell/guards/require-route-access";
import { ManagementAuditScreen } from "@/shell/workspaces/ManagementAuditScreen";

export default async function ManagementAuditPage() {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) redirect("/");

  assertRouteAccess(session, "/management/audit");
  return <ManagementAuditScreen />;
}
