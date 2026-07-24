import type { DemoAccount, EffectiveSession, TemporaryAssignment } from "@/lib/portal/types";

export function isAssignmentActive(
  assignment: TemporaryAssignment,
  asOf: Date = new Date(),
): boolean {
  if (assignment.revokedAt) return false;
  const start = new Date(assignment.startsAt);
  const end = new Date(assignment.expiresAt);
  return asOf >= start && asOf <= end;
}

export function getActiveAssignments(
  assignments: TemporaryAssignment[],
  userId: string,
  asOf: Date = new Date(),
): TemporaryAssignment[] {
  return assignments.filter(
    (a) => a.userId === userId && isAssignmentActive(a, asOf),
  );
}

export function buildEffectivePermissions(
  account: DemoAccount,
  assignments: TemporaryAssignment[],
  asOf: Date = new Date(),
): string[] {
  const active = getActiveAssignments(assignments, account.id, asOf);
  const extra = active.flatMap((a) => a.permissions);
  return [...new Set([...account.permissions, ...extra])];
}

export function buildEffectiveSession(
  account: DemoAccount,
  assignments: TemporaryAssignment[],
  asOf: Date = new Date(),
): EffectiveSession {
  const activeTemporaryAssignments = getActiveAssignments(
    assignments,
    account.id,
    asOf,
  );
  const temporaryAccessLabels = activeTemporaryAssignments.map(
    (a) => a.responsibility,
  );
  return {
    account,
    permissions: buildEffectivePermissions(account, assignments, asOf),
    activeTemporaryAssignments,
    temporaryAccessLabels,
  };
}

export function hasPermission(
  session: EffectiveSession,
  permission: string,
): boolean {
  return session.permissions.includes(permission);
}

export function hasProgrammeScope(
  session: EffectiveSession,
  programmeName: string,
): boolean {
  const baseScope = session.account.programmeScope ?? [];
  if (baseScope.length === 0) return true;
  if (baseScope.includes(programmeName)) return true;

  for (const assignment of session.activeTemporaryAssignments) {
    const scope = assignment.programmeScope ?? [];
    if (scope.length === 0 || scope.includes(programmeName)) return true;
  }
  return false;
}
