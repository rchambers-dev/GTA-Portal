import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";

/** Draft route from an earlier slice. Apprentices are added on Apprentice Intake. */
export default async function RetiredReviewLearnersPage() {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect("/reviews/learners"));
  assertRouteAccess(session, "/reviews/learners");
  if (session.account.workspace === "management") redirect("/management/intake");
  redirect("/administration/intake");
}
