/**
 * Staff may use tutor delivery / source extracts.
 * Apprentices must use /api/apprentice/learning only.
 * Tutors may not use Programme Builder authoring APIs.
 */

import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import type { EffectiveSession } from "@/lib/portal/types";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

export function canUseTutorDeliveryApi(session: EffectiveSession): boolean {
  if (session.account.workspace === "apprentice") return false;
  return (
    hasPermission(session, PERMISSIONS.MODULES_DELIVER) ||
    hasPermission(session, PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW)
  );
}

export async function requireTutorDeliveryAccess(): Promise<
  EffectiveSession | NextResponse
> {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  if (!canUseTutorDeliveryApi(session)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );
  }
  return session;
}

export function deliveryWeekRange(blockNumber: number): {
  weekStart: number;
  weekEnd: number;
} | null {
  if (blockNumber === 1) return { weekStart: 1, weekEnd: 10 };
  if (blockNumber === 2) return { weekStart: 11, weekEnd: 20 };
  return null;
}
