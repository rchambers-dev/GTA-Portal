/**
 * Tutor assignment for one apprentice.
 * Eligible tutors match apprentice_tutors_require_tutor() exactly:
 * base_role = 'Tutor' OR 'Apprenticeship Tutor' = ANY(responsibilities).
 */

import {
  canAddApprentice,
  formatApprenticeName,
  formatProgrammeChoice,
  apprenticeStatusLabel,
  isAssignedGtaId,
} from "./apprentice-record";

/** Exact responsibility string required by the database trigger. */
export const APPRENTICESHIP_TUTOR_RESPONSIBILITY = "Apprenticeship Tutor";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Sections on the learner page. Add one here and a panel in
 * ApprenticeLearnerView. Overview stays the default when the query is empty
 * or names a section that is not in this list yet.
 */
export const LEARNER_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "employer", label: "Employer" },
  { id: "programme", label: "Programme" },
  { id: "tutor", label: "Tutor" },
] as const;

export type LearnerSectionId = (typeof LEARNER_SECTIONS)[number]["id"];

type PortalActor = {
  account: { baseRole: string };
  permissions: readonly string[];
};

export type TutorProfile = {
  baseRole: string;
  responsibilities?: readonly string[] | null;
};

export type TutorOption = {
  id: string;
  displayName: string;
  email: string | null;
};

export type TutorProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  base_role: string;
  responsibilities: string[] | null;
};

export type TutorAssignment = {
  id: string;
  tutorId: string;
  displayName: string;
  email: string | null;
  startDate: string;
  endDate: string | null;
};

export type TutorAssignmentRow = {
  id: string;
  tutor_id: string;
  start_date: string;
  end_date: string | null;
};

export type ApprenticeLearnerRecord = {
  gtaId: string;
  name: string;
  programmeLabel: string;
  programmeName: string | null;
  standardCode: string | null;
  status: string;
  statusLabel: string;
  email: string | null;
};

export type ValidatedTutorAssignment = {
  gtaId: string;
  tutorId: string;
};

export type AssignTutorResult =
  | { ok: true }
  | { ok: false; formError: string };

export function apprenticeLearnerGtaId(segment: string): string | null {
  const match = /^onboarding\/apprentice\/([^/]+)$/.exec(segment);
  return match?.[1] ?? null;
}

export function apprenticeListWorkspace(
  pathname: string,
): "administration" | "management" {
  return pathname === "/management" || pathname.startsWith("/management/")
    ? "management"
    : "administration";
}

export function apprenticeLearnerPath(
  workspace: "administration" | "management",
  gtaId: string,
): string {
  return `/${workspace}/onboarding/apprentice/${encodeURIComponent(gtaId)}`;
}

export function learnerSectionFromQuery(
  value: string | null | undefined,
): LearnerSectionId {
  const match = LEARNER_SECTIONS.find((section) => section.id === value);
  return match?.id ?? "overview";
}

export function learnerSectionHref(
  basePath: string,
  sectionId: LearnerSectionId,
): string {
  if (sectionId === "overview") return basePath;
  return `${basePath}?tab=${sectionId}`;
}

/**
 * Same predicate as apprentice_tutors_require_tutor().
 * Both sides are exact string matches.
 */
export function profileCanTutor(profile: TutorProfile): boolean {
  if (profile.baseRole === "Tutor") return true;
  return (profile.responsibilities ?? []).includes(
    APPRENTICESHIP_TUTOR_RESPONSIBILITY,
  );
}

/** Administrator and Management assign tutors. Tutors, and anyone else, do not. */
export function canAssignApprenticeTutor(session: PortalActor | null): boolean {
  return canAddApprentice(session);
}

export function normaliseGtaId(value: string): string {
  try {
    return decodeURIComponent(value).trim().toUpperCase();
  } catch {
    return value.trim().toUpperCase();
  }
}

export function validateTutorAssignment(input: {
  gtaId: string;
  tutorId: string;
}): { ok: true; value: ValidatedTutorAssignment } | { ok: false; formError: string } {
  const gtaId = normaliseGtaId(input.gtaId);
  const tutorId = input.tutorId.trim();
  if (!isAssignedGtaId(gtaId)) {
    return { ok: false, formError: "This apprentice does not have a valid GTA ID." };
  }
  if (!UUID_PATTERN.test(tutorId)) {
    return { ok: false, formError: "Choose a tutor from the list." };
  }
  return { ok: true, value: { gtaId, tutorId } };
}

export function tutorDisplayName(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = displayName?.trim() ?? "";
  if (name) return name;
  const mail = email?.trim() ?? "";
  if (mail) return mail;
  return "Tutor";
}

export function formatTutorOption(tutor: {
  displayName: string;
  email: string | null;
}): string {
  if (tutor.email && tutor.email !== tutor.displayName) {
    return `${tutor.displayName} (${tutor.email})`;
  }
  return tutor.displayName;
}

export function formatTutorDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return value;
  return `${day} ${MONTHS[month - 1]} ${match[1]}`;
}

/** Calendar day in Europe/London, matching the portal's working day. */
export function londonToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return now.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

export function explainTutorWriteError(error: {
  code?: string;
  message?: string;
}): string {
  const message = error.message?.trim() || "The tutor could not be saved.";
  if (
    error.code === "42501" ||
    /row-level security|permission denied/i.test(message)
  ) {
    return "You do not have permission to change the tutor. Administrator and Management can assign a tutor.";
  }
  if (
    error.code === "23505" ||
    message.includes("apprentice_tutors_one_current_idx")
  ) {
    return "This apprentice already has a current tutor. Refresh the page and try again.";
  }
  if (
    message.includes("base_role Tutor") ||
    message.includes("Apprenticeship Tutor responsibility")
  ) {
    return "Choose a tutor. Only a Tutor, or someone with the Apprenticeship Tutor responsibility, can be assigned.";
  }
  if (message.includes("apprentice_tutors_dates_check")) {
    return "The tutor could not be changed because the end date is before the start date.";
  }
  if (
    error.code === "23503" ||
    message.includes("apprentice_tutors_tutor_id_fkey") ||
    message.includes("apprentice_tutors_apprentice_id_fkey")
  ) {
    return "That tutor or apprentice is no longer available. Refresh the page and try again.";
  }
  return message;
}

export function eligibleTutorOptions(
  rows: readonly TutorProfileRow[],
): TutorOption[] {
  const byId = new Map<string, TutorOption>();
  for (const row of rows) {
    if (!row.id) continue;
    if (
      !profileCanTutor({
        baseRole: row.base_role,
        responsibilities: row.responsibilities,
      })
    ) {
      continue;
    }
    byId.set(row.id, {
      id: row.id,
      displayName: tutorDisplayName(row.display_name, row.email),
      email: row.email?.trim() || null,
    });
  }
  return [...byId.values()].sort(
    (a, b) =>
      a.displayName.localeCompare(b.displayName, "en-GB") ||
      a.id.localeCompare(b.id),
  );
}

export function mapTutorAssignment(
  row: TutorAssignmentRow,
  profile: { display_name: string | null; email: string | null } | undefined,
): TutorAssignment {
  return {
    id: row.id,
    tutorId: row.tutor_id,
    displayName: tutorDisplayName(profile?.display_name, profile?.email),
    email: profile?.email?.trim() || null,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

export function splitTutorAssignments(rows: readonly TutorAssignment[]): {
  current: TutorAssignment | null;
  history: TutorAssignment[];
  multipleCurrent: boolean;
} {
  const open = rows.filter((row) => row.endDate === null);
  const current =
    [...open].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id.localeCompare(a.id))[0] ??
    null;
  const history = rows
    .filter((row) => row.endDate !== null)
    .sort((a, b) => {
      const byEnd = (b.endDate ?? "").localeCompare(a.endDate ?? "");
      if (byEnd !== 0) return byEnd;
      return b.startDate.localeCompare(a.startDate) || b.id.localeCompare(a.id);
    });
  return { current, history, multipleCurrent: open.length > 1 };
}

export function learnerRecordFromRow(
  row: {
    gta_id: string;
    first_name: string;
    middle_names: string | null;
    last_name: string;
    email?: string | null;
    programme_id: string | null;
    status: string;
  },
  programme: { name: string; standardCode: string } | null,
): ApprenticeLearnerRecord {
  let programmeLabel = "No programme";
  if (programme) {
    programmeLabel = formatProgrammeChoice(programme.name, programme.standardCode);
  } else if (row.programme_id) {
    programmeLabel = "Programme unavailable";
  }
  return {
    gtaId: row.gta_id,
    name: formatApprenticeName({
      firstName: row.first_name,
      middleNames: row.middle_names,
      lastName: row.last_name,
    }),
    programmeLabel,
    programmeName: programme?.name.trim() || null,
    standardCode: programme?.standardCode.trim() || null,
    status: row.status,
    statusLabel: apprenticeStatusLabel(row.status),
    email: row.email ?? null,
  };
}

export function displayRequestedId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "unknown";
  if (trimmed.length > 32) return `${trimmed.slice(0, 32)}…`;
  return trimmed;
}
