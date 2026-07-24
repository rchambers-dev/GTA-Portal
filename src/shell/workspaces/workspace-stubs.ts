import type { NavSection } from "@/lib/portal/types";

const WORKSPACE_STUBS: Record<string, Record<string, { title: string; description: string }>> = {
  learner: {
    dashboard: {
      title: "Learner Dashboard",
      description: "Personalised learner overview — modules, progress, and upcoming reviews.",
    },
    learning: {
      title: "My Learning",
      description: "Active learning plan and this week’s focus items for the signed-in learner.",
    },
    modules: {
      title: "Modules",
      description: "Published curriculum modules available to this learner.",
    },
    cea: {
      title: "CEA tasks",
      description:
        "Autocare ST0499 personal tracking — mandatory CEA tasks, additional workplace activities, gateways and milestones.",
    },
    otj: {
      title: "OTJ hours",
      description: "Off-the-job hours log and approval status.",
    },
    progress: {
      title: "Progress",
      description: "Progress against programme milestones and KSB coverage.",
    },
    reviews: {
      title: "Reviews",
      description: "Scheduled and completed progress reviews.",
    },
    attendance: {
      title: "Attendance",
      description: "Attendance record and any concerns raised with GTA.",
    },
    support: {
      title: "Support",
      description: "Support requests and welfare contacts — learner-safe view only.",
    },
    cv: {
      title: "CV builder",
      description: "Build, export, and email a professional CV from your details.",
    },
    messages: {
      title: "Messages",
      description: "Secure messaging with GTA staff.",
    },
  },
  employer: {
    dashboard: {
      title: "Employer Dashboard",
      description: "Apprentice overview, commitments, and GTA contact shortcuts.",
    },
    apprentice: {
      title: "Apprentice Overview",
      description: "High-level apprentice status without confidential GTA notes.",
    },
    progress: {
      title: "Progress",
      description: "Employer-visible progress summary.",
    },
    attendance: {
      title: "Attendance",
      description: "Attendance trends shared with the employer.",
    },
    otj: {
      title: "OTJ hours",
      description: "Agree or return apprentice off-the-job hour submissions.",
    },
    reviews: {
      title: "Reviews",
      description: "Employer participation in progress reviews.",
    },
    commitments: {
      title: "Employer Commitments",
      description: "Training opportunities and employer actions.",
    },
    messages: {
      title: "Messages",
      description: "Employer messaging with GTA.",
    },
    support: {
      title: "Employer Support & Concerns",
      description: "GTA-first support and concern workflows — cases are handled by GTA before learner contact.",
    },
  },
  staff: {
    dashboard: {
      title: "Staff Dashboard",
      description: "Teaching staff operational overview — shared Staff Workspace.",
    },
    schedule: {
      title: "Teaching Schedule",
      description: "Sessions, workshops, and employer visits.",
    },
    modules: {
      title: "Modules",
      description: "Published curriculum delivery view for tutors.",
    },
    "module-sign-offs": {
      title: "Module sign-offs",
      description:
        "Tutor queue of outcomes to cover, sign off, or ask learners to do again.",
    },
    "otj-approvals": {
      title: "OTJ hours",
      description: "Confirm employer-agreed off-the-job hours for your learners.",
    },
    assessments: {
      title: "Assessments & Marking",
      description: "Marking queue and assessment outcomes.",
    },
    reviews: {
      title: "Reviews",
      description: "Learner review scheduling and records.",
    },
    resources: {
      title: "Teaching Resources",
      description: "Tutor-owned resources linked to published curriculum.",
    },
    "curriculum-feedback": {
      title: "Curriculum Feedback",
      description: "Submit curriculum improvement feedback for aggregation.",
    },
    messages: {
      title: "Messages",
      description: "Staff messaging.",
    },
    progress: {
      title: "Progress Monitoring",
      description: "Mentor caseload progress tracking.",
    },
    "employer-contacts": {
      title: "Employer Contacts",
      description: "Employer relationship management for mentors.",
    },
    "employer-concerns": {
      title: "Employer Concerns",
      description: "GTA case management for employer-raised concerns — internal notes hidden from employer views.",
    },
    interventions: {
      title: "Interventions",
      description: "Structured interventions and follow-ups.",
    },
    "support-plans": {
      title: "Support Plans",
      description: "Individual learner support planning.",
    },
    attendance: {
      title: "Attendance Concerns",
      description: "Attendance monitoring and escalation.",
    },
    actions: {
      title: "Actions & Follow-ups",
      description: "Open actions across the mentor caseload.",
    },
  },
  curriculum: {
    overview: {
      title: "Curriculum Overview",
      description: "Programme-scoped curriculum management entry point.",
    },
    programme: {
      title: "Programme Editor",
      description: "Draft programme structure — published versions are never overwritten.",
    },
    modules: {
      title: "Module Editor",
      description: "Module content editing within programme scope.",
    },
    resources: {
      title: "Resource Editor",
      description: "Learning resources attached to curriculum versions.",
    },
    assessments: {
      title: "Assessment & Answer Editor",
      description: "Assessment design and answer guidance.",
    },
    ksb: {
      title: "KSB Mapping",
      description: "Knowledge, skills, and behaviours mapping.",
    },
    feedback: {
      title: "Feedback Centre",
      description: "Aggregated tutor feedback into improvement items.",
    },
    versions: {
      title: "Version Management",
      description: "Published → Draft → Edit → Review → Approve → Publish workflow.",
    },
    history: {
      title: "Publishing & Change History",
      description: "Immutable history of published curriculum changes.",
    },
  },
  quality: {
    dashboard: {
      title: "Quality Dashboard",
      description: "Quality assurance operational overview.",
    },
    audits: {
      title: "Curriculum Audits",
      description: "Scheduled and completed curriculum audits.",
    },
    observations: {
      title: "Teaching Observations",
      description: "Observation records and outcomes.",
    },
    sampling: {
      title: "Assessment Sampling",
      description: "Assessment sampling plans and findings.",
    },
    compliance: {
      title: "Compliance Checks",
      description: "Compliance monitoring against standards.",
    },
    findings: {
      title: "Findings",
      description: "Quality findings register.",
    },
    improvements: {
      title: "Improvement Actions",
      description: "Improvement actions linked to findings.",
    },
    "feedback-trends": {
      title: "Curriculum Feedback Trends",
      description: "Aggregated curriculum feedback analytics.",
    },
    history: {
      title: "Version & Change History",
      description: "Read-only curriculum version history for QA.",
    },
  },
  management: {
    dashboard: {
      title: "Management Dashboard",
      description: "Operational management overview.",
    },
    programmes: {
      title: "Programme Setup",
      description: "Management-owned programme structure setup.",
    },
    import: {
      title: "Import Programme Structure",
      description: "Bulk import of programme structures.",
    },
    roles: {
      title: "Roles & Responsibilities",
      description: "Grant and revoke temporary responsibilities with audit trail.",
    },
    staff: {
      title: "Staff Overview",
      description: "Staff capacity and responsibility overview.",
    },
    "curriculum-health": {
      title: "Curriculum Health",
      description: "Curriculum quality and publication health indicators.",
    },
    reporting: {
      title: "Operational Reporting",
      description: "Management reporting across programmes.",
    },
    "employer-concerns": {
      title: "Employer Concern Oversight",
      description: "Oversight of GTA-first employer concern cases.",
    },
    audit: {
      title: "Audit History",
      description: "Demo audit log of responsibility changes.",
    },
  },
  administration: {
    dashboard: {
      title: "Administration Dashboard",
      description: "Records and account administration overview.",
    },
    users: {
      title: "User Records",
      description: "Portal user administration.",
    },
    enrolments: {
      title: "Learner Enrolments",
      description: "Enrolment records and intake status.",
    },
    employers: {
      title: "Employer Records",
      description: "Employer account records.",
    },
    programmes: {
      title: "Programme Records",
      description: "Programme reference data.",
    },
    cohorts: {
      title: "Cohorts & Groups",
      description: "Cohort and teaching group administration.",
    },
    documents: {
      title: "Documents",
      description: "Administrative document management.",
    },
    "data-quality": {
      title: "Data Quality",
      description: "Data quality checks and remediation queues.",
    },
    accounts: {
      title: "Account Setup",
      description: "New account provisioning.",
    },
    system: {
      title: "System Actions",
      description: "Administrative system actions.",
    },
  },
  safeguarding: {
    dashboard: {
      title: "Safeguarding Dashboard",
      description: "Restricted safeguarding overview.",
    },
    cases: {
      title: "Restricted Cases",
      description: "Confidential safeguarding cases — restricted access.",
    },
    referrals: {
      title: "Referrals",
      description: "Safeguarding referrals and outcomes.",
    },
    welfare: {
      title: "Welfare Concerns",
      description: "Welfare concern tracking.",
    },
    risk: {
      title: "Risk Assessments",
      description: "Confidential risk assessments.",
    },
    history: {
      title: "Action History",
      description: "Safeguarding action history.",
    },
    notes: {
      title: "Confidential Notes",
      description: "Restricted confidential notes.",
    },
    escalations: {
      title: "Escalations",
      description: "Escalated safeguarding cases.",
    },
  },
};

export function resolveWorkspaceStub(
  workspace: string,
  slug?: string[],
): { title: string; description: string } {
  const key = slug?.[0] ?? "dashboard";
  const workspaceStubs = WORKSPACE_STUBS[workspace];
  if (!workspaceStubs) {
    return {
      title: "Workspace",
      description: "Workspace route shell.",
    };
  }
  return (
    workspaceStubs[key] ?? {
      title: key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: `${workspace} workspace route shell.`,
    }
  );
}

export function workspaceLabel(workspace: string): string {
  return workspace.charAt(0).toUpperCase() + workspace.slice(1);
}

export function flattenNavSections(sections: NavSection[]): { href: string; label: string }[] {
  return sections.flatMap((section) =>
    section.items.map((item) => ({ href: item.href, label: item.label })),
  );
}
