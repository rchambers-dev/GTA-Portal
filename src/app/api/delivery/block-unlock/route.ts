import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireCurriculumAuthoringAccess } from "@/features/programme-definition/domain/curriculum-authoring-access";
import {
  createEnrolmentBlockUnlock,
  listEnrolmentBlockUnlocks,
} from "@/features/programme-delivery/domain/block-unlock-overrides-repository";
import { requireTutorDeliveryAccess } from "@/features/programme-delivery/domain/staff-delivery-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireTutorDeliveryAccess();
  if (access instanceof NextResponse) return access;

  const url = new URL(request.url);
  const apprenticeProgrammeId =
    url.searchParams.get("apprenticeProgrammeId")?.trim() || "";
  if (!apprenticeProgrammeId) {
    return NextResponse.json(
      { ok: false, error: "apprenticeProgrammeId is required." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const records = await listEnrolmentBlockUnlocks(
      supabase,
      apprenticeProgrammeId,
    );
    return NextResponse.json({ ok: true, records });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not load unlocks.",
      },
      { status: 500 },
    );
  }
}

type PostBody = {
  apprenticeProgrammeId?: string;
  spineItemId?: string;
  reason?: string;
  confirm?: boolean;
};

export async function POST(request: Request) {
  const access = await requireCurriculumAuthoringAccess();
  if (access instanceof NextResponse) return access;

  try {
    const body = (await request.json().catch(() => ({}))) as PostBody;
    if (!body.confirm) {
      return NextResponse.json(
        {
          ok: false,
          error: "confirm: true is required for an authorised Block unlock.",
        },
        { status: 400 },
      );
    }
    const supabase = createSupabaseAdminClient();
    const record = await createEnrolmentBlockUnlock(supabase, {
      apprenticeProgrammeId: body.apprenticeProgrammeId || "",
      spineItemId: body.spineItemId || "",
      unlockedBy: access.account.id || null,
      unlockedByName: access.account.name || "Staff",
      reason: body.reason || "",
    });
    return NextResponse.json({ ok: true, record });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not create unlock.",
      },
      { status: 500 },
    );
  }
}
