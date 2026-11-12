import { roleRank } from "@/features/administration/domain/account-access";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import type { EffectiveSession } from "@/lib/portal/types";
import type { PageGrant, StaffPerson } from "./model";
import { pageById } from "./registry";

const BLOCKED_WORKSPACES = new Set(["apprentice", "employer"]);
const BLOCKED_ROLES = new Set(["Apprentice", "Employer"]);

export function canEditPageAccess(session: EffectiveSession): boolean {
  if (BLOCKED_WORKSPACES.has(session.account.workspace)) return false;
  if (BLOCKED_ROLES.has(session.account.baseRole)) return false;
  if (!hasPermission(session, PERMISSIONS.ADMIN_USERS_MANAGE)) return false;
  return true;
}

export function grantsActorMayAssign(session: EffectiveSession, grants: PageGrant[]): string | null {
  for (const grant of grants) {
    const page = pageById(grant.pageId);
    if (!page) continue;
    if (!hasPermission(session, page.requiredPermission)) {
      return `You cannot assign ${page.label} because you do not hold ${page.requiredPermission}.`;
    }
  }
  return null;
}

export function assignmentTargetError(
  session: EffectiveSession,
  target: StaffPerson | undefined,
): string | null {
  if (!target) return "That staff member is not in the directory.";
  if (target.id === session.account.id) return "You cannot assign extra pages to yourself.";
  if (BLOCKED_WORKSPACES.has(target.workspace) || BLOCKED_ROLES.has(target.role)) {
    return "Apprentice and Employer logins are not given staff page access.";
  }
  if (roleRank(target.role) >= roleRank(session.account.baseRole)) {
    return "You cannot change page access for yourself or anyone at or above your rank.";
  }
  return null;
}
