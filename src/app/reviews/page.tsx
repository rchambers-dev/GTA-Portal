import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { reviewAssistantAccess } from "@/features/review-assistant/access";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";

export default async function ReviewsQueuePage() {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect("/reviews"));
  assertRouteAccess(session, "/reviews");
  if (reviewAssistantAccess(session) !== "denied") redirect("/reviews/learners");
  redirect("/staff/dashboard");
}
