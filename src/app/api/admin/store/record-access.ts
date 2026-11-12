import { pageApiAllowed } from "@/features/staff-page-access/enforce";
import { assignableRoles, roleRank } from "@/features/administration/domain/account-access";
import type { AdminPortalRole } from "@/features/administration/domain/types";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import type { EffectiveSession } from "@/lib/portal/types";

const BLOCKED_WORKSPACES = new Set(["apprentice", "employer"]);
const BLOCKED_ROLES = new Set(["Apprentice", "Employer"]);

/**
 * Apprentice and employer master records are for staff who manage records.
 * reviews.manage and records.proxy.write do not grant this, and apprentice
 * or employer logins never do.
 */
export function canReadMasterRecords(session: EffectiveSession): boolean {
  if (BLOCKED_WORKSPACES.has(session.account.workspace)) return false;
  if (BLOCKED_ROLES.has(session.account.baseRole)) return false;
  return hasPermission(session, PERMISSIONS.ADMIN_RECORDS_MANAGE);
}

export function canMutateStaffAccounts(session: EffectiveSession): boolean {
  if (BLOCKED_WORKSPACES.has(session.account.workspace)) return false;
  if (BLOCKED_ROLES.has(session.account.baseRole)) return false;
  return hasPermission(session, PERMISSIONS.ADMIN_USERS_MANAGE);
}

/** Staff account actions can change role and workspace. Proxy write must not reach them. */
export function isStaffAccountAction(action: string): boolean {
  return (
    action === "createStaff" ||
    action === "updateStaffProfile" ||
    action === "setPortalEnvironment" ||
    action === "revealApprenticePassword"
  );
}

/**
 * admin.users.manage is not enough. The actor must outrank the target and
 * the requested role, and cannot change their own role or workspace.
 */
export function staffHierarchyError(input: {
  actorId: string;
  actorRole: string;
  targetId?: string | null;
  targetRole?: string | null;
  requestedRole?: string | null;
  changesWorkspace?: boolean;
}): string | null {
  const self = Boolean(input.targetId && input.targetId === input.actorId);
  if (self) return "You cannot change your own account.";
  const belowActor = (role: string) => roleRank(role) > 0 && roleRank(role) < roleRank(input.actorRole);
  if (input.targetRole && !belowActor(input.targetRole)) {
    return "You cannot change an account at or above your rank.";
  }
  if (
    input.requestedRole &&
    !assignableRoles(input.actorRole).includes(input.requestedRole as AdminPortalRole)
  ) {
    return "You cannot assign a role at or above your rank.";
  }
  return null;
}

export function includeStaffDirectory(session: EffectiveSession): boolean {
  if (!canMutateStaffAccounts(session)) return false;
  return pageApiAllowed(
    session,
    staffActionPagePath(session.account.workspace, "updateStaffProfile"),
    "read",
  ).ok;
}

export function staffActionPagePath(workspace: string, action: string): string {
  const management = workspace === "management";
  if (action === "revealApprenticePassword") {
    return management ? "/management/accounts" : "/administration/accounts";
  }
  return management ? "/management/staff" : "/administration/staff";
}

type EnrolmentContacts = {
  email: string;
  phone: string;
  dateOfBirth: string;
  uln: string;
  workplaceContact: string;
};

export function redactEnrolmentContacts<T extends EnrolmentContacts>(
  row: T,
  allowContacts: boolean,
): T {
  if (allowContacts) return row;
  return {
    ...row,
    email: "",
    phone: "",
    dateOfBirth: "",
    uln: "",
    workplaceContact: "",
  };
}

type ApprenticeContacts = {
  email: string;
  phone: string;
  dateOfBirth: string;
  uln: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
};

export function redactApprenticeContacts<T extends ApprenticeContacts>(
  row: T,
  allowContacts: boolean,
): T {
  if (allowContacts) return row;
  return {
    ...row,
    email: "",
    phone: "",
    dateOfBirth: "",
    uln: "",
    addressLine1: "",
    addressLine2: "",
    town: "",
    postcode: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
  };
}

/** Avoid selecting apprentice email unless the caller may see master contacts. */
export function enrolmentApprenticeSelect(allowContacts: boolean): string {
  return allowContacts ? "*, apprentices(*)" : "*, apprentices(id, display_name, apprentice_reference)";
}

export function proxyApprenticeSelect(allowContacts: boolean): string {
  const apprentice = allowContacts
    ? "apprentices(id, display_name, apprentice_reference, email)"
    : "apprentices(id, display_name, apprentice_reference)";
  return `id, apprentice_id, programme_name, start_date, original_planned_end_date, status, actual_progress_percent, notes, ${apprentice}`;
}
