import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { ApprenticeSupportScreen } from "@/features/apprentice-portal";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";

export default async function EmployerSupportPage() {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect("/employer/support"));

  assertRouteAccess(session, "/employer/support");
  return <ApprenticeSupportScreen audience="employer" />;
}
