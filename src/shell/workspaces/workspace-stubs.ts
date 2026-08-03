/**
 * Placeholder copy for workspace routes that still fall through to
 * FeatureStubScreen. Routes with real screens or redirects are omitted.
 */

const WORKSPACE_STUBS: Record<
  string,
  Record<string, { title: string; description: string }>
> = {
  employer: {
    apprentice: {
      title: "Apprentice Overview",
      description: "High-level apprentice status without confidential GTA notes.",
    },
    progress: {
      title: "Progress",
      description: "Employer-visible progress summary.",
    },
    reviews: {
      title: "Reviews",
      description: "Employer participation in progress reviews.",
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
    messages: {
      title: "Messages",
      description: "Staff messaging.",
    },
    attendance: {
      title: "Attendance Concerns",
      description: "Attendance monitoring and escalation.",
    },
  },
  curriculum: {
    overview: {
      title: "Curriculum Overview",
      description: "Programme-scoped curriculum management entry point.",
    },
    programme: {
      title: "Programme Editor",
      description:
        "Draft programme structure — published versions are never overwritten.",
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
      description:
        "Published → Draft → Edit → Review → Approve → Publish workflow.",
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
    "staff-intake": {
      title: "Staff Intake",
      description:
        "Staff onboarding — left blank until intake steps are agreed.",
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
      description: "Audit log of responsibility changes.",
    },
  },
  administration: {
    "data-quality": {
      title: "Data Quality",
      description: "Data quality checks and remediation queues.",
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
