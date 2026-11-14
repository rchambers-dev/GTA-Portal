import type { EffectiveSession } from "@/lib/portal/types";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

/**
 * TODO(perms): replace this with a Read / Edit / Admin tab
 * (onboarding.view, onboarding.edit, onboarding.admin).
 * Until that tab exists, Candidates uses the same staff page-access gate as
 * the other Onboarding pages. Tutors are refused even if a permission is granted.
 */
export function canManageCandidates(session: EffectiveSession | null): boolean {
  if (!session) return false;
  const role = session.account.baseRole.trim();
  if (role === "Tutor") return false;
  const roleCanWrite = role === "Administrator" || role === "Management";
  return roleCanWrite && session.permissions.includes(PERMISSIONS.ADMIN_RECORDS_MANAGE);
}

export const CANDIDATES_PERMISSION_ERROR =
  "You do not have permission to change candidates. Administrator and Management staff with onboarding access can. Tutors cannot.";
