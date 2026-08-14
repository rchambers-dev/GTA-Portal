/**
 * Learner Session lane statuses for the release model.
 * Available = tutor released approved learning to this enrolment.
 * Coming up = not released (or listed only). Attendance is not represented here.
 */

export type SessionLaneStatus = "coming_up" | "available";

export function labelSessionLaneStatus(status: SessionLaneStatus): string {
  switch (status) {
    case "available":
      return "Available";
    case "coming_up":
      return "Coming up";
  }
}

export function assignSessionLaneStatuses<T extends { id: string }>(
  orderedSessions: T[],
  releasedSessionIds: ReadonlySet<string>,
): Array<{ session: T; status: SessionLaneStatus }> {
  return orderedSessions.map((session) => ({
    session,
    status: releasedSessionIds.has(session.id)
      ? ("available" as const)
      : ("coming_up" as const),
  }));
}

/** Tutor-only highlight: first Session in the Block that is not yet released. */
export function nextUnreleasedSession<T extends { id: string }>(
  lane: Array<{ session: T; status: SessionLaneStatus }>,
): T | null {
  return lane.find((row) => row.status === "coming_up")?.session ?? null;
}
