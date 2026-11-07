/**
 * Programme Builder / Course Builder authoring is a curriculum-owner
 * capability. UI gating is not a security boundary.
 *
 * Required: management.workspace.view + management.programme.setup
 * Tutors (modules.deliver only) must use delivery APIs.
 */

import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import type { EffectiveSession } from "@/lib/portal/types";
import { pageApiAllowed } from "@/features/staff-page-access/enforce";

export function canAuthorProgramme(session: EffectiveSession): boolean {
  if (session.account.workspace === "apprentice") return false;
  return (
    hasPermission(session, PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW) &&
    hasPermission(session, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP)
  );
}

export async function requireCurriculumAuthoringAccess(
  request?: Request,
): Promise<EffectiveSession | NextResponse> {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  if (!canAuthorProgramme(session)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );
  }
  const pathname = request ? new URL(request.url).pathname : "";
  const page = pageApiAllowed(session, pathname, request && request.method !== "GET" ? "edit" : "read");
  if (!page.ok) {
    return NextResponse.json({ ok: false, error: page.error }, { status: 403 });
  }
  return session;
}
