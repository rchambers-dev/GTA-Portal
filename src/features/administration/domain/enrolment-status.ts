import {
  calculateProgrammeWeek,
  calculateProgrammeYear,
} from "@/features/apprentice-lifecycle/domain/programme-week";
import { isNewStarter } from "./account-access";
import type {
  AdminApprenticeEnrolment,
  EnrolmentKind,
  EnrolmentStatus,
} from "./types";

function todayIsoDate(onDate: Date = new Date()): string {
  const y = onDate.getFullYear();
  const m = String(onDate.getMonth() + 1).padStart(2, "0");
  const d = String(onDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatStartDate(value: string): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Enrolment status from start date — not a frozen label.
 * Past starts (Ofsted backfill / old apprentices) resolve to active;
 * future starts stay pending_start. Terminal statuses are preserved.
 */
export function deriveEnrolmentStatus(
  kind: EnrolmentKind,
  startDate: string,
  existing?: EnrolmentStatus,
  onDate: Date = new Date(),
): EnrolmentStatus {
  if (existing === "withdrawn" || existing === "completed") return existing;
  if (!startDate) {
    return kind === "new_starter" ? "pending_start" : "draft";
  }
  if (startDate > todayIsoDate(onDate)) return "pending_start";
  return "active";
}

/**
 * New starter = within the new-starter window of first college day (start date).
 * Older placements (Ofsted backfill) resolve to currently studying.
 */
export function deriveEnrolmentKind(
  startDate: string,
  preferred?: EnrolmentKind,
  onDate: Date = new Date(),
): EnrolmentKind {
  if (!startDate) return preferred ?? "new_starter";
  return isNewStarter(startDate, onDate) ? "new_starter" : "currently_studying";
}

export function enrolmentKindLabel(
  startDate: string,
  preferred?: EnrolmentKind,
  onDate: Date = new Date(),
): string {
  return deriveEnrolmentKind(startDate, preferred, onDate) === "new_starter"
    ? "New starter"
    : "Currently studying";
}

/**
 * Chip text for where the apprentice sits on programme.
 * Once started → live Y/W; before start → "Starts {date}".
 */
export function enrolmentPositionLabel(
  startDate: string,
  programmeYear?: 1 | 2 | 3 | null,
  programmeWeek?: number | null,
  onDate: Date = new Date(),
): string {
  const liveWeek = startDate
    ? calculateProgrammeWeek(startDate, onDate)
    : null;
  const week = liveWeek ?? programmeWeek ?? null;
  const liveYear = calculateProgrammeYear(week);
  const year =
    liveYear === 1 || liveYear === 2 || liveYear === 3
      ? liveYear
      : (programmeYear ?? null);

  if (week != null && year != null) {
    return `Y${year} · W${week}`;
  }
  if (!startDate) return "Start TBC";
  return `Starts ${formatStartDate(startDate)}`;
}

/** Refresh frozen kind / status / Y·W from the start date. */
export function normalizeEnrolmentTiming<
  T extends Pick<
    AdminApprenticeEnrolment,
    | "kind"
    | "status"
    | "startDate"
    | "programmeYear"
    | "programmeWeek"
  >,
>(row: T, onDate: Date = new Date()): T {
  const kind = deriveEnrolmentKind(row.startDate, row.kind, onDate);
  const status = deriveEnrolmentStatus(kind, row.startDate, row.status, onDate);
  const liveWeek = row.startDate
    ? calculateProgrammeWeek(row.startDate, onDate)
    : null;
  const liveYear = calculateProgrammeYear(liveWeek);
  const programmeWeek = liveWeek ?? row.programmeWeek;
  const programmeYear: 1 | 2 | 3 | null =
    liveYear === 1 || liveYear === 2 || liveYear === 3
      ? liveYear
      : row.programmeYear;

  if (
    kind === row.kind &&
    status === row.status &&
    programmeWeek === row.programmeWeek &&
    programmeYear === row.programmeYear
  ) {
    return row;
  }

  return {
    ...row,
    kind,
    status,
    programmeWeek,
    programmeYear,
  };
}

/** True when a stored pending/draft row should flip to active. */
export function enrolmentNeedsStartActivation(
  status: EnrolmentStatus,
  startDate: string,
  onDate: Date = new Date(),
): boolean {
  if (status !== "pending_start" && status !== "draft") return false;
  if (!startDate) return false;
  return startDate <= todayIsoDate(onDate);
}

/** True when stored kind is still new_starter past the window. */
export function enrolmentNeedsKindRefresh(
  kind: EnrolmentKind,
  startDate: string,
  onDate: Date = new Date(),
): boolean {
  if (kind !== "new_starter" || !startDate) return false;
  return !isNewStarter(startDate, onDate);
}
