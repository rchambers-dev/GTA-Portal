import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import {
  listSessionDeliveryRecords,
  signOffSessionDelivered,
} from "@/features/programme-delivery/domain/session-delivery-repository";
import { requireTutorDeliveryAccess } from "@/features/programme-delivery/domain/staff-delivery-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireTutorDeliveryAccess();
  if (access instanceof NextResponse) return access;
  try {
    const url = new URL(request.url);
    const programmeVersionId =
      url.searchParams.get("programmeVersionId")?.trim() || "";
    if (!programmeVersionId) {
      return NextResponse.json(
        { ok: false, error: "programmeVersionId is required." },
        { status: 400 },
      );
    }
    const supabase = createSupabaseAdminClient();
    const records = await listSessionDeliveryRecords(supabase, {
      programmeVersionId,
      apprenticeProgrammeId:
        url.searchParams.get("apprenticeProgrammeId")?.trim() || undefined,
      apprenticeId: url.searchParams.get("apprenticeId")?.trim() || undefined,
      sessionId: url.searchParams.get("sessionId")?.trim() || undefined,
    });
    return NextResponse.json({ ok: true, records });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not load delivery records.",
      },
      { status: 500 },
    );
  }
}

type PostBody = {
  programmeVersionId?: string;
  sessionId?: string;
  apprenticeId?: string;
  apprenticeProgrammeId?: string;
  spineItemId?: string | null;
  deliveredAt?: string;
  signedOffBy?: string | null;
  signedOffByName?: string;
  note?: string;
  confirm?: boolean;
};

export async function POST(request: Request) {
  const access = await requireTutorDeliveryAccess();
  if (access instanceof NextResponse) return access;
  try {
    const body = (await request.json().catch(() => ({}))) as PostBody;
    if (!body.confirm) {
      return NextResponse.json(
        {
          ok: false,
          error: "confirm: true is required to sign off Session delivered.",
        },
        { status: 400 },
      );
    }
    const supabase = createSupabaseAdminClient();
    const record = await signOffSessionDelivered(supabase, {
      programmeVersionId: body.programmeVersionId || "",
      sessionId: body.sessionId || "",
      apprenticeId: body.apprenticeId || "",
      apprenticeProgrammeId: body.apprenticeProgrammeId || "",
      spineItemId: body.spineItemId,
      deliveredAt: body.deliveredAt,
      signedOffBy: body.signedOffBy,
      signedOffByName: body.signedOffByName || "Tutor",
      note: body.note,
    });
    return NextResponse.json({ ok: true, record });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not sign off Session.";
    const status = /already signed off|required|not found|does not match|not pinned/i.test(
      message,
    )
      ? 422
      : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
