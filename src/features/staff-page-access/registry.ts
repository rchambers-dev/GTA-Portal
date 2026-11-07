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
};

const STAFF_WORKSPACES = ["administration", "management"] as const;

function page(
  id: string,
  label: string,
  workspaces: WorkspaceId[],
  pattern: RegExp,
  requiredPermission: string,
  editable: boolean,
  sensitivity?: PageSensitivity,
): PortalPage {
  return { id, label, workspaces, pattern, requiredPermission, editable, sensitivity };
}

/**
 * Code registry. A stored page id that is not in this list grants nothing.
 * Apprentice and Employer workspaces are not editable here.
 */
export const PORTAL_PAGES: PortalPage[] = [
  page("management.dashboard", "Management Dashboard", ["management"], /^\/management\/dashboard$/, PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW, false),
  page("management.programme-builder", "Programme Builder", ["management"], /^\/management\/programme-builder$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true),
  page("management.course-builder", "Course Builder", ["management"], /^\/management\/course-builder$/, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP, true, "delete"),
  page("management.enrolments", "Apprentice Enrolments", ["management"], /^\/management\/enrolments$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, true, "records"),
  page("administration.dashboard", "Administration Dashboard", ["administration"], /^\/administration\/dashboard$/, PERMISSIONS.ADMIN_WORKSPACE_VIEW, false),
  page("administration.accounts", "Apprentice Account Setup", ["administration"], /^\/administration\/accounts$/, PERMISSIONS.ADMIN_USERS_MANAGE, true, "staff"),
  page("administration.enrolments", "Apprentice Enrolments", ["administration"], /^\/administration\/enrolments$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, true, "records"),
  page("onboarding.apprentices", "Onboarding apprentices", [...STAFF_WORKSPACES], /^\/(administration|management)\/onboarding\/apprentices$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, false, "records"),
  page("staff.records", "Staff Records", [...STAFF_WORKSPACES], /^\/staff-records(\/|$)/, PERMISSIONS.ADMIN_USERS_MANAGE, false, "staff"),
  page("staff.delivery", "Programme delivery", ["staff"], /^\/staff\/programme-delivery(\/|$)/, PERMISSIONS.MODULES_DELIVER, true),
  page("staff.lifecycle", "Lifecycle board", ["staff", "quality", "administration", "management"], /^\/apprentices\/lifecycle$/, PERMISSIONS.LIFECYCLE_KANBAN_VIEW, false),
  page("reviews.queue", "Review queue", ["staff", "administration", "management"], /^\/reviews(\/|$)/, PERMISSIONS.REVIEWS_MANAGE, false),
  page("quality.dashboard", "Quality Dashboard", ["quality"], /^\/quality\/dashboard$/, PERMISSIONS.QUALITY_WORKSPACE_VIEW, false),
  page("records.store", "Master record saves", [...STAFF_WORKSPACES], /^\/api\/admin\/store$/, PERMISSIONS.ADMIN_RECORDS_MANAGE, true, "records"),
  page("records.proxy", "Proxy progress write", [...STAFF_WORKSPACES], /^\/api\/management\/proxy-write$/, PERMISSIONS.RECORDS_PROXY_WRITE, true, "proxy"),
];

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
