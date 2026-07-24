/** Progress reviews run on a fixed 10-week cycle. */
export const REVIEW_CYCLE_WEEKS = 10;

/** Formal review prep should be ready one week before the due date. */
export const REVIEW_READY_LEAD_DAYS = 7;

export const REVIEW_CYCLE_LABEL = `${REVIEW_CYCLE_WEEKS}-weekly`;

const MS_PER_DAY = 86400000;

export function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(fromDate).getTime();
  const to = new Date(toDate).getTime();
  return Math.round((to - from) / MS_PER_DAY);
}

/** Days until the due date (negative when overdue). */
export function daysUntilDue(dueDate: string, today = "2026-07-17"): number {
  return daysBetween(today, dueDate);
}

/**
 * Days until the ready-by target (due date minus one week).
 * Zero or less means the review should already be ready.
 */
export function daysUntilReadyBy(dueDate: string, today = "2026-07-17"): number {
  return daysUntilDue(dueDate, today) - REVIEW_READY_LEAD_DAYS;
}

/** Next review due date from this review date (10-week cycle). */
export function nextReviewDueDate(reviewDate: string): string {
  const d = new Date(reviewDate);
  d.setUTCDate(d.getUTCDate() + REVIEW_CYCLE_WEEKS * 7);
  return d.toISOString().slice(0, 10);
}

/** Date when preparation should be complete / ready to create. */
export function readyByDate(dueDate: string): string {
  const d = new Date(dueDate);
  d.setUTCDate(d.getUTCDate() - REVIEW_READY_LEAD_DAYS);
  return d.toISOString().slice(0, 10);
}
