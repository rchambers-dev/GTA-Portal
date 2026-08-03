import type { EffectiveSession } from "@/lib/portal/types";
import { hasPermission } from "./effective-permissions";
import { PERMISSIONS } from "./capabilities";
import { getDefaultWorkspaceRoute } from "./workspace";

export type RouteRule = {
  pattern: RegExp;
  permission: string;
};

/** Longest-prefix wins via ordered list (more specific first). */
export const ROUTE_RULES: RouteRule[] = [
  { pattern: /^\/safeguarding/, permission: PERMISSIONS.SAFEGUARDING_WORKSPACE_VIEW },
  { pattern: /^\/administration/, permission: PERMISSIONS.ADMIN_WORKSPACE_VIEW },
  { pattern: /^\/management/, permission: PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW },
  { pattern: /^\/quality/, permission: PERMISSIONS.QUALITY_WORKSPACE_VIEW },
  // Must not match `/apprentices…` — staff pack search
  { pattern: /^\/apprentice(\/|$)/, permission: PERMISSIONS.APPRENTICE_WORKSPACE_OWN },
  // Must not match `/employer-concerns…`
  { pattern: /^\/employer(\/|$)/, permission: PERMISSIONS.EMPLOYER_WORKSPACE_VIEW },
  { pattern: /^\/employer-concerns/, permission: PERMISSIONS.EMPLOYER_CONCERNS_MANAGE },
  { pattern: /^\/curriculum/, permission: PERMISSIONS.CURRICULUM_MANAGEMENT_VIEW },
  // Must sit above `/staff` — employment files are management/admin, not tutor workspace
  { pattern: /^\/staff-records/, permission: PERMISSIONS.ADMIN_USERS_MANAGE },
  { pattern: /^\/staff/, permission: PERMISSIONS.STAFF_WORKSPACE_VIEW },
  { pattern: /^\/workspaces\/progress-mentor/, permission: PERMISSIONS.APPRENTICE_CASELOAD_VIEW },
  { pattern: /^\/apprentices\/lifecycle/, permission: PERMISSIONS.LIFECYCLE_KANBAN_VIEW },
  { pattern: /^\/apprentices\//, permission: PERMISSIONS.APPRENTICE_WORKSPACE_VIEW },
  { pattern: /^\/apprentices$/, permission: PERMISSIONS.APPRENTICE_WORKSPACE_VIEW },
  { pattern: /^\/dashboard$/, permission: PERMISSIONS.STAFF_WORKSPACE_VIEW },
  { pattern: /^\/reviews/, permission: PERMISSIONS.REVIEWS_MANAGE },
  { pattern: /^\/employers/, permission: PERMISSIONS.EMPLOYER_CONTACTS_VIEW },
  { pattern: /^\/interventions/, permission: PERMISSIONS.INTERVENTIONS_MANAGE },
  { pattern: /^\/actions/, permission: PERMISSIONS.ACTIONS_MANAGE },
  { pattern: /^\/modules/, permission: PERMISSIONS.MODULES_DELIVER },
  { pattern: /^\/reports/, permission: PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW },
  { pattern: /^\/admin/, permission: PERMISSIONS.ADMIN_WORKSPACE_VIEW },
];

export function getRequiredPermission(pathname: string): string | null {
  for (const rule of ROUTE_RULES) {
    if (rule.pattern.test(pathname)) return rule.permission;
  }
  return null;
}

export function canAccessRoute(
  session: EffectiveSession,
  pathname: string,
): boolean {
  const required = getRequiredPermission(pathname);
  if (!required) return true;
  return hasPermission(session, required);
}

export function getRedirectForDeniedRoute(
  session: EffectiveSession,
  deniedPathname?: string,
): string {
  const destination = getDefaultWorkspaceRoute(
    session.account.workspace,
    session,
  );
  // Never bounce to the same denied URL (infinite redirect)
  if (deniedPathname && destination === deniedPathname) {
    return "/staff/dashboard";
  }
  return destination;
}
