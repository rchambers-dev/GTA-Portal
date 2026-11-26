/** Mirrors public.can_read_profile. Staff are anyone who is not an apprentice or employer. */

export type ProfileReader = {
  baseRole: string | null;
  workspace: string | null;
};

const RESTRICTED_ROLES = new Set(["apprentice", "employer", "learner"]);
const RESTRICTED_WORKSPACES = new Set(["apprentice", "employer", "learner"]);

export function readerIsStaff(reader: ProfileReader): boolean {
  const role = (reader.baseRole ?? "").trim().toLowerCase();
  const workspace = (reader.workspace ?? "").trim().toLowerCase();
  if (RESTRICTED_ROLES.has(role)) return false;
  if (RESTRICTED_WORKSPACES.has(workspace)) return false;
  return true;
}

export function canReadProfile(input: {
  readerId: string;
  targetId: string;
  reader: ProfileReader;
  targetIsCurrentTutor: boolean;
}): boolean {
  if (!input.readerId || !input.targetId) return false;
  if (input.readerId === input.targetId) return true;
  if (readerIsStaff(input.reader)) return true;
  return input.targetIsCurrentTutor;
}

export function canManageTemporaryPassword(permissions: readonly string[] | undefined): boolean {
  return permissions?.includes("admin.users.manage") === true;
}
