import { redirect } from "next/navigation";
import { getStandalonePorts } from "@/adapters/standalone";
import { reviewAssistantAccess } from "@/features/review-assistant/access";
import { ReviewOriginalHost } from "@/features/review-assistant/ReviewOriginalHost";
import { loadReviewApprentices, loadReviewStaff } from "@/features/review-assistant/portal-roster";
import { reviewAssistantFragment } from "@/features/review-assistant/review-document";
import { pageApiAllowed } from "@/features/staff-page-access/enforce";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";

export default async function OriginalReviewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) redirect(getUnauthenticatedRedirect("/reviews/learners"));
  assertRouteAccess(session, "/reviews/learners");
  if (reviewAssistantAccess(session) === "denied") redirect("/staff/dashboard");
  if (!pageApiAllowed(session, "/reviews/learners", "read").ok) redirect("/staff/dashboard");
  const access = reviewAssistantAccess(session);
  return (
    <>
      <ReviewOriginalHost
        html={reviewAssistantFragment()}
        session={{
          access_token: "portal-session",
          user: {
            id: session.account.id,
            email: session.account.email,
            app_metadata: {
              role: access === "office" ? "admin" : "tutor",
              password_changed: true,
            },
          },
        }}
        staff={await loadReviewStaff(session)}
        apprentices={await loadReviewApprentices(session)}
      />
      {children}
    </>
  );
}
