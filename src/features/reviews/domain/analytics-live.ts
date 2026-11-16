/** Tables the Analytics page reads, plus the edits that flow into those numbers. */
export const ANALYTICS_TABLES = [
  "apprentices",
  "apprentice_employments",
  "apprentice_tutors",
  "apprentice_safeguarding_signoffs",
  "breaks_in_learning",
  "learner_concerns",
  "employers",
  "programmes",
  "profiles",
  "reviews",
  "review_packs",
  "review_pack_events",
  "review_bookings",
  "review_day_stops",
  "candidates",
] as const;

/** Wait for a burst of row changes to settle before asking the page to load again. */
export const ANALYTICS_REFRESH_MS = 500;

export function queueRefresh(
  schedule: (run: () => void, wait: number) => number,
  cancel: (id: number) => void,
  refresh: () => void,
  wait = ANALYTICS_REFRESH_MS,
): () => void {
  let pending = 0;
  return () => {
    cancel(pending);
    pending = schedule(refresh, wait);
  };
}
