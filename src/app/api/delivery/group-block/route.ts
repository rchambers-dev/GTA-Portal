import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireTutorDeliveryAccess } from "@/features/programme-delivery/domain/staff-delivery-access";
import { loadTeachingGroupBlockBundle } from "@/features/programme-delivery/domain/teaching-group-delivery-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireTutorDeliveryAccess(request);
  if (access instanceof NextResponse) return access;
  try {
    const url = new URL(request.url);
    const teachingGroupId = url.searchParams.get("teachingGroupId")?.trim() || "";
    const blockNumber = Number(url.searchParams.get("block") || "1");
    if (!teachingGroupId) {
      return NextResponse.json(
        { ok: false, error: "teachingGroupId is required." },
        { status: 400 },
      );
    }
    const supabase = createSupabaseAdminClient();
    const bundle = await loadTeachingGroupBlockBundle(supabase, {
      teachingGroupId,
      blockNumber,
      staffSession: access,
    });
    return NextResponse.json({
      ok: true,
      ...bundle,
      notes: {
        release:
          "Release learning grants approved learner-facing Session content to selected apprentices. It is not attendance, completion, a Task result, or OTJ.",
        futureJoiners:
          "Apprentices who join this teaching group later do not inherit earlier releases.",
        curriculum:
          "Tutors cannot edit controlled curriculum from Programme Delivery.",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load teaching-group delivery.";
    const status = /not authorised/i.test(message)
      ? 403
      : /not found/i.test(message)
        ? 404
        : /only block/i.test(message)
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
