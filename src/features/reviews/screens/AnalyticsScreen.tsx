import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { loadAnalytics, parseAnalyticsFilters } from "../domain/analytics-repository";
import { AnalyticsView } from "./AnalyticsView";

export async function AnalyticsScreen({
  workspace,
  range,
  tutor,
  programme,
  employer,
  cycle,
  view,
}: {
  workspace: "administration" | "management";
  range?: string;
  tutor?: string;
  programme?: string;
  employer?: string;
  cycle?: string;
  view?: string;
}) {
  const filters = parseAnalyticsFilters({ range, tutor, programme, employer, cycle });
  const data = await loadAnalytics(filters);
  const mode = view === "tutors" || view === "log" ? view : "reviews";
  return (
    <ApprenticePageShell eyebrow="Reviews" title="Review analytics" hideHeader>
      <AnalyticsView workspace={workspace} data={data} view={mode} />
    </ApprenticePageShell>
  );
}
