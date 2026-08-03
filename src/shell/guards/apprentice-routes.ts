import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";

export async function requireApprenticeWorkspaceAccess(pathname: string): Promise<void> {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect(pathname));
  assertRouteAccess(session, pathname);
}
