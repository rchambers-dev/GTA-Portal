import type { EffectiveSession, NavSection } from "@/lib/portal/types";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { STAFF_BASE_NAV, MENTOR_NAV_SECTIONS, CURRICULUM_NAV } from "./nav-manifests";
import { isMentorStaffSession } from "@/lib/permissions/workspace";

function filterSection(
  session: EffectiveSession,
  section: NavSection,
): NavSection | null {
  const items = section.items.filter((item) =>
    hasPermission(session, item.permission),
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

  if (workspace === "learner") {
    return filterSections(session, [
      {
        items: [
          { href: "/learner/dashboard", label: "Dashboard", permission: PERMISSIONS.LEARNER_WORKSPACE_OWN },
          { href: "/learner/learning", label: "My Learning", permission: PERMISSIONS.LEARNER_MODULES_VIEW },
          { href: "/learner/college-tasks", label: "College tasks", permission: PERMISSIONS.LEARNER_MODULES_VIEW },
          { href: "/learner/progress", label: "Progress", permission: PERMISSIONS.LEARNER_WORKSPACE_OWN },
          { href: "/learner/otj", label: "OTJ hours", permission: PERMISSIONS.LEARNER_OTJ_VIEW },
          { href: "/learner/documents", label: "Documents", permission: PERMISSIONS.LEARNER_WORKSPACE_OWN },
          { href: "/learner/attendance", label: "Attendance", permission: PERMISSIONS.LEARNER_WORKSPACE_OWN },
          { href: "/learner/reviews", label: "Reviews", permission: PERMISSIONS.LEARNER_WORKSPACE_OWN },
          { href: "/learner/cv", label: "CV builder", permission: PERMISSIONS.LEARNER_WORKSPACE_OWN },
          { href: "/learner/messages", label: "Messages", permission: PERMISSIONS.MESSAGES_VIEW },
          { href: "/learner/support", label: "Support", permission: PERMISSIONS.LEARNER_WORKSPACE_OWN },
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
      sections.push({ title: "Staff Workspace", items: STAFF_BASE_NAV });
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
          { href: "/learners/lifecycle", label: "Learner Lifecycle", permission: PERMISSIONS.LIFECYCLE_KANBAN_VIEW },
        ],
      },
    ]);
  }

  if (workspace === "management") {
    return filterSections(session, [
      {
        items: [
          { href: "/management/dashboard", label: "Management Dashboard", permission: PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW },
          { href: "/management/employers", label: "Employer Records", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
          { href: "/management/programmes-records", label: "Programme Records", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
          { href: "/management/cohorts", label: "Cohorts & Groups", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
          { href: "/management/intake", label: "Learner Intake", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
          { href: "/management/staff-intake", label: "Staff Intake", permission: PERMISSIONS.ADMIN_USERS_MANAGE },
          { href: "/management/enrolments", label: "Learner Enrolments", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
          { href: "/management/learner-funding", label: "Learner funding (RPL / KSB)", permission: PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP },
          { href: "/management/learner-brag", label: "Learner progression BRAG", permission: PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP },
          { href: "/learners?from=management", label: "Learners", permission: PERMISSIONS.LEARNER_WORKSPACE_VIEW },
          { href: "/staff-records?from=management", label: "Staff", permission: PERMISSIONS.ADMIN_USERS_MANAGE },
          { href: "/management/accounts", label: "Learner Account Setup", permission: PERMISSIONS.ADMIN_USERS_MANAGE },
          { href: "/management/staff-accounts", label: "Staff Account Setup", permission: PERMISSIONS.ADMIN_USERS_MANAGE },
          { href: "/management/shared-drive", label: "Shared Drive", permission: PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW },
          { href: "/management/system", label: "System Actions", permission: PERMISSIONS.RECORDS_PROXY_WRITE },
          { href: "/management/learner-data", label: "Load Learner Data", permission: PERMISSIONS.RECORDS_PROXY_WRITE },
          { href: "/management/force-complete-tasks", label: "Force-complete tasks", permission: PERMISSIONS.RECORDS_PROXY_WRITE },
          { href: "/management/messages", label: "Messages", permission: PERMISSIONS.MESSAGES_VIEW },
          { href: "/management/safeguarding", label: "Safeguarding", permission: PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW },
        ],
      },
    ]);
  }

  if (workspace === "administration") {
    return filterSections(session, [
      {
        items: [
          { href: "/administration/dashboard", label: "Administration Dashboard", permission: PERMISSIONS.ADMIN_WORKSPACE_VIEW },
          { href: "/administration/employers", label: "Employer Records", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
          { href: "/administration/programmes", label: "Programme Records", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
          { href: "/administration/cohorts", label: "Cohorts & Groups", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
          { href: "/administration/intake", label: "Learner Intake", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
          { href: "/administration/enrolments", label: "Learner Enrolments", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
          { href: "/learners?from=administration", label: "Learners", permission: PERMISSIONS.LEARNER_WORKSPACE_VIEW },
          { href: "/administration/accounts", label: "Learner Account Setup", permission: PERMISSIONS.ADMIN_USERS_MANAGE },
          { href: "/administration/shared-drive", label: "Shared Drive", permission: PERMISSIONS.ADMIN_RECORDS_MANAGE },
          { href: "/administration/system", label: "System Actions", permission: PERMISSIONS.ADMIN_WORKSPACE_VIEW },
          { href: "/administration/messages", label: "Messages", permission: PERMISSIONS.MESSAGES_VIEW },
          { href: "/administration/safeguarding", label: "Safeguarding", permission: PERMISSIONS.ADMIN_WORKSPACE_VIEW },
        ],
      },
    ]);
  }

  if (workspace === "safeguarding") {
    return filterSections(session, [
      {
        items: [
          { href: "/safeguarding/dashboard", label: "Safeguarding Dashboard", permission: PERMISSIONS.SAFEGUARDING_WORKSPACE_VIEW },
          { href: "/safeguarding/cases", label: "Restricted Cases", permission: PERMISSIONS.SAFEGUARDING_CASES_VIEW },
          { href: "/safeguarding/referrals", label: "Referrals", permission: PERMISSIONS.SAFEGUARDING_CASES_VIEW },
          { href: "/safeguarding/welfare", label: "Welfare Concerns", permission: PERMISSIONS.SAFEGUARDING_CASES_VIEW },
          { href: "/safeguarding/risk", label: "Risk Assessments", permission: PERMISSIONS.SAFEGUARDING_CONFIDENTIAL_VIEW },
          { href: "/safeguarding/history", label: "Action History", permission: PERMISSIONS.SAFEGUARDING_CONFIDENTIAL_VIEW },
          { href: "/safeguarding/notes", label: "Confidential Notes", permission: PERMISSIONS.SAFEGUARDING_CONFIDENTIAL_VIEW },
          { href: "/safeguarding/escalations", label: "Escalations", permission: PERMISSIONS.SAFEGUARDING_CONFIDENTIAL_VIEW },
        ],
      },
    ]);
  }

  return [];
}
