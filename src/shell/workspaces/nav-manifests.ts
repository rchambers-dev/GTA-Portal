import type { NavItem, NavSection } from "@/lib/portal/types";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

export const STAFF_BASE_NAV: NavItem[] = [
  { href: "/staff/search", label: "Search", permission: PERMISSIONS.STAFF_WORKSPACE_VIEW },
  { href: "/apprentices/lifecycle", label: "My Apprentices", permission: PERMISSIONS.LIFECYCLE_KANBAN_VIEW },
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
  { href: "/reviews?from=tutor", label: "Reviews", permission: PERMISSIONS.REVIEWS_TUTOR },
  { href: "/staff/shared-drive", label: "Shared Drive", permission: PERMISSIONS.STAFF_WORKSPACE_VIEW },
];

/** Grouped Progress Mentor workspace navigation */
export const MENTOR_NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/apprentices/lifecycle",
        label: "Lifecycle Board",
        permission: PERMISSIONS.LIFECYCLE_KANBAN_VIEW,
      },
      {
        href: "/staff/search",
        label: "Search",
        permission: PERMISSIONS.STAFF_WORKSPACE_VIEW,
      },
    ],
  },
  {
    title: "Apprentices",
    items: [
      {
        href: "/apprentices",
        label: "Apprentices",
        permission: PERMISSIONS.APPRENTICE_CASELOAD_VIEW,
      },
      {
        href: "/workspaces/progress-mentor/progress-monitoring",
        label: "Progress Monitoring",
        permission: PERMISSIONS.PROGRESS_MONITOR,
      },
    ],
  },
  {
    title: "Reviews",
    items: [
      {
        href: "/workspaces/progress-mentor/reviews",
        label: "Reviews",
        permission: PERMISSIONS.REVIEWS_MANAGE,
      },
      {
        href: "/workspaces/progress-mentor/training-plans",
        label: "Training Plans",
        permission: PERMISSIONS.REVIEWS_MANAGE,
      },
    ],
  },
  {
    title: "Actions",
    items: [
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

export const CURRICULUM_NAV: NavItem[] = [
  { href: "/curriculum/course-builder", label: "Course Builder", permission: PERMISSIONS.CURRICULUM_EDIT },
];
