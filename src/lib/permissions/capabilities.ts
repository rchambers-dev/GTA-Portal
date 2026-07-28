/**
 * Permission capability strings — navigation and route guards derive from these.
 */

export const PERMISSIONS = {
  // Staff workspace
  STAFF_WORKSPACE_VIEW: "staff.workspace.view",
  LEARNERS_ASSIGNED_VIEW: "learners.assigned.view",
  SCHEDULE_VIEW: "schedule.view",
  CURRICULUM_PUBLISHED_VIEW: "curriculum.published.view",
  MODULES_DELIVER: "modules.deliver",
  ASSESSMENTS_MARK: "assessments.mark",
  REVIEWS_MANAGE: "reviews.manage",
  RESOURCES_OWN_MANAGE: "resources.own.manage",
  CURRICULUM_FEEDBACK_SUBMIT: "curriculum.feedback.submit",
  MESSAGES_VIEW: "messages.view",

  // Curriculum management pack
  CURRICULUM_MANAGEMENT_VIEW: "curriculum.management.view",
  CURRICULUM_CREATE: "curriculum.create",
  CURRICULUM_EDIT: "curriculum.edit",
  CURRICULUM_REVIEW: "curriculum.review",
  CURRICULUM_FEEDBACK_MANAGE: "curriculum.feedback.manage",
  CURRICULUM_RESOURCES_MANAGE: "curriculum.resources.manage",
  CURRICULUM_ASSESSMENTS_MANAGE: "curriculum.assessments.manage",
  CURRICULUM_KSB_MANAGE: "curriculum.ksb.manage",
  CURRICULUM_VERSION_MANAGE: "curriculum.version.manage",
  CURRICULUM_HISTORY_VIEW: "curriculum.history.view",
  CURRICULUM_PUBLISH: "curriculum.publish",

  // Mentor / progress
  LEARNER_CASELOAD_VIEW: "learner.caseload.view",
  PROGRESS_MONITOR: "progress.monitor",
  EMPLOYER_CONTACTS_VIEW: "employer.contacts.view",
  EMPLOYER_CONCERNS_MANAGE: "employer.concerns.manage",
  INTERVENTIONS_MANAGE: "interventions.manage",
  SUPPORT_PLANS_MANAGE: "support.plans.manage",
  ATTENDANCE_CONCERNS_VIEW: "attendance.concerns.view",
  ACTIONS_MANAGE: "actions.manage",

  // Lifecycle board (shared operational)
  LIFECYCLE_KANBAN_VIEW: "lifecycle.kanban.view",
  LEARNER_WORKSPACE_VIEW: "learner.workspace.view",

  // Learner
  LEARNER_WORKSPACE_OWN: "learner.workspace.own",
  LEARNER_MODULES_VIEW: "learner.modules.view",
  LEARNER_OTJ_VIEW: "learner.otj.view",

  /** Shared portal AI — CV, chat assist, learning explain, etc. */
  AI_USE: "ai.use",

  // Employer
  EMPLOYER_WORKSPACE_VIEW: "employer.workspace.view",
  EMPLOYER_APPRENTICE_VIEW: "employer.apprentice.view",
  EMPLOYER_ASK_GTA: "employer.ask.gta",
  EMPLOYER_RAISE_CONCERN: "employer.raise.concern",
  EMPLOYER_REQUEST_SUPPORT: "employer.request.support",
  EMPLOYER_CLARIFY_PROGRESS: "employer.clarify.progress",

  // Quality
  QUALITY_WORKSPACE_VIEW: "quality.workspace.view",
  QUALITY_AUDITS_VIEW: "quality.audits.view",
  QUALITY_FINDINGS_VIEW: "quality.findings.view",

  // Management
  MANAGEMENT_WORKSPACE_VIEW: "management.workspace.view",
  MANAGEMENT_PROGRAMME_SETUP: "management.programme.setup",
  MANAGEMENT_ROLES_ASSIGN: "management.roles.assign",
  MANAGEMENT_CURRICULUM_HEALTH: "management.curriculum.health",
  MANAGEMENT_EMPLOYER_CONCERNS: "management.employer.concerns",

  // Administration
  ADMIN_WORKSPACE_VIEW: "admin.workspace.view",
  ADMIN_USERS_MANAGE: "admin.users.manage",
  ADMIN_RECORDS_MANAGE: "admin.records.manage",
  RECORDS_PROXY_WRITE: "records.proxy.write",

  // Safeguarding
  SAFEGUARDING_WORKSPACE_VIEW: "safeguarding.workspace.view",
  SAFEGUARDING_CASES_VIEW: "safeguarding.cases.view",
  SAFEGUARDING_CONFIDENTIAL_VIEW: "safeguarding.confidential.view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const CURRICULUM_EDITOR_PACK: Permission[] = [
  PERMISSIONS.CURRICULUM_MANAGEMENT_VIEW,
  PERMISSIONS.CURRICULUM_CREATE,
  PERMISSIONS.CURRICULUM_EDIT,
  PERMISSIONS.CURRICULUM_REVIEW,
  PERMISSIONS.CURRICULUM_FEEDBACK_MANAGE,
  PERMISSIONS.CURRICULUM_RESOURCES_MANAGE,
  PERMISSIONS.CURRICULUM_ASSESSMENTS_MANAGE,
  PERMISSIONS.CURRICULUM_KSB_MANAGE,
  PERMISSIONS.CURRICULUM_VERSION_MANAGE,
  PERMISSIONS.CURRICULUM_HISTORY_VIEW,
];

export const STANDARD_TUTOR_PACK: Permission[] = [
  PERMISSIONS.STAFF_WORKSPACE_VIEW,
  PERMISSIONS.LEARNERS_ASSIGNED_VIEW,
  PERMISSIONS.SCHEDULE_VIEW,
  PERMISSIONS.CURRICULUM_PUBLISHED_VIEW,
  PERMISSIONS.MODULES_DELIVER,
  PERMISSIONS.ASSESSMENTS_MARK,
  PERMISSIONS.REVIEWS_MANAGE,
  PERMISSIONS.RESOURCES_OWN_MANAGE,
  PERMISSIONS.CURRICULUM_FEEDBACK_SUBMIT,
  PERMISSIONS.MESSAGES_VIEW,
  PERMISSIONS.LIFECYCLE_KANBAN_VIEW,
  PERMISSIONS.LEARNER_WORKSPACE_VIEW,
  PERMISSIONS.AI_USE,
];
