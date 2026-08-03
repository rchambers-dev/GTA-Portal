export const MENTOR_BASE = "/workspaces/progress-mentor";

export function mentorPath(
  page:
    | "apprentices"
    | "progress-monitoring"
    | "reviews"
    | "actions"
    | "employers"
    | "employer-concerns"
    | "interventions"
    | "messages",
  params?: Record<string, string | number | undefined | null>,
): string {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") qs.set(key, String(value));
    }
  }
  const query = qs.toString();
  return query ? `${MENTOR_BASE}/${page}?${query}` : `${MENTOR_BASE}/${page}`;
}

/** Lifecycle Board metric → filtered mentor workspace page */
export function metricHref(
  key: string,
  year: 1 | 2 | 3,
): string {
  switch (key) {
    case "active_apprentices":
      return mentorPath("progress-monitoring", {
        status: "active",
        caseload: "me",
        year,
        from: "lifecycle",
      });
    case "priority_intervention":
      return mentorPath("interventions", {
        priority: "high",
        status: "active",
        assignee: "me",
        from: "lifecycle",
      });
    case "reviews_due":
      return mentorPath("reviews", {
        tab: "needs_creating",
        due: "this-week",
        status: "not-completed",
        caseload: "me",
        from: "lifecycle",
      });
    case "programme_overdue":
      return mentorPath("progress-monitoring", {
        programmeStatus: "overdue",
        sort: "most-overdue",
        caseload: "me",
        from: "lifecycle",
      });
    case "employer_actions_overdue":
      return mentorPath("actions", {
        tab: "overdue",
        ownerType: "employer",
        status: "overdue",
        caseload: "me",
        from: "lifecycle",
      });
    case "missing_mandatory_evidence":
      return mentorPath("progress-monitoring", {
        evidence: "missing-mandatory",
        caseload: "me",
        from: "lifecycle",
      });
    default:
      return "/apprentices/lifecycle";
  }
}

export function apprenticeStatusHref(
  apprenticeId: string,
  overallStatus: string,
): string {
  const base = `/apprentices/${apprenticeId}?from=lifecycle`;
  switch (overallStatus) {
    case "on_track":
      return `${base}&tab=progress`;
    case "programme_overdue":
      return `${base}&tab=progress`;
    case "priority_intervention":
      return `${base}&tab=interventions`;
    case "monitoring":
    case "behind_recovering":
      return `${base}&tab=evidence`;
    default:
      return base;
  }
}
