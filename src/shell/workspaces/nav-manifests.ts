import type { NavItem, NavSection } from "@/lib/portal/types";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

export const STAFF_BASE_NAV: NavItem[] = [
  { href: "/staff/dashboard", label: "Dashboard", permission: PERMISSIONS.STAFF_WORKSPACE_VIEW },
  { href: "/learners/lifecycle", label: "My Learners", permission: PERMISSIONS.LIFECYCLE_KANBAN_VIEW },
  { href: "/staff/schedule", label: "Teaching Schedule", permission: PERMISSIONS.SCHEDULE_VIEW },
  {
    href: "/staff/programme-delivery",
    label: "Programme delivery",
    permission: PERMISSIONS.MODULES_DELIVER,
  },
  {
    href: "/staff/otj-approvals",
    label: "OTJ hours",
    permission: PERMISSIONS.MODULES_DELIVER,
  },
  { href: "/reviews?from=tutor", label: "Reviews", permission: PERMISSIONS.REVIEWS_MANAGE },
  { href: "/staff/shared-drive", label: "Shared Drive", permission: PERMISSIONS.STAFF_WORKSPACE_VIEW },
  { href: "/staff/messages", label: "Messages", permission: PERMISSIONS.MESSAGES_VIEW },
];

/** Grouped Progress Mentor workspace navigation */
export const MENTOR_NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/learners/lifecycle",
        label: "Lifecycle Board",
        permission: PERMISSIONS.LIFECYCLE_KANBAN_VIEW,
      },
    ],
  },
  {
    title: "Learners",
    items: [
      {
        href: "/learners",
        label: "Learners",
        permission: PERMISSIONS.LEARNER_CASELOAD_VIEW,
      },
      {
        href: "/workspaces/progress-mentor/progress-monitoring",
        label: "Progress Monitoring",
        permission: PERMISSIONS.PROGRESS_MONITOR,
      },
    ],
  },
  {
    title: "Reviews & Actions",
    items: [
      {
        href: "/workspaces/progress-mentor/reviews",
        label: "Reviews",
        permission: PERMISSIONS.REVIEWS_MANAGE,
      },
      {
        href: "/workspaces/progress-mentor/actions",
        label: "Action Centre",
        permission: PERMISSIONS.ACTIONS_MANAGE,
      },
    ],
  },
  {
    title: "Employers",
    items: [
      {
        href: "/workspaces/progress-mentor/employers",
        label: "Employer Relationships",
        permission: PERMISSIONS.EMPLOYER_CONTACTS_VIEW,
      },
      {
        href: "/workspaces/progress-mentor/employer-concerns",
        label: "Employer Concerns",
        permission: PERMISSIONS.EMPLOYER_CONCERNS_MANAGE,
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        href: "/workspaces/progress-mentor/interventions",
        label: "Interventions",
        permission: PERMISSIONS.INTERVENTIONS_MANAGE,
      },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        href: "/workspaces/progress-mentor/messages",
        label: "Messages",
        permission: PERMISSIONS.MESSAGES_VIEW,
      },
    ],
  },
];

/** @deprecated flat mentor list — use MENTOR_NAV_SECTIONS */
export const STAFF_MENTOR_NAV: NavItem[] = MENTOR_NAV_SECTIONS.flatMap(
  (s) => s.items,
);

export const CURRICULUM_NAV: NavItem[] = [
  { href: "/curriculum/overview", label: "Curriculum Overview", permission: PERMISSIONS.CURRICULUM_MANAGEMENT_VIEW },
  { href: "/curriculum/programme", label: "Programme Editor", permission: PERMISSIONS.CURRICULUM_EDIT },
  { href: "/curriculum/modules", label: "Module Editor", permission: PERMISSIONS.CURRICULUM_EDIT },
  { href: "/curriculum/resources", label: "Resource Editor", permission: PERMISSIONS.CURRICULUM_RESOURCES_MANAGE },
  { href: "/curriculum/assessments", label: "Assessment & Answer Editor", permission: PERMISSIONS.CURRICULUM_ASSESSMENTS_MANAGE },
  { href: "/curriculum/ksb", label: "KSB Mapping", permission: PERMISSIONS.CURRICULUM_KSB_MANAGE },
  { href: "/curriculum/feedback", label: "Feedback Centre", permission: PERMISSIONS.CURRICULUM_FEEDBACK_MANAGE },
  { href: "/curriculum/versions", label: "Version Management", permission: PERMISSIONS.CURRICULUM_VERSION_MANAGE },
  { href: "/curriculum/history", label: "Publishing & Change History", permission: PERMISSIONS.CURRICULUM_HISTORY_VIEW },
];
