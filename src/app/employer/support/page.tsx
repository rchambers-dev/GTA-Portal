import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { assertRouteAccess } from "@/shell/guards/require-route-access";
import { EmployerSupportScreen } from "@/shell/workspaces/EmployerSupportScreen";

export default async function EmployerSupportPage() {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) redirect("/");

  assertRouteAccess(session, "/employer/support");
  return <EmployerSupportScreen />;
}
