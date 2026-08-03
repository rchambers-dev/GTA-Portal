import type { NavSection } from "@/lib/portal/types";

const WORKSPACE_STUBS: Record<string, Record<string, { title: string; description: string }>> = {
  apprentice: {
    dashboard: {
      title: "Apprentice Dashboard",
      description: "Personalised apprentice overview — modules, progress, and upcoming reviews.",
    },
    learning: {
      title: "My Learning",
      description: "Active learning plan and this week’s focus items for the signed-in apprentice.",
    },
    modules: {
      title: "Modules",
      description: "Published curriculum modules available to this apprentice.",
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
      description: "Support requests and welfare contacts — apprentice-safe view only.",
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
      title: "Documents",
      description: "ADM14 apprenticeship evidence pack for employers.",
    },
    documents: {
      title: "Documents",
      description: "ADM14 apprenticeship evidence pack for employers.",
    },
    messages: {
      title: "Messages",
      description: "Employer messaging with GTA.",
    },
    support: {
      title: "Support & Concerns",
      description: "GTA-first support and concern workflows — cases are handled by GTA before apprentice contact.",
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
        "Tutor queue of outcomes to cover, sign off, or ask apprentices to do again.",
    },
    "otj-approvals": {
      title: "OTJ hours",
      description: "Confirm employer-agreed off-the-job hours for your apprentices.",
    },
    assessments: {
      title: "Assessments & Marking",
      description: "Marking queue and assessment outcomes.",
    },
    reviews: {
      title: "Reviews",
      description: "Apprentice review scheduling and records.",
    },
    resources: {
      title: "Teaching Resources",
      description: "Tutor-owned resources linked to published curriculum.",
    },
    "shared-drive": {
      title: "Shared Drive",
      description:
        "Tenant Shared Drive — same shared page template used across environments.",
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
      description: "Individual apprentice support planning.",
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
    "course-builder": {
      title: "Course Builder",
      description:
        "Author groups and GTA 10+2 block packs per Skills England version.",
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
    "shared-drive": {
      title: "Shared Drive",
      description:
        "Tenant Shared Drive — same shared page template used across environments.",
    },
  },
  management: {
    dashboard: {
      title: "Management Dashboard",
      description:
        "Management overview — includes Administration apprentice ops plus management-owned staffing, roles, and programme setup.",
    },
    employers: {
      title: "Employer Records",
      description: "Shared employer records — same surface as Administration.",
    },
    "programmes-records": {
      title: "Apprenticeships",
      description: "Shared programme records — same surface as Administration.",
    },
    cohorts: {
      title: "Cohorts & Groups",
      description: "Shared cohorts and teaching groups — same surface as Administration.",
    },
    intake: {
      title: "Apprentice Intake",
      description: "Shared Apprentice Intake — same surface as Administration.",
    },
    "staff-intake": {
      title: "Staff Intake",
      description:
        "Staff onboarding — left blank for now until intake steps are agreed with leadership.",
    },
    "staff-accounts": {
      title: "Staff Account Setup",
      description:
        "Enable or disable staff portal environments — same surface as Apprentice Account Setup.",
    },
    enrolments: {
      title: "Apprentice Enrolments",
      description: "Shared Apprentice Enrolments — same surface as Administration.",
    },
    "apprentice-funding": {
      title: "Apprentice funding (RPL / KSB)",
      description:
        "Per-apprentice Knowledge / Skills / Behaviours RPL adjustments for funding and compliance. Does not fast-track classroom delivery.",
    },
    "apprentice-brag": {
      title: "Apprentice progression BRAG",
      description:
        "Pick an apprentice to see overall and per-block progression BRAG (Blue / Green / Amber / Red) against cohort dates.",
    },
    accounts: {
      title: "Apprentice Account Setup",
      description: "Enable or disable apprentice portal environments.",
    },
    "shared-drive": {
      title: "Shared Drive",
      description:
        "Tenant Shared Drive — same shared page template used across environments.",
    },
    messages: {
      title: "Messages",
      description:
        "Shared messaging — contact apprentices, employers, and GTA colleagues.",
    },
    safeguarding: {
      title: "Safeguarding",
      description:
        "Shared safeguarding contacts and welfare routes for management staff.",
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
      title: "Apprentices",
      description: "Shared apprentice file pack search — same Apprentices page used across workspaces.",
    },
    intake: {
      title: "Apprentice Intake",
      description:
        "Personal details only — get apprentices onto the system. Staff onboarding sits on Management. Pack documents live on Apprentices.",
    },
    enrolments: {
      title: "Apprentice Enrolments",
      description:
        "Enrol apprentices already on the system onto programmes — employer, cohort and position.",
    },
    employers: {
      title: "Employer Records",
      description: "Employer account records.",
    },
    programmes: {
      title: "Apprenticeships",
      description: "Apprenticeship standards and programme reference data.",
    },
    cohorts: {
      title: "Cohorts & Groups",
      description:
        "Intakes and teaching groups, each locked to a Skills England programme version.",
    },
    documents: {
      title: "Shared Drive",
      description:
        "Tenant Shared Drive — same shared page template used across environments.",
    },
    "shared-drive": {
      title: "Shared Drive",
      description:
        "Tenant Shared Drive — org files via Microsoft sign-in. apprentice packs stay on Apprentices.",
    },
    "data-quality": {
      title: "Data Quality",
      description: "Data quality checks and remediation queues.",
    },
    accounts: {
      title: "Apprentice Account Setup",
      description:
        "Enable or disable apprentice portal environments. Staff environments are managed on Management.",
    },
    messages: {
      title: "Messages",
      description:
        "Shared messaging — contact apprentices, employers, and GTA colleagues.",
    },
    safeguarding: {
      title: "Safeguarding",
      description:
        "Shared safeguarding contacts and welfare routes for administration staff.",
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
