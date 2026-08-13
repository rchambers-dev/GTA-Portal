import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import {
  createEnrolmentBlockUnlock,
  listEnrolmentBlockUnlocks,
} from "@/features/programme-delivery/domain/block-unlock-overrides-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (session.account.workspace === "apprentice") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

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
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (session.account.workspace === "apprentice") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

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
      unlockedBy: session.account.id || null,
      unlockedByName: session.account.name || "Staff",
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
