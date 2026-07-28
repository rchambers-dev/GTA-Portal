import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { getDefaultWorkspaceRoute } from "@/lib/permissions/workspace";

export default async function HomePage() {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) {
    redirect(getUnauthenticatedRedirect("/"));
  }
  redirect(getDefaultWorkspaceRoute(session.account.workspace, session));
}
