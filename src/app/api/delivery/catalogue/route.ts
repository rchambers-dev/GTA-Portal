import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { loadPublishedDeliveryCatalogue } from "@/features/programme-delivery/domain/published-delivery-catalogue";
import { requireTutorDeliveryAccess } from "@/features/programme-delivery/domain/staff-delivery-access";

export const runtime = "nodejs";

/**
 * GET published delivery catalogue for an explicit programme version pin.
 * Never selects newest / Autocare static content.
 */
export async function GET(request: Request) {
  const access = await requireTutorDeliveryAccess(request);
  if (access instanceof NextResponse) return access;
  try {
    const url = new URL(request.url);
    const programmeVersionId =
      url.searchParams.get("programmeVersionId")?.trim() || "";
    const apprenticeId = url.searchParams.get("apprenticeId")?.trim() || "";

    const supabase = createSupabaseAdminClient();

    let pin = programmeVersionId;
    if (!pin && apprenticeId) {
      const { data: enrolment, error } = await supabase
        .from("apprentice_programmes")
        .select("gta_programme_version_id")
        .eq("apprentice_id", apprenticeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      pin = (enrolment?.gta_programme_version_id as string | null)?.trim() || "";
    }

    if (!pin && !apprenticeId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "programmeVersionId or apprenticeId is required. Delivery never selects a programme version implicitly.",
        },
        { status: 400 },
      );
    }

    const catalogue = await loadPublishedDeliveryCatalogue(supabase, pin || null);
    return NextResponse.json({ ok: true, catalogue });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not load delivery catalogue.",
      },
      { status: 500 },
    );
  }
}
