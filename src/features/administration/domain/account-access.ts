/**
 * Account Setup access: you can only manage accounts ranked lower than you.
 *
 * Owner > Management > Administrator > Quality / staff / employer / learner
 * - Admins cannot edit other admins (only Management+)
 * - Managers cannot edit other managers (only Owner)
 * - Owner can manage everyone
 */

import type { AdminPortalRole } from "./types";

export const PORTAL_ROLE_RANK: Record<AdminPortalRole, number> = {
  Learner: 10,
  Employer: 20,
  Tutor: 30,
  "Learning and Progress Mentor": 35,
  Quality: 40,
  Administrator: 60,
  Management: 80,
  Owner: 100,
};

export function roleRank(role: string): number {
  if (role in PORTAL_ROLE_RANK) {
    return PORTAL_ROLE_RANK[role as AdminPortalRole];
  }
  const normalised = role.trim().toLowerCase();
  if (normalised === "owner") return 100;
  if (normalised === "manager" || normalised === "management") return 80;
  if (normalised === "administrator" || normalised === "admin") return 60;
  if (normalised === "quality" || normalised === "quality assurance") return 40;
  if (normalised.includes("mentor")) return 35;
  if (normalised === "tutor") return 30;
  if (normalised === "employer") return 20;
  if (normalised === "learner") return 10;
  return 0;
}

/** True if actor may edit / enable the target account. */
export function canManagePortalAccount(
  actorRole: string,
  targetRole: AdminPortalRole | string,
): boolean {
  return roleRank(actorRole) > roleRank(targetRole);
}

/** Roles an actor is allowed to assign (strictly below their own rank). */
export function assignableRoles(actorRole: string): AdminPortalRole[] {
  const actor = roleRank(actorRole);
  return (Object.keys(PORTAL_ROLE_RANK) as AdminPortalRole[]).filter(
    (role) => PORTAL_ROLE_RANK[role] < actor,
  );
}

/** Portal workspace each role signs into — set automatically at intake. */
export function workspaceForRole(role: AdminPortalRole): string {
  switch (role) {
    case "Learner":
      return "learner";
    case "Employer":
      return "employer";
    case "Tutor":
    case "Learning and Progress Mentor":
      return "staff";
    case "Quality":
      return "quality";
    case "Administrator":
      return "administration";
    case "Management":
    case "Owner":
      return "management";
  }
}

const NEW_STARTER_DAYS = 14;

/** Days remaining in the new-starter window (null if not / no longer a new starter). */
export function newStarterDaysRemaining(
  programmeStartDate: string | null,
  asOf: Date = new Date(),
): number | null {
  if (!programmeStartDate) return null;
  const start = new Date(`${programmeStartDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(
    (today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays < 0) {
    // Starts in the future — treat as new starter from day 0 of programme.
    return NEW_STARTER_DAYS;
  }
  if (diffDays >= NEW_STARTER_DAYS) return null;
  return NEW_STARTER_DAYS - diffDays;
}

export function isNewStarter(programmeStartDate: string | null): boolean {
  return newStarterDaysRemaining(programmeStartDate) != null;
}

/** Map signed-in demo account → portal role used for Account Setup ranks. */
export function sessionPortalRole(account: {
  id: string;
  baseRole: string;
}): string {
  if (account.id === "jon-harrison") return "Owner";
  if (account.baseRole === "Manager") return "Management";
  if (account.baseRole === "Quality Assurance") return "Quality";
  return account.baseRole;
}
