import type { EffectiveSession, WorkspaceId } from "@/lib/portal/types";
import { hasPermission } from "./effective-permissions";
import { PERMISSIONS } from "./capabilities";

/** Learning & Progress Mentor nav: caseload + progress without teaching delivery. */
export function isMentorStaffSession(session: EffectiveSession): boolean {
  return (
    hasPermission(session, PERMISSIONS.LEARNER_CASELOAD_VIEW) &&
    hasPermission(session, PERMISSIONS.PROGRESS_MONITOR) &&
    !hasPermission(session, PERMISSIONS.MODULES_DELIVER)
  );
}

export function getDefaultWorkspaceRoute(
  workspace: WorkspaceId,
  session?: EffectiveSession,
): string {
  if (workspace === "staff" && session && isMentorStaffSession(session)) {
    return "/learners/lifecycle";
  }

  switch (workspace) {
    case "learner":
      return "/learner/dashboard";
    case "employer":
      return "/employer/dashboard";
    case "staff":
      return "/staff/dashboard";
    case "quality":
      return "/quality/dashboard";
    case "management":
      return "/management/dashboard";
    case "administration":
      return "/administration/dashboard";
    case "safeguarding":
      return "/safeguarding/dashboard";
    default:
      return "/staff/dashboard";
  }
}
