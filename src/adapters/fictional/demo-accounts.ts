import type { DemoAccount } from "@/lib/portal/types";
import {
  CURRICULUM_EDITOR_PACK,
  PERMISSIONS,
  STANDARD_TUTOR_PACK,
} from "@/lib/permissions/capabilities";

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "alex-morgan",
    name: "Alex Morgan",
    initials: "AM",
    email: "alex.morgan@example.gta.local",
    baseRole: "Learner",
    responsibilities: [],
    workspace: "learner",
    permissions: [
      PERMISSIONS.LEARNER_WORKSPACE_OWN,
      PERMISSIONS.LEARNER_MODULES_VIEW,
      PERMISSIONS.LEARNER_EVIDENCE_VIEW,
      PERMISSIONS.MESSAGES_VIEW,
    ],
  },
  {
    id: "james-wilson",
    name: "James Wilson",
    initials: "JW",
    email: "james.wilson@example.gta.local",
    baseRole: "Employer",
    responsibilities: [],
    workspace: "employer",
    permissions: [
      PERMISSIONS.EMPLOYER_WORKSPACE_VIEW,
      PERMISSIONS.EMPLOYER_APPRENTICE_VIEW,
      PERMISSIONS.MESSAGES_VIEW,
      PERMISSIONS.EMPLOYER_ASK_GTA,
      PERMISSIONS.EMPLOYER_RAISE_CONCERN,
      PERMISSIONS.EMPLOYER_REQUEST_SUPPORT,
      PERMISSIONS.EMPLOYER_CLARIFY_PROGRESS,
    ],
  },
  {
    id: "daniel-turner",
    name: "Daniel Turner",
    initials: "DT",
    email: "daniel.turner@example.gta.local",
    baseRole: "Tutor",
    responsibilities: [],
    department: "Automotive",
    workspace: "staff",
    permissions: [...STANDARD_TUTOR_PACK],
    departmentScope: ["Automotive"],
  },
  {
    id: "sarah-patel",
    name: "Sarah Patel",
    initials: "SP",
    email: "sarah.patel@example.gta.local",
    baseRole: "Tutor",
    responsibilities: ["Curriculum Editor"],
    department: "Automotive",
    workspace: "staff",
    permissions: [...STANDARD_TUTOR_PACK, ...CURRICULUM_EDITOR_PACK],
    departmentScope: ["Automotive"],
    programmeScope: ["Accident Repair Technician"],
  },
  {
    id: "reiss-chambers",
    name: "Reiss Chambers",
    initials: "RC",
    email: "reiss.chambers@example.gta.local",
    baseRole: "Learning and Progress Mentor",
    responsibilities: [],
    workspace: "staff",
    permissions: [
      PERMISSIONS.STAFF_WORKSPACE_VIEW,
      PERMISSIONS.LEARNER_CASELOAD_VIEW,
      PERMISSIONS.PROGRESS_MONITOR,
      PERMISSIONS.REVIEWS_MANAGE,
      PERMISSIONS.EMPLOYER_CONTACTS_VIEW,
      PERMISSIONS.EMPLOYER_CONCERNS_MANAGE,
      PERMISSIONS.INTERVENTIONS_MANAGE,
      PERMISSIONS.SUPPORT_PLANS_MANAGE,
      PERMISSIONS.ATTENDANCE_CONCERNS_VIEW,
      PERMISSIONS.ACTIONS_MANAGE,
      PERMISSIONS.MESSAGES_VIEW,
      PERMISSIONS.LIFECYCLE_KANBAN_VIEW,
      PERMISSIONS.LEARNER_WORKSPACE_VIEW,
    ],
  },
  {
    id: "rachel-green",
    name: "Rachel Green",
    initials: "RG",
    email: "rachel.green@example.gta.local",
    baseRole: "Quality Assurance",
    responsibilities: [],
    workspace: "quality",
    permissions: [
      PERMISSIONS.QUALITY_WORKSPACE_VIEW,
      PERMISSIONS.QUALITY_AUDITS_VIEW,
      PERMISSIONS.QUALITY_FINDINGS_VIEW,
      PERMISSIONS.CURRICULUM_HISTORY_VIEW,
      PERMISSIONS.CURRICULUM_FEEDBACK_MANAGE,
      PERMISSIONS.LIFECYCLE_KANBAN_VIEW,
      PERMISSIONS.LEARNER_WORKSPACE_VIEW,
    ],
  },
  {
    id: "jon-harrison",
    name: "Jon Harrison",
    initials: "JH",
    email: "jon.harrison@example.gta.local",
    baseRole: "Manager",
    responsibilities: [],
    workspace: "management",
    permissions: [
      PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW,
      PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP,
      PERMISSIONS.MANAGEMENT_ROLES_ASSIGN,
      PERMISSIONS.MANAGEMENT_CURRICULUM_HEALTH,
      PERMISSIONS.MANAGEMENT_EMPLOYER_CONCERNS,
      PERMISSIONS.LIFECYCLE_KANBAN_VIEW,
      PERMISSIONS.LEARNER_WORKSPACE_VIEW,
    ],
  },
  {
    id: "emma-clarke",
    name: "Emma Clarke",
    initials: "EC",
    email: "emma.clarke@example.gta.local",
    baseRole: "Administrator",
    responsibilities: [],
    workspace: "administration",
    permissions: [
      PERMISSIONS.ADMIN_WORKSPACE_VIEW,
      PERMISSIONS.ADMIN_USERS_MANAGE,
      PERMISSIONS.ADMIN_RECORDS_MANAGE,
    ],
  },
  {
    id: "laura-bennett",
    name: "Laura Bennett",
    initials: "LB",
    email: "laura.bennett@example.gta.local",
    baseRole: "Safeguarding Lead",
    responsibilities: [],
    workspace: "safeguarding",
    permissions: [
      PERMISSIONS.SAFEGUARDING_WORKSPACE_VIEW,
      PERMISSIONS.SAFEGUARDING_CASES_VIEW,
      PERMISSIONS.SAFEGUARDING_CONFIDENTIAL_VIEW,
    ],
  },
];

export const DEFAULT_DEMO_ACCOUNT_ID = "sarah-patel";

export function getDemoAccountById(id: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.id === id);
}

export function formatRoleLabel(account: DemoAccount): string {
  if (account.responsibilities.length === 0) return account.baseRole;
  return `${account.baseRole} · ${account.responsibilities.join(" · ")}`;
}
