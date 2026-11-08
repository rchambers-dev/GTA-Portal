import type { EffectiveSession, NavSection } from "@/lib/portal/types";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { STAFF_BASE_NAV, MENTOR_NAV_SECTIONS, CURRICULUM_NAV } from "./nav-manifests";
import { isMentorStaffSession } from "@/lib/permissions/workspace";
import { pageNavAllowed } from "@/features/staff-page-access/enforce";

function marketingSection(workspace: "administration" | "management") {
  const records = PERMISSIONS.ADMIN_RECORDS_MANAGE;
  const base = `/${workspace}/marketing`;
  return {
    title: "Marketing & Recruitment",
    items: [
      { href: base, label: "Overview", permission: records },
      { href: `${base}/employers`, label: "Employers & vacancies", permission: records },
      { href: `${base}/calendar`, label: "Activity calendar", permission: records },
      { href: `${base}/actions`, label: "Actions", permission: records },
      {
        href: `/reports?from=${workspace}-marketing`,
        label: "Reports",
        permission: PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW,
      },
      { href: `${base}/settings`, label: "Settings", permission: PERMISSIONS.ADMIN_USERS_MANAGE },
    ],
  };
}

const ORIGINAL_REVIEW_NAV = [
  { href: "/reviews/learners", label: "Learners" },
  { href: "/reviews/plan", label: "Plan" },
  { href: "/reviews/out", label: "Out" },
  { href: "/reviews/reviews", label: "Reviews" },
  { href: "/reviews/archive", label: "Archive" },
  { href: "/reviews/analytics", label: "Analytics" },
  { href: "/reviews/settings", label: "Settings" },
] as const;

function reviewsSection() {
  return {
    title: "Reviews",
    items: ORIGINAL_REVIEW_NAV.map((item) => ({
      ...item,
      permission: PERMISSIONS.REVIEWS_MANAGE,
    })),
  };
}

function apprenticeshipManagementSection(workspace: "administration" | "management") {
  const records = PERMISSIONS.ADMIN_RECORDS_MANAGE;
  const setup = PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP;
  const items =
    workspace === "administration"
      ? [
          { href: "/administration/programmes", label: "Apprenticeships", permission: records },
          { href: "/administration/cohorts", label: "Cohorts", permission: records },
          { href: "/administration/teaching-groups", label: "Teaching Groups", permission: records },
          { href: "/administration/enrolments", label: "Apprentice Enrolments", permission: records },
        ]
      : [
          { href: "/management/programmes-records", label: "Apprenticeships", permission: records },
          { href: "/management/cohorts", label: "Cohorts", permission: records },
          { href: "/management/teaching-groups", label: "Teaching Groups", permission: records },
          { href: "/management/enrolments", label: "Apprentice Enrolments", permission: records },
          { href: "/management/programme-builder", label: "Programme Builder", permission: setup },
          { href: "/management/course-builder", label: "Course Builder", permission: setup },
          { href: "/management/apprentice-funding", label: "Apprentice funding (RPL / KSB)", permission: setup },
          { href: "/management/apprentice-tnp", label: "Apprentice TNP1", permission: setup },
        ];
  return { title: "Apprenticeship Management", items };
}

function staffSection(workspace: "administration" | "management") {
  return {
    title: "Staff",
    items: [
      {
        href: `/staff-records?from=${workspace}`,
        label: "Staff Records",
        permission: PERMISSIONS.ADMIN_USERS_MANAGE,
      },
      {
        href: `/staff-permissions?from=${workspace}`,
        label: "Permissions",
        permission: PERMISSIONS.ADMIN_USERS_MANAGE,
      },
    ],
  };
}

function onboardingSection(workspace: "administration" | "management") {
  const base = `/${workspace}/onboarding`;
  return {
    title: "Onboarding",
    items: [
      { href: base, label: "Overview", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
      { href: `${base}/apprentices`, label: "Apprentices", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
      { href: `${base}/interviews`, label: "Interviews", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
      { href: `${base}/apprentice`, label: "Add apprentice", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
      { href: `${base}/employer`, label: "Add employer", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
    ],
  };
}

function filterSection(
  session: EffectiveSession,
  section: NavSection,
): NavSection | null {
  const items = section.items.filter(
    (item) => hasPermission(session, item.permission) && pageNavAllowed(session, item.href),
  );
  if (items.length === 0) return null;
  return { ...section, items };
}

function filterSections(
  session: EffectiveSession,
  sections: NavSection[],
): NavSection[] {
  return sections
    .map((s) => filterSection(session, s))
    .filter((s): s is NavSection => s !== null);
}

export function resolveNavigation(session: EffectiveSession): NavSection[] {
  const { workspace } = session.account;

  if (workspace === "apprentice") {
    return filterSections(session, [
      {
        items: [
          { href: "/apprentice/dashboard", label: "Dashboard", permission: PERMISSIONS.APPRENTICE_WORKSPACE_OWN },
          { href: "/apprentice/learning", label: "My Learning", permission: PERMISSIONS.APPRENTICE_MODULES_VIEW },
          { href: "/apprentice/progress", label: "Progress", permission: PERMISSIONS.APPRENTICE_WORKSPACE_OWN },
          {
            href: "/apprentice/tracking",
            label: "Tasks & evidence",
            permission: PERMISSIONS.APPRENTICE_MODULES_VIEW,
          },
          { href: "/apprentice/otj", label: "OTJ hours", permission: PERMISSIONS.APPRENTICE_OTJ_VIEW },
          { href: "/apprentice/documents", label: "Documents", permission: PERMISSIONS.APPRENTICE_WORKSPACE_OWN },
          { href: "/apprentice/attendance", label: "Attendance", permission: PERMISSIONS.APPRENTICE_WORKSPACE_OWN },
          { href: "/apprentice/reviews", label: "Reviews", permission: PERMISSIONS.APPRENTICE_WORKSPACE_OWN },
          { href: "/apprentice/cv", label: "CV builder", permission: PERMISSIONS.APPRENTICE_WORKSPACE_OWN },
          { href: "/apprentice/messages", label: "Messages", permission: PERMISSIONS.MESSAGES_VIEW },
          { href: "/apprentice/support", label: "Support", permission: PERMISSIONS.APPRENTICE_WORKSPACE_OWN },
        ],
      },
    ]);
  }

  if (workspace === "employer") {
    return filterSections(session, [
      {
        items: [
          { href: "/employer/dashboard", label: "Dashboard", permission: PERMISSIONS.EMPLOYER_WORKSPACE_VIEW },
          { href: "/employer/apprentice", label: "Apprentice Overview", permission: PERMISSIONS.EMPLOYER_APPRENTICE_VIEW },
          { href: "/employer/progress", label: "Progress", permission: PERMISSIONS.EMPLOYER_APPRENTICE_VIEW },
          { href: "/employer/attendance", label: "Attendance", permission: PERMISSIONS.EMPLOYER_APPRENTICE_VIEW },
          { href: "/employer/otj", label: "OTJ hours", permission: PERMISSIONS.EMPLOYER_APPRENTICE_VIEW },
          { href: "/employer/reviews", label: "Reviews", permission: PERMISSIONS.EMPLOYER_APPRENTICE_VIEW },
          { href: "/employer/documents", label: "Documents", permission: PERMISSIONS.EMPLOYER_APPRENTICE_VIEW },
          { href: "/employer/messages", label: "Messages", permission: PERMISSIONS.MESSAGES_VIEW },
          { href: "/employer/support", label: "Support & Concerns", permission: PERMISSIONS.EMPLOYER_ASK_GTA },
        ],
      },
    ]);
  }

  if (workspace === "staff") {
    const sections: NavSection[] = [];

    if (isMentorStaffSession(session)) {
      sections.push(...MENTOR_NAV_SECTIONS);
    } else {
      sections.push({
        title: "Staff Workspace",
        items: STAFF_BASE_NAV.filter((item) => !item.href.startsWith("/reviews")),
      });
      sections.push({
        title: "Reviews",
        items: STAFF_BASE_NAV.filter((item) => item.href.startsWith("/reviews")),
      });
    }

    if (hasPermission(session, PERMISSIONS.CURRICULUM_MANAGEMENT_VIEW)) {
      sections.push({ title: "Curriculum Management", items: CURRICULUM_NAV });
    }

    return filterSections(session, sections);
  }

  if (workspace === "quality") {
    return filterSections(session, [
      {
        items: [
          { href: "/quality/dashboard", label: "Quality Dashboard", permission: PERMISSIONS.QUALITY_WORKSPACE_VIEW },
          { href: "/quality/audits", label: "Curriculum Audits", permission: PERMISSIONS.QUALITY_AUDITS_VIEW },
          { href: "/quality/observations", label: "Teaching Observations", permission: PERMISSIONS.QUALITY_AUDITS_VIEW },
          { href: "/quality/sampling", label: "Assessment Sampling", permission: PERMISSIONS.QUALITY_AUDITS_VIEW },
          { href: "/quality/compliance", label: "Compliance Checks", permission: PERMISSIONS.QUALITY_FINDINGS_VIEW },
          { href: "/quality/findings", label: "Findings", permission: PERMISSIONS.QUALITY_FINDINGS_VIEW },
          { href: "/quality/improvements", label: "Improvement Actions", permission: PERMISSIONS.QUALITY_FINDINGS_VIEW },
          { href: "/quality/feedback-trends", label: "Curriculum Feedback Trends", permission: PERMISSIONS.CURRICULUM_FEEDBACK_MANAGE },
          { href: "/quality/history", label: "Version & Change History", permission: PERMISSIONS.CURRICULUM_HISTORY_VIEW },
          { href: "/quality/shared-drive", label: "Shared Drive", permission: PERMISSIONS.QUALITY_WORKSPACE_VIEW },
          { href: "/apprentices/lifecycle", label: "Apprentice Lifecycle", permission: PERMISSIONS.LIFECYCLE_KANBAN_VIEW },
        ],
      },
    ]);
  }

  if (workspace === "management") {
    // Order follows Temp Portal management spine; extras slotted into the journey.
    return filterSections(session, [
      {
        items: [
          { href: "/management/dashboard", label: "Management Dashboard", permission: PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW },
          { href: "/management/apprentice-brag", label: "Apprentice progression BRAG", permission: PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP },
          { href: "/management/shared-drive", label: "Shared Drive", permission: PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW },
          { href: "/management/messages", label: "Messages", permission: PERMISSIONS.MESSAGES_VIEW },
          { href: "/management/safeguarding", label: "Safeguarding", permission: PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW },
        ],
      },
      apprenticeshipManagementSection("management"),
      staffSection("management"),
      marketingSection("management"),
      onboardingSection("management"),
      reviewsSection(),
    ]);
  }

  if (workspace === "administration") {
    // Order follows Temp Portal administration spine; extras slotted alongside.
    return filterSections(session, [
      {
        items: [
          { href: "/administration/dashboard", label: "Administration Dashboard", permission: PERMISSIONS.ADMIN_WORKSPACE_VIEW },
          { href: "/administration/accounts", label: "Apprentice Account Setup", permission: PERMISSIONS.ADMIN_USERS_MANAGE },
          { href: "/administration/shared-drive", label: "Shared Drive", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
          { href: "/administration/messages", label: "Messages", permission: PERMISSIONS.MESSAGES_VIEW },
          { href: "/administration/safeguarding", label: "Safeguarding", permission: PERMISSIONS.ADMIN_WORKSPACE_VIEW },
        ],
      },
      apprenticeshipManagementSection("administration"),
      staffSection("administration"),
      marketingSection("administration"),
      onboardingSection("administration"),
      reviewsSection(),
    ]);
  }

  if (workspace === "safeguarding") {
    return filterSections(session, [
      {
        items: [
          {
            href: "/safeguarding/dashboard",
            label: "Safeguarding",
            permission: PERMISSIONS.SAFEGUARDING_WORKSPACE_VIEW,
          },
        ],
      },
    ]);
  }

  return [];
}
