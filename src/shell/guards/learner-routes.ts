import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { assertRouteAccess } from "@/shell/guards/require-route-access";

export async function requireLearnerWorkspaceAccess(pathname: string): Promise<void> {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) redirect("/");
  assertRouteAccess(session, pathname);
}
