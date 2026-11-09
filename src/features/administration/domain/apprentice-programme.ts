/**
 * Programme tab for one apprentice: course dates, planned-date changes,
 * and breaks in learning.
 *
 * Planned dates that are already stored are changed only through
 * request_planned_date_change. breaks_in_learning.planned_return is a
 * generated column, start_date + 70 days (10 weeks). Tutors can read dates
 * and date-change history. They cannot see breaks.
 */

import { canAddApprentice, isAssignedGtaId } from "./apprentice-record";
import {
  formatTutorDate,
  normaliseGtaId,
  tutorDisplayName,
  type ApprenticeLearnerRecord,
} from "./apprentice-tutor";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Matches the generated column breaks_in_learning.planned_return. */
export const PLANNED_RETURN_DAYS = 70;

export const EXTENSION_PAPERWORK_HELP =
  "One document signed by the employer, the learner and the tutor. A course end change cannot be approved until this is ticked.";

export const CHECKLIST_EMPTY_NOTE = "No checklist items are set up yet.";

export const PLANNED_RETURN_HELP =
  "The planned return is 10 weeks after the start date.";

export const RETURN_ANY_TIME_HELP =
  "A learner can return at any time. There is no minimum length.";

export const PROGRAMME_PERMISSION_ERROR =
  "You do not have permission to change the programme. Administrator and Management can.";

export const PLANNED_DATE_TYPES = [
  {
    id: "course_end",
    label: "Course end",
    plannedLabel: "Planned course end",
    actualLabel: "Actual course end",
    plannedKey: "plannedCourseEnd",
    actualKey: "actualCourseEnd",
    column: "planned_course_end",
    effectiveKey: "courseEnd",
    originalKey: "originalCourseEnd",
    changedKey: "courseEndChanged",
  },
  {
    id: "gateway_1",
    label: "Gateway 1",
    plannedLabel: "Planned gateway 1",
    actualLabel: "Actual gateway 1",
    plannedKey: "plannedGateway1",
    actualKey: "actualGateway1",
    column: "planned_gateway_1",
    effectiveKey: "gateway1",
    originalKey: "originalGateway1",
    changedKey: "gateway1Changed",
  },
  {
    id: "gateway_2",
    label: "Gateway 2",
    plannedLabel: "Planned gateway 2",
    actualLabel: "Actual gateway 2",
    plannedKey: "plannedGateway2",
    actualKey: "actualGateway2",
    column: "planned_gateway_2",
    effectiveKey: "gateway2",
    originalKey: "originalGateway2",
    changedKey: "gateway2Changed",
  },
  {
    id: "epa",
    label: "EPA",
    plannedLabel: "Planned EPA",
    actualLabel: "Actual EPA",
    plannedKey: "plannedEpa",
    actualKey: "actualEpa",
    column: "planned_epa",
    effectiveKey: "epa",
    originalKey: "originalEpa",
    changedKey: "epaChanged",
  },
] as const;

export type PlannedDateType = (typeof PLANNED_DATE_TYPES)[number]["id"];
export type PlannedDateRow = (typeof PLANNED_DATE_TYPES)[number];

export const DIRECT_DATE_FIELDS = [
  { key: "courseStart", column: "course_start", label: "Course start" },
  { key: "actualCourseEnd", column: "actual_course_end", label: "Actual course end" },
  { key: "actualGateway1", column: "actual_gateway_1", label: "Actual gateway 1" },
  { key: "actualGateway2", column: "actual_gateway_2", label: "Actual gateway 2" },
  { key: "actualEpa", column: "actual_epa", label: "Actual EPA" },
] as const;

export type DirectDateKey = (typeof DIRECT_DATE_FIELDS)[number]["key"];

type PortalActor = {
  account: { baseRole: string };
  permissions: readonly string[];
};

export type ProgrammeActionResult =
  | { ok: true }
  | { ok: false; formError: string };

export type ReasonOption = {
  id: string;
  label: string;
  sortOrder: number;
  isSafeguarding: boolean;
};

export type StoredDates = {
  courseStart: string | null;
  plannedCourseEnd: string | null;
  actualCourseEnd: string | null;
  plannedGateway1: string | null;
  actualGateway1: string | null;
  plannedGateway2: string | null;
  actualGateway2: string | null;
  plannedEpa: string | null;
  actualEpa: string | null;
};

export type EffectiveDates = {
  courseEnd: string | null;
  gateway1: string | null;
  gateway2: string | null;
  epa: string | null;
  originalCourseEnd: string | null;
  originalGateway1: string | null;
  originalGateway2: string | null;
  originalEpa: string | null;
  courseEndChanged: boolean;
  gateway1Changed: boolean;
  gateway2Changed: boolean;
  epaChanged: boolean;
};

export type DateChangeRecord = {
  id: string;
  dateType: PlannedDateType | string;
  oldDate: string | null;
  newDate: string;
  reason: string;
  isSafeguarding: boolean;
  explanation: string | null;
  extensionPaperwork: boolean;
  status: string;
  requestedByName: string;
  requestedAt: string;
  signedOffByName: string | null;
  signedOffAt: string | null;
};

export type ChecklistItemState = {
  id: string;
  label: string;
  sortOrder: number;
  passed: boolean;
};

export type BreakRecord = {
  id: string;
  startDate: string;
  plannedReturn: string | null;
  actualReturn: string | null;
  reason: string;
  explanation: string;
  startedByName: string;
};

export type OpenBreak = BreakRecord & {
  signedOff: boolean;
  signedOffByName: string | null;
  signedOffAt: string | null;
  checks: ChecklistItemState[];
  checksUnavailable: boolean;
};

export type ApprenticeBreaks = {
  open: OpenBreak | null;
  history: BreakRecord[];
  reasons: ReasonOption[];
  multipleOpen: boolean;
};

export type ApprenticeProgrammePage = {
  dates: StoredDates | null;
  effective: EffectiveDates | null;
  changes: DateChangeRecord[];
  dateChangeReasons: ReasonOption[];
  breaks: ApprenticeBreaks | null;
  loadError: string | null;
  today: string;
};

export type CourseDateSubmission = {
  gtaId: string;
  courseStart: string | null;
  actualCourseEnd: string | null;
  actualGateway1: string | null;
  actualGateway2: string | null;
  actualEpa: string | null;
  plannedCourseEnd?: string | null;
  plannedGateway1?: string | null;
  plannedGateway2?: string | null;
  plannedEpa?: string | null;
};

export type CourseDatePlan = {
  direct: Partial<Record<(typeof DIRECT_DATE_FIELDS)[number]["column"], string | null>>;
  initialPlanned: { column: PlannedDateRow["column"]; value: string; dateType: PlannedDateType }[];
};

type RawCourseDates = {
  gtaId: string;
  courseStart: string;
  actualCourseEnd: string;
  actualGateway1: string;
  actualGateway2: string;
  actualEpa: string;
  plannedCourseEnd?: string;
  plannedGateway1?: string;
  plannedGateway2?: string;
  plannedEpa?: string;
};

/** Administrator and Management edit. Tutors, and anyone else, do not. */
export function canManageApprenticeProgramme(session: PortalActor | null): boolean {
  return canAddApprentice(session);
}

export function programmeIdentity(apprentice: ApprenticeLearnerRecord): {
  name: string;
  standardCode: string;
} {
  return {
    name: apprentice.programmeName?.trim() || apprentice.programmeLabel,
    standardCode: apprentice.standardCode?.trim() || "Not recorded",
  };
}

export function plannedDateRow(dateType: string): PlannedDateRow | null {
  return PLANNED_DATE_TYPES.find((row) => row.id === dateType) ?? null;
}

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function asIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 10) return null;
  const date = value.slice(0, 10);
  return isIsoDate(date) ? date : null;
}

/** Calendar addition used by the generated planned-return column. */
export function addCalendarDays(isoDate: string, days: number): string | null {
  if (!isIsoDate(isoDate)) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  const nextMonth = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(utc.getUTCDate()).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${nextMonth}-${nextDay}`;
}

export function plannedReturnOn(startDate: string, stored: string | null): string | null {
  return stored ?? addCalendarDays(startDate, PLANNED_RETURN_DAYS);
}

export function formatOptionalDate(value: string | null): string {
  if (!value) return "Not set";
  return formatTutorDate(value);
}

export function formatPortalTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/**
 * A planned date has passed when it is before today and no actual date is stored.
 * Today itself is not flagged.
 */
export function isPlannedDateOverdue(
  planned: string | null,
  actual: string | null,
  today: string,
): boolean {
  if (!planned || actual) return false;
  return planned < today;
}

export function plannedDateIsSet(
  stored: string | null,
  effective: string | null,
): boolean {
  return stored !== null || effective !== null;
}

export function dateChangeStatusLabel(status: string): string {
  if (status === "pending") return "Pending";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return status;
}

/**
 * Tutors receive explanation = null on safeguarding rows. Show the word
 * Safeguarding and nothing else for the explanation.
 */
export function dateChangeReasonLabel(change: {
  reason: string;
  isSafeguarding: boolean;
  explanation: string | null;
}): string {
  if (change.isSafeguarding && !change.explanation?.trim()) return "Safeguarding";
  return change.reason;
}

export function dateChangeExplanation(change: {
  isSafeguarding: boolean;
  explanation: string | null;
}): string | null {
  if (change.isSafeguarding && !change.explanation?.trim()) return null;
  const text = change.explanation?.trim() ?? "";
  return text || null;
}

export function extensionPaperworkLabel(received: boolean): string {
  return received
    ? "Extension paperwork received"
    : "Extension paperwork not received";
}

export function dateChangeActorLines(change: DateChangeRecord): string[] {
  const lines = [
    `Requested by ${change.requestedByName} on ${formatPortalTimestamp(change.requestedAt)}`,
  ];
  if (change.signedOffAt && change.signedOffByName) {
    const verb = change.status === "rejected" ? "Rejected" : "Approved";
    lines.push(
      `${verb} by ${change.signedOffByName} on ${formatPortalTimestamp(change.signedOffAt)}`,
    );
  }
  return lines;
}

export function emptyProgrammePage(today: string, loadError: string | null): ApprenticeProgrammePage {
  return {
    dates: null,
    effective: null,
    changes: [],
    dateChangeReasons: [],
    breaks: null,
    loadError,
    today,
  };
}

export function emptyStoredDates(): StoredDates {
  return {
    courseStart: null,
    plannedCourseEnd: null,
    actualCourseEnd: null,
    plannedGateway1: null,
    actualGateway1: null,
    plannedGateway2: null,
    actualGateway2: null,
    plannedEpa: null,
    actualEpa: null,
  };
}

export function personName(
  profile: { display_name: string | null; email: string | null } | undefined,
): string {
  if (!profile) return "Unknown user";
  return tutorDisplayName(profile.display_name, profile.email);
}

export function sortReasons<T extends { sortOrder: number; label: string }>(
  reasons: readonly T[],
): T[] {
  return [...reasons].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "en-GB"),
  );
}

function parseOptionalDate(
  label: string,
  raw: string,
): { ok: true; value: string | null } | { ok: false; formError: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!isIsoDate(trimmed)) {
    return { ok: false, formError: `Enter a valid ${label.toLowerCase()}.` };
  }
  return { ok: true, value: trimmed };
}

export function validateCourseDateSubmission(
  input: RawCourseDates,
): { ok: true; value: CourseDateSubmission } | { ok: false; formError: string } {
  const gtaId = normaliseGtaId(input.gtaId);
  if (!isAssignedGtaId(gtaId)) {
    return { ok: false, formError: "This apprentice does not have a valid GTA ID." };
  }

  const courseStart = parseOptionalDate("course start", input.courseStart);
  if (!courseStart.ok) return courseStart;
  const actualCourseEnd = parseOptionalDate("actual course end", input.actualCourseEnd);
  if (!actualCourseEnd.ok) return actualCourseEnd;
  const actualGateway1 = parseOptionalDate("actual gateway 1", input.actualGateway1);
  if (!actualGateway1.ok) return actualGateway1;
  const actualGateway2 = parseOptionalDate("actual gateway 2", input.actualGateway2);
  if (!actualGateway2.ok) return actualGateway2;
  const actualEpa = parseOptionalDate("actual EPA", input.actualEpa);
  if (!actualEpa.ok) return actualEpa;

  const value: CourseDateSubmission = {
    gtaId,
    courseStart: courseStart.value,
    actualCourseEnd: actualCourseEnd.value,
    actualGateway1: actualGateway1.value,
    actualGateway2: actualGateway2.value,
    actualEpa: actualEpa.value,
  };

  const plannedFields = [
    ["plannedCourseEnd", "planned course end"],
    ["plannedGateway1", "planned gateway 1"],
    ["plannedGateway2", "planned gateway 2"],
    ["plannedEpa", "planned EPA"],
  ] as const;
  for (const [key, label] of plannedFields) {
    if (input[key] === undefined) continue;
    const parsed = parseOptionalDate(label, input[key] ?? "");
    if (!parsed.ok) return parsed;
    value[key] = parsed.value;
  }

  return { ok: true, value };
}

function datesInOrder(start: string | null, end: string | null): boolean {
  if (!start || !end) return true;
  return end >= start;
}

/**
 * Direct edits may set course start, actual dates, and a planned date that
 * is still empty. A planned date that already has a stored or effective value
 * has to go through a date change request.
 */
export function planCourseDateUpdate(
  current: StoredDates,
  effective: EffectiveDates | null,
  submission: CourseDateSubmission,
): { ok: true; value: CourseDatePlan } | { ok: false; formError: string } {
  const direct: CourseDatePlan["direct"] = {};
  const initialPlanned: CourseDatePlan["initialPlanned"] = [];

  if (submission.courseStart !== current.courseStart) {
    direct.course_start = submission.courseStart;
  }
  if (submission.actualCourseEnd !== current.actualCourseEnd) {
    direct.actual_course_end = submission.actualCourseEnd;
  }
  if (submission.actualGateway1 !== current.actualGateway1) {
    direct.actual_gateway_1 = submission.actualGateway1;
  }
  if (submission.actualGateway2 !== current.actualGateway2) {
    direct.actual_gateway_2 = submission.actualGateway2;
  }
  if (submission.actualEpa !== current.actualEpa) {
    direct.actual_epa = submission.actualEpa;
  }

  for (const row of PLANNED_DATE_TYPES) {
    if (!(row.plannedKey in submission)) continue;
    const submitted = submission[row.plannedKey];
    if (submitted === undefined) continue;
    const stored = current[row.plannedKey];
    const effectiveValue = effective ? (effective[row.effectiveKey] as string | null) : null;
    if (submitted === stored && !plannedDateIsSet(stored, effectiveValue)) continue;
    if (submitted === null && stored === null && effectiveValue === null) continue;
    if (plannedDateIsSet(stored, effectiveValue)) {
      const shown = effectiveValue ?? stored;
      if (submitted !== shown && submitted !== stored) {
        return {
          ok: false,
          formError: `${row.plannedLabel} is already set. Change it with a date change request.`,
        };
      }
      continue;
    }
    if (submitted === null) continue;
    initialPlanned.push({ column: row.column, value: submitted, dateType: row.id });
  }

  const nextStart = "course_start" in direct ? direct.course_start ?? null : current.courseStart;
  const nextPlannedEnd =
    initialPlanned.find((item) => item.dateType === "course_end")?.value ??
    current.plannedCourseEnd;
  const nextActualEnd =
    "actual_course_end" in direct ? direct.actual_course_end ?? null : current.actualCourseEnd;

  if (!datesInOrder(nextStart, nextPlannedEnd)) {
    return {
      ok: false,
      formError: "The planned course end must be on or after the course start.",
    };
  }
  if (!datesInOrder(nextStart, nextActualEnd)) {
    return {
      ok: false,
      formError: "The actual course end must be on or after the course start.",
    };
  }

  if (Object.keys(direct).length === 0 && initialPlanned.length === 0) {
    return { ok: false, formError: "Change a date before saving." };
  }

  return { ok: true, value: { direct, initialPlanned } };
}

export function validateDateChangeRequest(input: {
  gtaId: string;
  dateType: string;
  newDate: string;
  reasonId: string;
  explanation: string;
  extensionPaperwork: boolean;
}):
  | {
      ok: true;
      value: {
        gtaId: string;
        dateType: PlannedDateType;
        newDate: string;
        reasonId: string;
        explanation: string;
        extensionPaperwork: boolean;
      };
    }
  | { ok: false; formError: string } {
  const gtaId = normaliseGtaId(input.gtaId);
  const row = plannedDateRow(input.dateType);
  const newDate = input.newDate.trim();
  const reasonId = input.reasonId.trim();
  const explanation = input.explanation.trim();
  if (!isAssignedGtaId(gtaId)) {
    return { ok: false, formError: "This apprentice does not have a valid GTA ID." };
  }
  if (!row) {
    return { ok: false, formError: "Choose course end, gateway 1, gateway 2, or EPA." };
  }
  if (!isIsoDate(newDate)) {
    return { ok: false, formError: "Enter the new date." };
  }
  if (!UUID_PATTERN.test(reasonId)) {
    return { ok: false, formError: "Choose a reason." };
  }
  if (!explanation) {
    return { ok: false, formError: "Enter an explanation." };
  }
  return {
    ok: true,
    value: {
      gtaId,
      dateType: row.id,
      newDate,
      reasonId,
      explanation,
      extensionPaperwork: row.id === "course_end" && input.extensionPaperwork === true,
    },
  };
}

export function validateBreakStart(input: {
  gtaId: string;
  reasonId: string;
  explanation: string;
  startDate: string;
}):
  | {
      ok: true;
      value: { gtaId: string; reasonId: string; explanation: string; startDate: string };
    }
  | { ok: false; formError: string } {
  const gtaId = normaliseGtaId(input.gtaId);
  const reasonId = input.reasonId.trim();
  const explanation = input.explanation.trim();
  const startDate = input.startDate.trim();
  if (!isAssignedGtaId(gtaId)) {
    return { ok: false, formError: "This apprentice does not have a valid GTA ID." };
  }
  if (!UUID_PATTERN.test(reasonId)) {
    return { ok: false, formError: "Choose a reason." };
  }
  if (!explanation) {
    return { ok: false, formError: "Enter an explanation." };
  }
  if (!isIsoDate(startDate)) {
    return { ok: false, formError: "Enter the start date." };
  }
  return { ok: true, value: { gtaId, reasonId, explanation, startDate } };
}

export function validateRecordId(
  value: string,
  label: string,
): { ok: true; value: string } | { ok: false; formError: string } {
  const id = value.trim();
  if (!UUID_PATTERN.test(id)) {
    return { ok: false, formError: `${label} could not be found. Refresh the page.` };
  }
  return { ok: true, value: id };
}

export function returnFromBreakReady(input: {
  signedOff: boolean;
  checks: readonly { passed: boolean }[];
  checksUnavailable?: boolean;
}): { ready: boolean; reason: string | null } {
  if (input.checksUnavailable) {
    return { ready: false, reason: "The return checklist could not be loaded." };
  }
  if (!input.signedOff) {
    return {
      ready: false,
      reason: "Sign off the return before the learner can come back.",
    };
  }
  if (input.checks.some((item) => !item.passed)) {
    return {
      ready: false,
      reason: "Every checklist item must be ticked before the learner can return.",
    };
  }
  return { ready: true, reason: null };
}

export function explainProgrammeError(error: {
  code?: string;
  message?: string;
  details?: string;
}): string {
  const message =
    error.message?.trim() || error.details?.trim() || "The change could not be saved.";
  if (
    error.code === "42501" ||
    /row-level security|permission denied|Administrator or Management role required|Staff role required/i.test(
      message,
    )
  ) {
    return PROGRAMME_PERMISSION_ERROR;
  }
  if (/Extension paperwork must be ticked/i.test(message)) {
    return `Extension paperwork must be ticked before a course end change can be approved. ${EXTENSION_PAPERWORK_HELP}`;
  }
  if (/New date is the same as the current planned date/i.test(message)) {
    return "The new date is the same as the current planned date.";
  }
  if (/Explanation is required/i.test(message)) {
    return "Enter an explanation.";
  }
  if (/Reason not found or not active/i.test(message)) {
    return "Choose a reason from the list.";
  }
  if (/Change is already /i.test(message)) {
    return "This change has already been decided. Refresh the page.";
  }
  if (/Only a pending change can be edited/i.test(message)) {
    return "Only a pending change can be updated. Refresh the page.";
  }
  if (/Apprentice already has an open break/i.test(message)) {
    return "This apprentice already has an open break in learning.";
  }
  if (/Cannot start a break/i.test(message)) {
    return "A break cannot be started for an apprentice who has withdrawn or completed.";
  }
  if (/Return-to-learning sign-off is required/i.test(message)) {
    return "Sign off the return to learning before the learner can come back.";
  }
  if (/Every active return-to-learning checklist item must be passed/i.test(message)) {
    return "Every checklist item must be ticked before the learner can return.";
  }
  if (/Return date cannot be before the break start date/i.test(message)) {
    return "The return date cannot be before the break start date.";
  }
  if (/Break has already ended/i.test(message)) {
    return "This break has already ended. Refresh the page.";
  }
  if (/Break not found|Planned date change not found/i.test(message)) {
    return "That record could not be found. Refresh the page.";
  }
  if (/Checklist item not found/i.test(message)) {
    return "That checklist item is no longer active. Refresh the page.";
  }
  if (/date_type must be/i.test(message)) {
    return "Choose course end, gateway 1, gateway 2, or EPA.";
  }
  if (/new date is required/i.test(message)) {
    return "Enter the new date.";
  }
  if (/Apprentice .+ not found/i.test(message)) {
    return "This apprentice could not be found. Refresh the page.";
  }
  if (message.includes("apprentices_planned_course_end_after_start")) {
    return "The planned course end must be on or after the course start.";
  }
  if (message.includes("apprentices_actual_course_end_after_start")) {
    return "The actual course end must be on or after the course start.";
  }
  return message;
}
