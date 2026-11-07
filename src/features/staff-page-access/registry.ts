import type { WorkspaceId } from "@/lib/portal/types";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

export type PageSensitivity = "records" | "staff" | "proxy" | "delete";

export type PortalPage = {
  id: string;
  label: string;
  workspaces: WorkspaceId[];
  pattern: RegExp;
  editable: boolean;
  requiredPermission: string;
  sensitivity?: PageSensitivity;
  /** write = POST/PUT/PATCH/DELETE. read = GET. */
  methods?: Array<"GET" | "POST" | "PUT" | "PATCH" | "DELETE">;
};

const ADMIN_MGMT = ["administration", "management"] as const;
const STAFF_SIDE = ["staff", "administration", "management", "quality"] as const;

function page(
  id: string,
  label: string,
  workspaces: readonly WorkspaceId[],
  pattern: RegExp,
  requiredPermission: string,
  editable: boolean,
  sensitivity?: PageSensitivity,
  methods?: PortalPage["methods"],
): PortalPage {
  return {
    id,
    label,
    workspaces: [...workspaces],
    pattern,
    requiredPermission,
    editable,
    sensitivity,
    methods,
  };
}

/**
 * Explicit pages only. A configured workspace denies a URL that matches none
 * of these patterns. Patterns stop at a known feature; they do not swallow
 * every future path under /administration or /api.
 */
export const PORTAL_PAGES: PortalPage[] = [
  page("management.dashboard", "Management Dashboard", ["management"], /^\/management\/dashboard$/, PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW, false),
  page("management.programme-builder", "Programme Builder", ["management"], /^\/management\/programme-builder$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true),
  page("management.course-builder", "Course Builder", ["management"], /^\/management\/course-builder$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true, "delete"),
  page("management.enrolments", "Enrolments", ["management"], /^\/management\/enrolments$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, true, "records"),
  page("management.programmes", "Apprenticeships", ["management"], /^\/management\/programmes-records$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, true, "records"),
  page("management.cohorts", "Cohorts", ["management"], /^\/management\/cohorts$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, true, "records"),
  page("management.teaching-groups", "Teaching groups", ["management"], /^\/management\/teaching-groups$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, true, "delete"),
  page("management.funding", "Apprentice funding", ["management"], /^\/management\/(apprentice-funding|ksb-rpl)$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true),
  page("management.tnp", "Apprentice TNP", ["management"], /^\/management\/(apprentice-tnp|tnp1)$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true),
  page("management.brag", "Progression BRAG", ["management"], /^\/management\/(apprentice-brag|progression-brag)(\/task\/[^/]+)?$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, false),
  page("management.shared-drive", "Shared drive", ["management"], /^\/management\/shared-drive$/, PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW, false),
  page("management.messages", "Messages", ["management"], /^\/management\/messages$/, PERMISSIONS.MESSAGES_VIEW, false),
  page("management.safeguarding", "Safeguarding contacts", ["management"], /^\/management\/safeguarding$/, PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW, false),
  page("management.accounts", "Apprentice account setup", ["management"], /^\/management\/accounts$/, PERMISSIONS.ADMIN_USERS_MANAGE, true, "staff"),
  page("management.staff-role", "Staff role and login", ["management"], /^\/management\/(staff|staff-accounts)$/, PERMISSIONS.ADMIN_USERS_MANAGE, true, "staff"),
  page("administration.dashboard", "Administration Dashboard", ["administration"], /^\/administration\/dashboard$/, PERMISSIONS.ADMIN_WORKSPACE_VIEW, false),
  page("administration.accounts", "Apprentice Account Setup", ["administration"], /^\/administration\/accounts$/, PERMISSIONS.ADMIN_USERS_MANAGE, true, "staff"),
  page("administration.enrolments", "Enrolments", ["administration"], /^\/administration\/enrolments$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, true, "records"),
  page("administration.programmes", "Apprenticeships", ["administration"], /^\/administration\/programmes$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, true, "records"),
  page("administration.cohorts", "Cohorts", ["administration"], /^\/administration\/cohorts$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, true, "records"),
  page("administration.teaching-groups", "Teaching groups", ["administration"], /^\/administration\/teaching-groups$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, true, "delete"),
  page("administration.shared-drive", "Shared drive", ["administration"], /^\/administration\/shared-drive$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, false),
  page("administration.messages", "Messages", ["administration"], /^\/administration\/messages$/, PERMISSIONS.MESSAGES_VIEW, false),
  page("administration.safeguarding", "Safeguarding contacts", ["administration"], /^\/administration\/safeguarding$/, PERMISSIONS.ADMIN_WORKSPACE_VIEW, false),
  page("administration.staff-role", "Staff role and login", ["administration"], /^\/administration\/staff$/, PERMISSIONS.ADMIN_USERS_MANAGE, true, "staff"),
  page("onboarding", "Onboarding", [...ADMIN_MGMT], /^\/(administration|management)\/onboarding(\/.*)?$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, false, "records"),
  page("marketing", "Marketing and recruitment", [...ADMIN_MGMT], /^\/(administration|management)\/marketing(\/.*)?$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, false),
  page("staff.records", "Staff Records", [...ADMIN_MGMT], /^\/staff-records(\/[^/]+)?$/, PERMISSIONS.ADMIN_USERS_MANAGE, false, "staff"),
  page("staff.dashboard", "Staff dashboard", ["staff"], /^\/staff\/dashboard$/, PERMISSIONS.STAFF_WORKSPACE_VIEW, false),
  page("staff.schedule", "Teaching schedule", ["staff"], /^\/staff\/schedule$/, PERMISSIONS.SCHEDULE_VIEW, false),
  page("staff.delivery", "Programme delivery", ["staff"], /^\/staff\/programme-delivery(\/.*)?$/, PERMISSIONS.MODULES_DELIVER, true),
  page("staff.otj", "OTJ approvals", ["staff"], /^\/staff\/otj-approvals$/, PERMISSIONS.MODULES_DELIVER, true),
  page("staff.shared-drive", "Shared drive", ["staff"], /^\/staff\/shared-drive$/, PERMISSIONS.STAFF_WORKSPACE_VIEW, false),
  page("staff.messages", "Messages", ["staff"], /^\/staff\/messages$/, PERMISSIONS.MESSAGES_VIEW, false),
  page("staff.lifecycle", "Lifecycle board", [...STAFF_SIDE], /^\/apprentices\/lifecycle$/, PERMISSIONS.LIFECYCLE_KANBAN_VIEW, false),
  page("apprentice.records", "Apprentice records", [...STAFF_SIDE], /^\/apprentices(\/(?!lifecycle$)[^/]+(\/(actions|evidence|interventions|reviews|timeline))?)?$/, PERMISSIONS.APPRENTICE_WORKSPACE_VIEW, false),
  page("reviews.queue", "Review queue", ["staff", "administration", "management"], /^\/reviews$/, PERMISSIONS.REVIEWS_MANAGE, true),
  page("reviews.record", "Review record", ["staff", "administration", "management"], /^\/reviews\/(?!assistant$)[^/]+$/, PERMISSIONS.REVIEWS_MANAGE, true),
  page("reviews.assistant", "Review Assistant", ["staff", "administration", "management"], /^\/reviews\/assistant$/, PERMISSIONS.REVIEWS_MANAGE, true),
  page("reviews.api.state", "Review document save", ["staff", "administration", "management"], /^\/api\/reviews-assistant\/state$/, PERMISSIONS.REVIEWS_MANAGE, true, undefined, ["GET", "POST", "PUT"]),
  page("reviews.api.tutor-state", "Tutor review save", ["staff", "administration", "management"], /^\/api\/reviews-assistant\/tutor-state$/, PERMISSIONS.REVIEWS_MANAGE, true, undefined, ["GET", "POST", "PATCH"]),
  page("reviews.api.attachment", "Review attachment", ["staff", "administration", "management"], /^\/api\/reviews-assistant\/review-attachment$/, PERMISSIONS.REVIEWS_MANAGE, true, undefined, ["GET", "POST"]),
  page("reviews.api.feedback", "Review feedback", ["staff", "administration", "management"], /^\/api\/reviews-assistant\/feedback$/, PERMISSIONS.REVIEWS_MANAGE, true, undefined, ["GET", "POST"]),
  page("reviews.api.reword", "Review reword", ["staff", "administration", "management"], /^\/api\/reviews-assistant\/tutor-reword$/, PERMISSIONS.REVIEWS_MANAGE, true, undefined, ["POST"]),
  page("reviews.api.form-template", "Review PDF template", ["staff", "administration", "management"], /^\/api\/reviews-assistant\/review-form\/template$/, PERMISSIONS.REVIEWS_MANAGE, false, undefined, ["GET"]),
  page("reviews.api.form-word", "Review Word template", ["staff", "administration", "management"], /^\/api\/reviews-assistant\/review-form\/word-template$/, PERMISSIONS.REVIEWS_MANAGE, false, undefined, ["GET"]),
  page("mentor.workspace", "Progress mentor workspace", ["staff"], /^\/workspaces\/progress-mentor(\/.*)?$/, PERMISSIONS.APPRENTICE_CASELOAD_VIEW, false),
  page("quality.dashboard", "Quality Dashboard", ["quality"], /^\/quality\/dashboard$/, PERMISSIONS.QUALITY_WORKSPACE_VIEW, false),
  page("quality.audits", "Quality audits and findings", ["quality"], /^\/quality\/(audits|observations|sampling|compliance|findings|improvements|feedback-trends|history)$/, PERMISSIONS.QUALITY_WORKSPACE_VIEW, false),
  page("quality.shared-drive", "Quality shared drive", ["quality"], /^\/quality\/shared-drive$/, PERMISSIONS.QUALITY_WORKSPACE_VIEW, false),
  page("safeguarding.dashboard", "Safeguarding workspace", ["safeguarding"], /^\/safeguarding(\/.*)?$/, PERMISSIONS.SAFEGUARDING_WORKSPACE_VIEW, false),
  page("reports", "Reports", ["management", "administration"], /^\/reports$/, PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW, false),
  page("curriculum", "Curriculum", ["staff", "management", "quality"], /^\/curriculum(\/.*)?$/, PERMISSIONS.CURRICULUM_MANAGEMENT_VIEW, true),
  page("employers.directory", "Employers", [...STAFF_SIDE], /^\/employers(\/[^/]+)?$/, PERMISSIONS.EMPLOYER_CONTACTS_VIEW, false),
  page("employer.concerns", "Employer concerns", [...STAFF_SIDE], /^\/employer-concerns(\/[^/]+)?$/, PERMISSIONS.EMPLOYER_CONCERNS_MANAGE, true),
  page("interventions", "Interventions", [...STAFF_SIDE], /^\/interventions(\/[^/]+)?$/, PERMISSIONS.INTERVENTIONS_MANAGE, true),
  page("actions", "Actions", [...STAFF_SIDE], /^\/actions(\/[^/]+)?$/, PERMISSIONS.ACTIONS_MANAGE, true),
  page("modules", "Modules", ["staff"], /^\/modules(\/[^/]+)?$/, PERMISSIONS.MODULES_DELIVER, true),
  page("records.store", "Master record saves", [...ADMIN_MGMT], /^\/api\/admin\/store$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, true, "records", ["GET", "POST"]),
  page("records.proxy", "Proxy progress write", [...ADMIN_MGMT], /^\/api\/management\/proxy-write$/, PERMISSIONS.RECORDS_PROXY_WRITE, true, "proxy", ["GET", "POST"]),
  page("api.delivery.block-unlock", "Block unlock", ["staff", "management"], /^\/api\/delivery\/block-unlock$/, PERMISSIONS.STAFF_WORKSPACE_VIEW, true, undefined, ["GET", "POST"]),
  page("api.delivery.block1", "Block 1 delivery", ["staff", "management"], /^\/api\/delivery\/block1$/, PERMISSIONS.STAFF_WORKSPACE_VIEW, false, undefined, ["GET"]),
  page("api.delivery.catalogue", "Delivery catalogue", ["staff", "management"], /^\/api\/delivery\/catalogue$/, PERMISSIONS.STAFF_WORKSPACE_VIEW, false, undefined, ["GET"]),
  page("api.delivery.group-block", "Group block", ["staff", "management"], /^\/api\/delivery\/group-block$/, PERMISSIONS.STAFF_WORKSPACE_VIEW, false, undefined, ["GET"]),
  page("api.delivery.teaching-groups", "Delivery teaching groups", ["staff", "management"], /^\/api\/delivery\/teaching-groups$/, PERMISSIONS.STAFF_WORKSPACE_VIEW, false, undefined, ["GET"]),
  page("api.delivery.session-learning-release", "Session learning release", ["staff", "management"], /^\/api\/delivery\/session-learning-release$/, PERMISSIONS.MODULES_DELIVER, true, undefined, ["GET", "POST"]),
  page("api.delivery.session-review-release", "Session review release", ["staff", "management"], /^\/api\/delivery\/session-review-release$/, PERMISSIONS.MODULES_DELIVER, true, undefined, ["GET", "POST"]),
  page("api.delivery.session-signoff", "Session sign-off", ["staff", "management"], /^\/api\/delivery\/session-signoff$/, PERMISSIONS.MODULES_DELIVER, true, undefined, ["GET", "POST"]),
  page("api.delivery.resource-file", "Delivery resource file", ["staff", "management"], /^\/api\/delivery\/resources\/[^/]+\/file$/, PERMISSIONS.STAFF_WORKSPACE_VIEW, false, undefined, ["GET"]),
  page("api.delivery.resource-preview", "Delivery resource preview", ["staff", "management"], /^\/api\/delivery\/resources\/[^/]+\/preview$/, PERMISSIONS.STAFF_WORKSPACE_VIEW, false, undefined, ["GET"]),
  page("api.delivery.resource-slide", "Delivery resource slide", ["staff", "management"], /^\/api\/delivery\/resources\/[^/]+\/preview\/slides\/[^/]+$/, PERMISSIONS.STAFF_WORKSPACE_VIEW, false, undefined, ["GET"]),
  page("api.authoring.tasks", "Course tasks", ["management"], /^\/api\/management\/course-builder\/tasks$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true, "delete", ["GET", "PUT", "DELETE"]),
  page("api.authoring.task-links", "Task session links", ["management"], /^\/api\/management\/course-builder\/task-session-links$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true, "delete", ["GET", "PUT", "DELETE"]),
  page("api.authoring.activity", "Programme activity", ["management"], /^\/api\/management\/programme-definition\/activity$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true, undefined, ["GET", "POST"]),
  page("api.authoring.analysis", "Curriculum analysis", ["management"], /^\/api\/management\/programme-definition\/curriculum-analysis$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true, undefined, ["GET", "POST"]),
  page("api.authoring.analysis-run", "Curriculum analysis run", ["management"], /^\/api\/management\/programme-definition\/curriculum-analysis\/[^/]+$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, false, undefined, ["GET"]),
  page("api.authoring.import", "Programme import", ["management"], /^\/api\/management\/programme-definition\/import$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true, undefined, ["POST"]),
  page("api.authoring.recommend", "Recommend intent", ["management"], /^\/api\/management\/programme-definition\/recommend-intent$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true, undefined, ["POST"]),
  page("api.authoring.resources", "Programme resources", ["management"], /^\/api\/management\/programme-definition\/resources$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true, "delete", ["GET", "POST", "PUT", "DELETE"]),
  page("api.authoring.extract", "Resource extract", ["management", "staff"], /^\/api\/management\/programme-definition\/resources\/extract$/, PERMISSIONS.STAFF_WORKSPACE_VIEW, false, undefined, ["GET"]),
  page("api.authoring.sessions", "Programme sessions", ["management"], /^\/api\/management\/programme-definition\/sessions$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true, undefined, ["GET", "PATCH"]),
  page("api.authoring.spine", "Programme spine", ["management"], /^\/api\/management\/programme-definition\/spine$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true, undefined, ["GET", "PUT"]),
  page("api.authoring.versions", "Programme versions", ["management"], /^\/api\/management\/programme-definition\/versions$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, false, undefined, ["GET"]),
  page("api.apprentice.learning", "Apprentice learning", ["apprentice"], /^\/api\/apprentice\/learning$/, PERMISSIONS.APPRENTICE_WORKSPACE_OWN, false, undefined, ["GET"]),
  page("api.apprentice.session", "Apprentice session", ["apprentice"], /^\/api\/apprentice\/learning\/sessions\/[^/]+$/, PERMISSIONS.APPRENTICE_WORKSPACE_OWN, false, undefined, ["GET"]),
  page("api.apprentice.resource", "Apprentice resource", ["apprentice"], /^\/api\/apprentice\/learning\/resources\/[^/]+$/, PERMISSIONS.APPRENTICE_WORKSPACE_OWN, false, undefined, ["GET"]),
  page("api.apprentice.resource-file", "Apprentice resource file", ["apprentice"], /^\/api\/apprentice\/learning\/resources\/[^/]+\/file$/, PERMISSIONS.APPRENTICE_WORKSPACE_OWN, false, undefined, ["GET"]),
  page("api.apprentice.resource-preview", "Apprentice resource preview", ["apprentice"], /^\/api\/apprentice\/learning\/resources\/[^/]+\/preview$/, PERMISSIONS.APPRENTICE_WORKSPACE_OWN, false, undefined, ["GET"]),
  page("api.apprentice.resource-slide", "Apprentice resource slide", ["apprentice"], /^\/api\/apprentice\/learning\/resources\/[^/]+\/preview\/slides\/[^/]+$/, PERMISSIONS.APPRENTICE_WORKSPACE_OWN, false, undefined, ["GET"]),
  page("api.apprentice.me", "Apprentice profile", ["apprentice"], /^\/api\/apprentice\/me$/, PERMISSIONS.APPRENTICE_WORKSPACE_OWN, false, undefined, ["GET"]),
  page("api.safeguarding.leads", "Safeguarding leads", [...STAFF_SIDE, "safeguarding"], /^\/api\/safeguarding\/leads$/, PERMISSIONS.STAFF_WORKSPACE_VIEW, false, undefined, ["GET"]),
  page("api.ai", "Portal AI", [...STAFF_SIDE, "apprentice"], /^\/api\/ai\/run$/, PERMISSIONS.AI_USE, true, undefined, ["GET", "POST"]),
  page("api.address", "Address lookup", [...STAFF_SIDE, "apprentice", "employer"], /^\/api\/address\/lookup$/, PERMISSIONS.STAFF_WORKSPACE_VIEW, false, undefined, ["GET"]),
  page("api.gifs", "GIF search", [...STAFF_SIDE, "apprentice", "employer"], /^\/api\/gifs$/, PERMISSIONS.MESSAGES_VIEW, false, undefined, ["GET"]),
];

export const EXEMPT_PAGE_PREFIXES = ["/staff-permissions", "/api/staff-page-access"];

export function pageById(id: string): PortalPage | undefined {
  return PORTAL_PAGES.find((item) => item.id === id);
}

export function pagesForWorkspace(workspace: WorkspaceId): PortalPage[] {
  return PORTAL_PAGES.filter((item) => item.workspaces.includes(workspace));
}

export function matchPortalPage(pathname: string, workspace: WorkspaceId): PortalPage | undefined {
  const pathOnly = pathname.split("?")[0] || pathname;
  const matches = pagesForWorkspace(workspace).filter((item) => item.pattern.test(pathOnly));
  matches.sort((left, right) => right.pattern.source.length - left.pattern.source.length);
  return matches[0];
}

export function isExemptPath(pathname: string): boolean {
  const pathOnly = pathname.split("?")[0] || pathname;
  return EXEMPT_PAGE_PREFIXES.some((prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`));
}
