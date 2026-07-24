import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { assertRouteAccess } from "@/shell/guards/require-route-access";
import { ManagementRolesScreen } from "@/shell/workspaces/ManagementRolesScreen";

export default async function ManagementRolesPage() {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) redirect("/");

  assertRouteAccess(session, "/management/roles");
  return <ManagementRolesScreen />;
}
