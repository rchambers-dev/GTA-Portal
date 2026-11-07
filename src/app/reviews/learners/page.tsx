import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { ReviewLearnersScreen } from "@/features/employer-directory";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";

export default async function ReviewLearnersPage() {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect("/reviews/learners"));
  assertRouteAccess(session, "/reviews/learners");
  return <ReviewLearnersScreen eyebrow="Reviews" />;
}
