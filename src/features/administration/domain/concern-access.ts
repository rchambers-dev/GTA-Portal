import { tutorIsCounted } from "@/features/tutor-reviews/domain/dashboard";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

/** Permissions that keep the full concern list. A tutor assignment does not add these. */
export const CONCERN_READ_ALL_PERMISSIONS = [
  PERMISSIONS.SAFEGUARDING_WORKSPACE_VIEW,
  PERMISSIONS.SAFEGUARDING_CASES_VIEW,
  PERMISSIONS.SAFEGUARDING_CONFIDENTIAL_VIEW,
  PERMISSIONS.EMPLOYER_CONCERNS_MANAGE,
  PERMISSIONS.MANAGEMENT_EMPLOYER_CONCERNS,
] as const;

export function canReadAllLearnerConcerns(input: {
  baseRole: string;
  permissions: readonly string[];
}): boolean {
  if (input.baseRole === "Administrator" || input.baseRole === "Management") return true;
  return CONCERN_READ_ALL_PERMISSIONS.some((permission) => input.permissions.includes(permission));
}

/** Same invited-or-active rule as tutor reviews. Disabled and archived tutors do not count. */
export function tutorCountsForConcerns(profile: {
  portalStatus: string | null;
  archivedAt: string | null;
} | null | undefined): boolean {
  return tutorIsCounted(profile);
}

/**
 * Null means every apprentice. A set is the only apprentices this reader may see.
 */
export function concernGtaIdsForReader(input: {
  canReadAll: boolean;
  tutorCounted: boolean;
  assignedGtaIds: readonly string[];
}): Set<string> | null {
  if (input.canReadAll) return null;
  if (!input.tutorCounted) return new Set();
  return new Set(input.assignedGtaIds);
}

export function visibleConcerns<T extends { gta_id: string }>(rows: readonly T[], allowed: Set<string> | null): T[] {
  if (allowed === null) return [...rows];
  return rows.filter((row) => allowed.has(row.gta_id));
}
