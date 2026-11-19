import styles from "./ui/candidates.module.css";
import { loadApplicantFormOptions, loadCandidatesReady, loadEmployerChoices } from "./load";
import {
  ActionsPage,
  AddCandidate,
  CalendarPage,
  CandidateRecord,
  CandidatesList,
  DuePage,
  EmployerRecord,
  EmployersPage,
  InductionsPage,
  InterviewsPage,
  OverviewPage,
  ReportsPage,
  VacanciesPage,
  type CandidatesViewProps,
} from "./ui/views";

export async function CandidatesArea({
  workspace,
  segment,
  example,
  error,
  site,
  deleteName,
  tab,
  date,
}: {
  workspace: "administration" | "management";
  segment: string;
  example: boolean;
  error: string | null;
  site?: string;
  deleteName?: string;
  tab?: string;
  date?: string;
}) {
  const loaded = example ? { ready: false, notice: null } : await loadCandidatesReady();
  const loadedEmployers = example ? { choices: [], rows: [] } : await loadEmployerChoices();
  const options = example ? { programmes: [], centres: [], sources: [], notice: null } : await loadApplicantFormOptions();
  const props: CandidatesViewProps = {
    base: `/${workspace}/onboarding`,
    example,
    missing: !example && !loaded.ready,
    error: error || loaded.notice || options.notice,
    programmes: options.programmes,
    centres: options.centres,
    sources: options.sources,
    query: site || "",
    tab,
    date,
    employers: loadedEmployers.choices,
    employerRows: loadedEmployers.rows,
  };
  const rest = segment.slice("onboarding/".length);
  let page = <OverviewPage {...props} />;
  if (rest === "candidates") page = <CandidatesList {...props} />;
  else if (rest === "candidates/new") page = <AddCandidate {...props} />;
  else if (rest === "candidates/due") page = <DuePage {...props} confirmName={deleteName || null} />;
  else if (rest.startsWith("candidates/")) page = <CandidateRecord {...props} recordId={decodeURIComponent(rest.slice("candidates/".length))} />;
  else if (rest === "interviews") page = <InterviewsPage {...props} />;
  else if (rest === "inductions") page = <InductionsPage {...props} />;
  else if (rest === "employers") page = <EmployersPage {...props} />;
  else if (rest === "vacancies") page = <VacanciesPage {...props} />;
  else if (rest.startsWith("employers/")) page = <EmployerRecord {...props} employer={decodeURIComponent(rest.slice("employers/".length))} />;
  else if (rest === "calendar") page = <CalendarPage {...props} />;
  else if (rest === "actions") page = <ActionsPage {...props} />;
  else if (rest === "reports") page = <ReportsPage {...props} />;
  else if (rest !== "" && segment !== "onboarding") return null;
  return <div className={styles.cand}>{page}</div>;
}
