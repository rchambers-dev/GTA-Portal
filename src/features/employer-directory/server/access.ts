import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import {
  PORTAL_ROLE_RANK,
  roleRank,
} from "@/features/administration/domain/account-access";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import type { EffectiveSession, PortalAccount } from "@/lib/portal/types";

/**
 * Owner decision, 16:52 GMT: employer and apprentice record management is
 * limited to staff who have admin.records.manage. reviews.manage is not enough.
 * Apprentice and Employer are the canonical portal roles in PORTAL_ROLE_RANK,
 * and their workspaces are apprentice and employer. A stray permission on
 * those accounts does not admit them.
 */
export function isApprenticeOrEmployerAccount(account: PortalAccount): boolean {
  if (account.workspace === "apprentice" || account.workspace === "employer") {
    return true;
  }
  const rank = roleRank(account.baseRole);
  return rank > 0 && rank <= PORTAL_ROLE_RANK.Employer;
}

export function canManageEmployerDirectory(session: EffectiveSession): boolean {
  if (!hasPermission(session, PERMISSIONS.ADMIN_RECORDS_MANAGE)) return false;
  return !isApprenticeOrEmployerAccount(session.account);
}

export async function requireEmployerDirectoryAccess(): Promise<
  EffectiveSession | NextResponse
> {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!canManageEmployerDirectory(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}
