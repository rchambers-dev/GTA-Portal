/**
 * Learner/tutor Session lane statuses.
 * Exactly one Current / next Session — never mark every reached week as Current.
 */

export type SessionLaneStatus = "completed" | "current" | "upcoming";

export function labelSessionLaneStatus(status: SessionLaneStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "current":
      return "Current / next";
    case "upcoming":
      return "Upcoming";
  }
}

export function assignSessionLaneStatuses<T extends { id: string }>(
  orderedSessions: T[],
  deliveredSessionIds: ReadonlySet<string>,
): Array<{ session: T; status: SessionLaneStatus }> {
  let currentAssigned = false;
  return orderedSessions.map((session) => {
    if (deliveredSessionIds.has(session.id)) {
      return { session, status: "completed" as const };
    }
    if (!currentAssigned) {
      currentAssigned = true;
      return { session, status: "current" as const };
    }
    return { session, status: "upcoming" as const };
  });
}

export function nextSessionAfterCurrent<T extends { id: string }>(
  lane: Array<{ session: T; status: SessionLaneStatus }>,
): T | null {
  const currentIndex = lane.findIndex((row) => row.status === "current");
  if (currentIndex < 0) return null;
  return lane[currentIndex + 1]?.session ?? null;
}
