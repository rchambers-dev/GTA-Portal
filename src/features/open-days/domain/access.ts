import type { EffectiveSession } from "@/lib/portal/types";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

/**
 * Same gate as the other Marketing pages: Administrator and Management
 * with records access. Tutors are refused even if the permission is present.
 */
export function canManageOpenDays(session: EffectiveSession | null): boolean {
  if (!session) return false;
  const role = session.account.baseRole.trim();
  const roleCanWrite = role === "Administrator" || role === "Management";
  return roleCanWrite && session.permissions.includes(PERMISSIONS.ADMIN_RECORDS_MANAGE);
}

export const OPEN_DAYS_PERMISSION_ERROR =
  "Open Days is limited to Administrator and Management staff with records access.";
