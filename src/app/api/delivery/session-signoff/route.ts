import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { listSessionDeliveryRecords } from "@/features/programme-delivery/domain/session-delivery-repository";
import { requireTutorDeliveryAccess } from "@/features/programme-delivery/domain/staff-delivery-access";

export const runtime = "nodejs";

/** Historical pilot records only. New writes are rejected. */
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
    return NextResponse.json({ ok: true, records, deprecated: true });
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

export async function POST() {
  const access = await requireTutorDeliveryAccess();
  if (access instanceof NextResponse) return access;
  return NextResponse.json(
    {
      ok: false,
      error:
        "Session delivery sign-off is no longer used. Release learning to the teaching group instead.",
    },
    { status: 410 },
  );
}
