import { redirect } from "next/navigation";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { loadDigitalReview, loadReviewCycle } from "@/features/reviews/domain/cycle-repository";
import { TutorReviewForm, TutorReviewList } from "@/features/reviews/screens/TutorReviewForm";
import { renderSharedQueuePage } from "@/shell/guards/shared-record-page";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";

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
  const tutorOnly = Boolean(session && hasPermission(session, PERMISSIONS.REVIEWS_TUTOR) && !hasPermission(session, PERMISSIONS.REVIEWS_MANAGE));
  if (tutorOnly && from !== "tutor" && !pack) redirect("/reviews?from=tutor");
  if (from === "tutor" || pack || tutorOnly) {
    if (!session) redirect(getUnauthenticatedRedirect(pack ? `/reviews?pack=${pack}` : "/reviews?from=tutor"));
    if (pack) {
      const review = await loadDigitalReview(pack, session.account.id);
      return (
        <ApprenticePageShell eyebrow="Reviews" title="Digital review" hideHeader>
          <TutorReviewForm review={review} />
        </ApprenticePageShell>
      );
    }
    const page = await loadReviewCycle();
    const mine = page.learners.filter((learner) => learner.tutorId === session.account.id && learner.packId);
    return (
      <ApprenticePageShell eyebrow="Reviews" title="Reviews" hideHeader>
        {page.loadError ? <p role="alert">{page.loadError}</p> : null}
        <TutorReviewList learners={mine} />
      </ApprenticePageShell>
    );
  }
  return renderSharedQueuePage(
    "/reviews",
    "Reviews",
    "Shared reviews queue — open a row to the canonical review or apprentice record. Workspace dashboards link here; do not duplicate this list per role.",
  );
}
