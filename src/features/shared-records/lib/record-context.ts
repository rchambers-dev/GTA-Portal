/**
 * Shared record URL context — preserve workspace workflow without duplicating pages.
 */

export type RecordFromContext =
  | "lifecycle"
  | "mentor"
  | "tutor"
  | "staff"
  | "quality"
  | "management"
  | "reviews"
  | "interventions"
  | "actions"
  | "employers"
  | "employer-concerns"
  | string;

export const LEARNER_TABS = [
  "overview",
  "progress",
  "reviews",
  "actions",
  "attendance",
  "evidence",
  "employer",
  "interventions",
  "support",
  "epa",
  "timeline",
] as const;

export type LearnerTab = (typeof LEARNER_TABS)[number];

const FROM_RETURN: Record<string, { href: string; label: string }> = {
  lifecycle: { href: "/learners/lifecycle", label: "Back to lifecycle board" },
  mentor: { href: "/learners/lifecycle", label: "Back to lifecycle board" },
  "mentor-learners": {
    href: "/learners",
    label: "Back to learners",
  },
  learners: {
    href: "/learners",
    label: "Back to learners",
  },
  "progress-monitoring": {
    href: "/workspaces/progress-mentor/progress-monitoring",
    label: "Back to progress monitoring",
  },
  "mentor-reviews": {
    href: "/workspaces/progress-mentor/reviews",
    label: "Back to reviews",
  },
  "action-centre": {
    href: "/workspaces/progress-mentor/actions",
    label: "Back to action centre",
  },
  "employer-relationships": {
    href: "/workspaces/progress-mentor/employers",
    label: "Back to employer relationships",
  },
  "mentor-concerns": {
    href: "/workspaces/progress-mentor/employer-concerns",
    label: "Back to employer concerns",
  },
  "mentor-interventions": {
    href: "/workspaces/progress-mentor/interventions",
    label: "Back to interventions",
  },
  messages: {
    href: "/workspaces/progress-mentor/messages",
    label: "Back to messages",
  },
  reviews: { href: "/reviews", label: "Back to reviews" },
  interventions: { href: "/interventions", label: "Back to interventions" },
  actions: { href: "/actions", label: "Back to actions" },
  employers: { href: "/employers", label: "Back to employers" },
  "employer-concerns": {
    href: "/employer-concerns",
    label: "Back to employer concerns",
  },
  tutor: { href: "/staff/dashboard", label: "Back to staff dashboard" },
  staff: { href: "/staff/dashboard", label: "Back to staff dashboard" },
  quality: { href: "/quality/dashboard", label: "Back to quality dashboard" },
  management: {
    href: "/management/dashboard",
    label: "Back to management dashboard",
  },
};

export function parseLearnerTab(
  value: string | string[] | undefined,
): LearnerTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && (LEARNER_TABS as readonly string[]).includes(raw)) {
    return raw as LearnerTab;
  }
  return "evidence";
}

export function parseFromContext(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ? raw.trim() : null;
}

export function getReturnLink(from: string | null): {
  href: string;
  label: string;
} {
  if (!from) {
    return { href: "/learners", label: "Back to learners" };
  }
  return (
    FROM_RETURN[from] ?? {
      href: "/learners",
      label: "Back to previous view",
    }
  );
}

export function learnerRecordHref(
  learnerId: string,
  opts?: { tab?: LearnerTab; from?: string },
): string {
  const params = new URLSearchParams();
  if (opts?.tab) params.set("tab", opts.tab);
  if (opts?.from) params.set("from", opts.from);
  const qs = params.toString();
  return qs ? `/learners/${learnerId}?${qs}` : `/learners/${learnerId}`;
}

export function childPathToTab(segment: string): LearnerTab | null {
  const map: Record<string, LearnerTab> = {
    evidence: "evidence",
    reviews: "reviews",
    interventions: "interventions",
    actions: "actions",
    attendance: "attendance",
    timeline: "timeline",
  };
  return map[segment] ?? null;
}
