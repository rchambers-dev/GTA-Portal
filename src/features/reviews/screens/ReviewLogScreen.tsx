import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canAddApprentice } from "@/features/administration/domain/apprentice-record";
import { loadReviewLog, parseLogQuery } from "../domain/review-log-repository";
import { ReviewLogView } from "./ReviewLogView";

export async function ReviewLogScreen({
  workspace,
  q,
  learner,
  tutor,
  event,
  range,
  page,
}: {
  workspace: "administration" | "management";
  q?: string;
  learner?: string;
  tutor?: string;
  event?: string;
  range?: string;
  page?: string;
}) {
  const filters = parseLogQuery({ q, learner, tutor, event, range, page });
  const [data, session] = await Promise.all([loadReviewLog(), getSupabaseEffectiveSession()]);
  return (
    <ApprenticePageShell eyebrow="Reviews" title="Review log" hideHeader>
      <ReviewLogView
        workspace={workspace}
        events={data.events}
        days={data.days}
        filters={filters}
        today={data.today}
        undoReady={data.undoReady}
        dayUndoReady={data.dayUndoReady}
        canUndo={canAddApprentice(session)}
        loadError={data.loadError}
      />
    </ApprenticePageShell>
  );
}
