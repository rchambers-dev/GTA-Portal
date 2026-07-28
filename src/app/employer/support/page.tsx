import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { LearnerSupportScreen } from "@/features/learner-portal";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";

export default async function EmployerSupportPage() {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect("/employer/support"));

  assertRouteAccess(session, "/employer/support");
  return <LearnerSupportScreen audience="employer" />;
}
