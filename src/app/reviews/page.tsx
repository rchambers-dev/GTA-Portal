import { redirect } from "next/navigation";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { loadDigitalReview, loadPackTutorId, loadReviewCycle } from "@/features/reviews/domain/cycle-repository";
import { canReadReviewPack, gateReviews } from "@/features/reviews/domain/reviews-access";
import { TutorReviewForm, TutorReviewList } from "@/features/reviews/screens/TutorReviewForm";
import { renderSharedQueuePage } from "@/shell/guards/shared-record-page";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { getRedirectForDeniedRoute } from "@/lib/permissions/route-access";

type Search = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function ReviewsQueuePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const from = one(params.from);
  const pack = one(params.pack);
  const session = await getSupabaseEffectiveSession();
  const canManage = Boolean(session && hasPermission(session, PERMISSIONS.REVIEWS_MANAGE));
  const canTutor = Boolean(session && hasPermission(session, PERMISSIONS.REVIEWS_TUTOR));
  const gate = gateReviews({ signedIn: Boolean(session), canManage, canTutor, from, pack });
  if (!gate.ok) {
    const target = pack ? `/reviews?pack=${encodeURIComponent(pack)}` : from === "tutor" ? "/reviews?from=tutor" : "/reviews";
    if (gate.reason === "sign-in") redirect(getUnauthenticatedRedirect(target));
    redirect(getRedirectForDeniedRoute(session!, target));
  }
  if (gate.mode === "tutor-list" && from !== "tutor" && !pack) redirect("/reviews?from=tutor");
  if (gate.mode === "pack" || gate.mode === "tutor-list") {
    if (pack) {
      const tutorId = await loadPackTutorId(pack);
      if (!canReadReviewPack({ canManage, canTutor, userId: session!.account.id, tutorId })) {
        redirect(getRedirectForDeniedRoute(session!, "/reviews"));
      }
      const review = await loadDigitalReview(pack, session!.account.id);
      return (
        <ApprenticePageShell eyebrow="Reviews" title="Digital review" hideHeader>
          <TutorReviewForm review={review} />
        </ApprenticePageShell>
      );
    }
    const page = await loadReviewCycle();
    const mine = page.learners.filter((learner) => learner.tutorId === session!.account.id && learner.packId);
    return (
      <ApprenticePageShell eyebrow="Reviews" title="Reviews" hideHeader>
        {page.loadError ? <p role="alert">{page.loadError}</p> : null}
        <TutorReviewList learners={mine} tutorName={session!.account.name} />
      </ApprenticePageShell>
    );
  }
  return renderSharedQueuePage(
    "/reviews",
    "Reviews",
    "Shared reviews queue — open a row to the canonical review or apprentice record. Workspace dashboards link here; do not duplicate this list per role.",
  );
}
