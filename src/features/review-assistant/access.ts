import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import type { EffectiveSession } from "@/lib/portal/types";

const BLOCKED_WORKSPACES = new Set(["apprentice", "employer"]);
const BLOCKED_ROLES = new Set(["Apprentice", "Employer"]);

export type ReviewAssistantAccess = "office" | "tutor" | "denied";

function isBlockedAccount(session: EffectiveSession): boolean {
  return (
    BLOCKED_WORKSPACES.has(session.account.workspace) ||
    BLOCKED_ROLES.has(session.account.baseRole)
  );
}

/**
 * Opening the whole review document store matches the original admin/office
 * path. reviews.manage by itself is only the tutor caseload path.
 * Neither grant is the portal apprentice/employer master register.
 */
export function reviewAssistantAccess(session: EffectiveSession): ReviewAssistantAccess {
  if (isBlockedAccount(session)) return "denied";
  if (hasPermission(session, PERMISSIONS.ADMIN_RECORDS_MANAGE)) return "office";
  if (hasPermission(session, PERMISSIONS.REVIEWS_MANAGE)) return "tutor";
  return "denied";
}

export function canReadReviewMasterState(session: EffectiveSession): boolean {
  return reviewAssistantAccess(session) === "office";
}
