import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireTutorDeliveryAccess } from "@/features/programme-delivery/domain/staff-delivery-access";
import { listSessionReviewReleases } from "@/features/programme-delivery/domain/session-review-release-repository";
import {
  releaseSessionReviewMaterials,
  SessionReviewReleaseError,
} from "@/features/programme-delivery/domain/release-session-review-materials";
import type { SessionReviewReleaseSource } from "@/features/programme-delivery/domain/session-review-release";

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
    const records = await listSessionReviewReleases(supabase, {
      programmeVersionId,
      apprenticeProgrammeId:
        url.searchParams.get("apprenticeProgrammeId")?.trim() || undefined,
      apprenticeId: url.searchParams.get("apprenticeId")?.trim() || undefined,
      sessionId: url.searchParams.get("sessionId")?.trim() || undefined,
      teachingGroupId:
        url.searchParams.get("teachingGroupId")?.trim() || undefined,
    });
    return NextResponse.json({ ok: true, records });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not load Session review releases.",
      },
      { status: 500 },
    );
  }
}

type PostBody = {
  confirm?: boolean;
  teachingGroupId?: string;
  sessionId?: string;
  apprenticeProgrammeIds?: string[];
  source?: SessionReviewReleaseSource;
  note?: string;
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
          error: "confirm: true is required to release Session review materials.",
        },
        { status: 400 },
      );
    }
    const source: SessionReviewReleaseSource =
      body.source === "individual" ? "individual" : "teaching_group";
    const supabase = createSupabaseAdminClient();
    const result = await releaseSessionReviewMaterials(supabase, {
      staffSession: access,
      teachingGroupId: body.teachingGroupId || "",
      sessionId: body.sessionId || "",
      selectedEnrolmentIds: body.apprenticeProgrammeIds || [],
      source,
      note: body.note,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SessionReviewReleaseError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status },
      );
    }
    const message =
      err instanceof Error
        ? err.message
        : "Could not release Session review materials.";
    const status = /required|not found|not in this teaching group|not authorised/i.test(
      message,
    )
      ? /not authorised/i.test(message)
        ? 403
        : 422
      : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
