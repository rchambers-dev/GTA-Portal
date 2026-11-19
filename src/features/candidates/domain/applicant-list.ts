/** How one applicant appears on the Applicants list. Derived from the saved record, not example rows. */

import { ukDate } from "./format";

export type ApplicantTone = "red" | "amber" | "green" | "grey" | "navy";

export type ApplicantCheck = { code: string; result: string | null };

export type ApplicantFacts = {
  candidateId: string;
  firstName: string;
  middleNames: string | null;
  lastName: string;
  status: string;
  employerStatus: string;
  responsiveness: string;
  reviewDueOn: string;
  firstContactOn: string;
  centreName: string;
  programmeLabel: string;
  convertedGtaId: string | null;
  actualStartOn: string | null;
  stage2Approved: boolean;
  checks: ApplicantCheck[];
  interviewOutcome: string | null;
  inductionOn: string | null;
  inductionAttendance: string | null;
};

export type ApplicantListItem = {
  candidateId: string;
  name: string;
  gtaId: string | null;
  site: string;
  programme: string;
  stage: string;
  stageTone: ApplicantTone;
  employerStatus: string;
  employerTone: ApplicantTone;
  responsiveness: string;
  responsivenessTone: ApplicantTone;
  nextStep: string;
  nextBlocked: boolean;
  bucket: "active" | "archived" | "started";
  due: boolean;
  reviewDueOn: string;
  firstContactOn: string;
};

export type ApplicantListFilters = {
  tab: "active" | "archived" | "started";
  query: string;
  site: string;
  programme: string;
  stage: string;
  employer: string;
};

const ARCHIVED = new Set(["archived", "rejected", "withdrawn_before_start", "withdrawn_after_start"]);

function nameOf(row: ApplicantFacts): string {
  return [row.firstName, row.middleNames, row.lastName].map((part) => part?.trim() || "").filter(Boolean).join(" ");
}

function passed(checks: ApplicantCheck[], code: string): boolean {
  return checks.some((check) => check.code === code && (check.result === "pass" || check.result === "done"));
}

function employerLabel(status: string): { label: string; tone: ApplicantTone } {
  if (status === "confirmed") return { label: "Confirmed", tone: "green" };
  if (status === "identified") return { label: "Identified", tone: "amber" };
  return { label: "Employer needed", tone: "red" };
}

function stage2Next(checks: ApplicantCheck[]): string {
  if (!passed(checks, "tna")) return "Complete TNA";
  if (!passed(checks, "hs_booked")) return "Book H&S visit";
  if (!passed(checks, "hs_completed")) return "Complete H&S visit";
  if (!passed(checks, "file_created")) return "Create learner file";
  if (!passed(checks, "file_completed")) return "Complete learner file";
  return "Book induction";
}

function stage1Next(checks: ApplicantCheck[]): string {
  if (!passed(checks, "id")) return "Verify ID";
  if (!passed(checks, "maths")) return "Sit Maths assessment";
  if (!passed(checks, "english")) return "Record English result";
  return "Book Monday session";
}

export function describeApplicant(row: ApplicantFacts, today: string): ApplicantListItem {
  const started = row.status === "converted" || Boolean(row.convertedGtaId);
  const archived = ARCHIVED.has(row.status);
  const employer = employerLabel(row.employerStatus);
  const responsive = row.responsiveness === "unresponsive";
  const mathsAndEnglish = passed(row.checks, "maths") && passed(row.checks, "english");
  let stage = "Stage 1";
  let stageTone: ApplicantTone = "grey";
  let nextStep = stage1Next(row.checks);
  let nextBlocked = false;

  if (started) {
    stage = "Started";
    stageTone = "green";
    nextStep = row.actualStartOn ? `Started ${ukDate(row.actualStartOn)}` : "Started";
  } else if (row.inductionOn && row.inductionAttendance !== "attended" && row.inductionAttendance !== "cancelled") {
    stage = "Induction";
    stageTone = "green";
    nextStep = `Attend induction ${ukDate(row.inductionOn)}`;
  } else if (row.stage2Approved) {
    stage = "Stage 2";
    stageTone = "navy";
    if (row.employerStatus !== "confirmed") {
      nextStep = "Stage 2 locked: employer not confirmed";
      nextBlocked = true;
    } else {
      nextStep = stage2Next(row.checks);
    }
  } else if (mathsAndEnglish || row.interviewOutcome) {
    stage = "Interview";
    stageTone = "navy";
    if (row.interviewOutcome === "passed" && row.employerStatus !== "confirmed") {
      nextStep = "Stage 2 locked: employer not confirmed";
      nextBlocked = true;
    } else if (row.interviewOutcome === "passed") {
      nextStep = "Await approval";
    } else if (row.interviewOutcome === "failed") {
      nextStep = "Book a resit";
    } else if (row.interviewOutcome === "awaiting") {
      nextStep = "Await approval";
    } else {
      nextStep = "Book Monday session";
    }
  }

  return {
    candidateId: row.candidateId,
    name: nameOf(row),
    gtaId: row.convertedGtaId,
    site: row.centreName || "—",
    programme: row.programmeLabel || "—",
    stage,
    stageTone,
    employerStatus: employer.label,
    employerTone: employer.tone,
    responsiveness: responsive ? "Unresponsive" : "Responsive",
    responsivenessTone: responsive ? "amber" : "green",
    nextStep,
    nextBlocked,
    bucket: started ? "started" : archived ? "archived" : "active",
    due: !started && !archived && row.reviewDueOn <= today,
    reviewDueOn: row.reviewDueOn,
    firstContactOn: row.firstContactOn,
  };
}

export function applicantCounts(rows: ApplicantListItem[]): { active: number; due: number; archived: number; started: number } {
  return {
    active: rows.filter((row) => row.bucket === "active").length,
    due: rows.filter((row) => row.due).length,
    archived: rows.filter((row) => row.bucket === "archived").length,
    started: rows.filter((row) => row.bucket === "started").length,
  };
}

const ALL_SITES = "All sites";
const ALL_PROGRAMMES = "All programmes";
const ALL_STAGES = "All stages";
const ALL_EMPLOYERS = "All employer statuses";

/** Query string for the applicants list. Blank filters stay out of the URL. */
export function applicantListSearch(input: {
  example?: boolean;
  tab?: string;
  query?: string;
  site?: string;
  programme?: string;
  stage?: string;
  employer?: string;
}): string {
  const params = new URLSearchParams();
  if (input.example) params.set("example", "1");
  if (input.tab) params.set("tab", input.tab);
  const query = input.query?.trim() ?? "";
  if (query) params.set("q", query);
  if (input.site && input.site !== ALL_SITES) params.set("site", input.site);
  if (input.programme && input.programme !== ALL_PROGRAMMES) params.set("programme", input.programme);
  if (input.stage && input.stage !== ALL_STAGES) params.set("stage", input.stage);
  if (input.employer && input.employer !== ALL_EMPLOYERS) params.set("employer", input.employer);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function filterApplicants(rows: ApplicantListItem[], filters: ApplicantListFilters): ApplicantListItem[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (row.bucket !== filters.tab) return false;
    if (query && !`${row.name} ${row.candidateId} ${row.gtaId ?? ""}`.toLowerCase().includes(query)) return false;
    if (filters.site && filters.site !== "All sites" && row.site !== filters.site) return false;
    if (filters.programme && filters.programme !== "All programmes" && row.programme !== filters.programme) return false;
    if (filters.stage && filters.stage !== "All stages" && row.stage !== filters.stage) return false;
    if (filters.employer && filters.employer !== "All employer statuses" && row.employerStatus !== filters.employer) return false;
    return true;
  });
}
