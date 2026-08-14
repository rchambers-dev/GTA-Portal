import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireCurriculumAuthoringAccess } from "@/features/programme-definition/domain/curriculum-authoring-access";

export const runtime = "nodejs";

/**
 * List GTA programme versions for a standard.
 * Explicit catalogue only — never auto-selects "newest".
 */
export async function GET(request: Request) {
  const access = await requireCurriculumAuthoringAccess();
  if (access instanceof NextResponse) return access;
  try {
    const url = new URL(request.url);
    const standardCode = (url.searchParams.get("standardCode") || "")
      .trim()
      .toUpperCase();
    if (!standardCode) {
      return NextResponse.json(
        { ok: false, error: "standardCode is required." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: standard, error: sErr } = await supabase
      .from("se_standards")
      .select("id, standard_code, title")
      .eq("standard_code", standardCode)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!standard) {
      return NextResponse.json({ ok: true, standardCode, versions: [] });
    }

    const { data: programmes, error: pErr } = await supabase
      .from("gta_programmes")
      .select("id, title")
      .eq("standard_id", standard.id);
    if (pErr) throw new Error(pErr.message);
    const progIds = (programmes ?? []).map((p) => p.id as string);
    if (!progIds.length) {
      return NextResponse.json({ ok: true, standardCode, versions: [] });
    }

    const { data: versions, error: vErr } = await supabase
      .from("gta_programme_versions")
      .select(
        "id, programme_id, internal_version, status, standard_version_id, updated_at",
      )
      .in("programme_id", progIds)
      .order("updated_at", { ascending: false });
    if (vErr) throw new Error(vErr.message);

    const titleByProg = new Map(
      (programmes ?? []).map((p) => [p.id as string, String(p.title)]),
    );

    const rows = [];
    for (const v of versions ?? []) {
      const { count: primaryCount, error: cErr } = await supabase
        .from("gta_spine_item_ksbs")
        .select("id", { count: "exact", head: true })
        .eq("programme_version_id", v.id)
        .eq("is_primary", true);
      if (cErr) throw new Error(cErr.message);

      const { data: spine } = await supabase
        .from("gta_spines")
        .select("id")
        .eq("programme_version_id", v.id)
        .maybeSingle();
      let spineItemCount = 0;
      let structuredOtjHours = 0;
      if (spine?.id) {
        const { data: items } = await supabase
          .from("gta_spine_items")
          .select("planned_otj_hours")
          .eq("spine_id", spine.id);
        spineItemCount = items?.length ?? 0;
        structuredOtjHours = (items ?? []).reduce(
          (sum, row) => sum + (Number(row.planned_otj_hours) || 0),
          0,
        );
      }

      rows.push({
        programmeVersionId: v.id as string,
        programmeId: v.programme_id as string,
        programmeTitle: titleByProg.get(v.programme_id as string) || "GTA Delivery",
        internalVersion: String(v.internal_version || "1"),
        status: String(v.status || "draft"),
        standardVersionId: v.standard_version_id as string,
        updatedAt: v.updated_at as string,
        primaryCount: primaryCount ?? 0,
        spineItemCount,
        structuredOtjHours,
      });
    }

    return NextResponse.json({
      ok: true,
      standardCode,
      versions: rows,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not list programme versions.",
      },
      { status: 500 },
    );
  }
}
