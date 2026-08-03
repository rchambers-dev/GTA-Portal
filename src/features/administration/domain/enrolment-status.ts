import { isNewStarter } from "./account-access";
import type { EnrolmentKind, EnrolmentStatus } from "./types";

function todayIsoDate(onDate: Date = new Date()): string {
  const y = onDate.getFullYear();
  const m = String(onDate.getMonth() + 1).padStart(2, "0");
  const d = String(onDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
