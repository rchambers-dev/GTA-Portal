import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireTutorDeliveryAccess } from "@/features/programme-delivery/domain/staff-delivery-access";
import {
  listTeachingGroupRoster,
  listTeachingGroupsForSession,
} from "@/features/programme-delivery/domain/teaching-group-delivery-repository";
import { eligibleReleaseRoster } from "@/features/programme-delivery/domain/teaching-group-delivery";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireTutorDeliveryAccess();
  if (access instanceof NextResponse) return access;
  try {
    const supabase = createSupabaseAdminClient();
    const groups = await listTeachingGroupsForSession(supabase, access);
    const withRoster = await Promise.all(
      groups.map(async (group) => {
        const roster = eligibleReleaseRoster(
          await listTeachingGroupRoster(supabase, group.id),
        );
        return {
          id: group.id,
          name: group.name,
          tutorName: group.tutorName,
          collegeDays: group.collegeDays,
          apprenticeCount: roster.length,
          programmeVersionId:
            roster.find((row) => row.programmeVersionId)?.programmeVersionId ||
            null,
        };
      }),
    );
    return NextResponse.json({ ok: true, teachingGroups: withRoster });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not load teaching groups.",
      },
      { status: 500 },
    );
  }
}
