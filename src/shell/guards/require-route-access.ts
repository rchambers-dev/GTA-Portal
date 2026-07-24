import { redirect } from "next/navigation";
import type { EffectiveSession } from "@/lib/portal/types";
import {
  canAccessRoute,
  getRedirectForDeniedRoute,
} from "@/lib/permissions/route-access";
import { hasPermission, hasProgrammeScope } from "@/lib/permissions/effective-permissions";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

const CURRICULUM_DEMO_PROGRAMME = "Accident Repair Technician";

export function assertRouteAccess(
  session: EffectiveSession,
  pathname: string,
): void {
  if (!canAccessRoute(session, pathname)) {
    redirect(getRedirectForDeniedRoute(session, pathname));
  }

  if (pathname.startsWith("/curriculum")) {
    if (!hasPermission(session, PERMISSIONS.CURRICULUM_MANAGEMENT_VIEW)) {
      redirect(getRedirectForDeniedRoute(session, pathname));
    }
    if (!hasProgrammeScope(session, CURRICULUM_DEMO_PROGRAMME)) {
      redirect(getRedirectForDeniedRoute(session, pathname));
    }
  }

  if (pathname.startsWith("/safeguarding")) {
    if (!hasPermission(session, PERMISSIONS.SAFEGUARDING_WORKSPACE_VIEW)) {
      redirect(getRedirectForDeniedRoute(session, pathname));
    }
  }
}
