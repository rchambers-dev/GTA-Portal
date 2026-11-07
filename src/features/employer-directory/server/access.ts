import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import type { EffectiveSession } from "@/lib/portal/types";

/**
 * Directory and review-learner writes are staff catalogue actions.
 * Apprentice and employer logins do not receive this permission in the role packs.
 * Authorization uses profiles.permissions, never user-editable metadata.
 */
export function canManageEmployerDirectory(session: EffectiveSession): boolean {
  return (
    hasPermission(session, PERMISSIONS.ADMIN_RECORDS_MANAGE) ||
    hasPermission(session, PERMISSIONS.REVIEWS_MANAGE)
  );
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
