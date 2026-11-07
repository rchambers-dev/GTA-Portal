import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { EmployerDirectoryScreen } from "@/features/employer-directory";
import { canManageEmployerDirectory } from "@/features/employer-directory/server/access";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { getRedirectForDeniedRoute } from "@/lib/permissions/route-access";
import { assertRouteAccess } from "@/shell/guards/require-route-access";

export default async function EmployerDirectoryPage() {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect("/reviews/employer-directory"));
  assertRouteAccess(session, "/reviews/employer-directory");
  if (!canManageEmployerDirectory(session)) {
    redirect(getRedirectForDeniedRoute(session, "/reviews/employer-directory"));
  }
  return <EmployerDirectoryScreen eyebrow="Reviews" />;
}
