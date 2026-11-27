import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireCurriculumAuthoringAccess } from "@/features/programme-definition/domain/curriculum-authoring-access";

export const runtime = "nodejs";

async function everyMatchingRow<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const data: T[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const page = await load(from, from + 999);
    if (page.error) throw new Error(page.error.message);
    const batch = page.data ?? [];
    data.push(...batch);
    if (batch.length < 1000) return data;
  }
  return data;
}

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

    const versionList = versions ?? [];
    const versionIds = versionList.map((version) => version.id as string);
    const primaryRows = versionIds.length
      ? await everyMatchingRow<{ programme_version_id: string }>((from, to) =>
          supabase
            .from("gta_spine_item_ksbs")
            .select("programme_version_id")
            .in("programme_version_id", versionIds)
            .eq("is_primary", true)
            .range(from, to),
        )
      : [];
    const spineRows = versionIds.length
      ? await everyMatchingRow<{ id: string; programme_version_id: string }>((from, to) =>
          supabase.from("gta_spines").select("id, programme_version_id").in("programme_version_id", versionIds).range(from, to),
        )
      : [];
    const spinesByVersion = new Map<string, string[]>();
    for (const spine of spineRows) {
      const ids = spinesByVersion.get(spine.programme_version_id) ?? [];
      ids.push(spine.id);
      spinesByVersion.set(spine.programme_version_id, ids);
    }
    const spineIds = [...spinesByVersion.values()].filter((ids) => ids.length === 1).map((ids) => ids[0]!);
    const itemRows = spineIds.length
      ? await everyMatchingRow<{ spine_id: string; planned_otj_hours: number | null }>((from, to) =>
          supabase.from("gta_spine_items").select("spine_id, planned_otj_hours").in("spine_id", spineIds).range(from, to),
        )
      : [];
    const primaryCount = new Map<string, number>();
    for (const row of primaryRows) primaryCount.set(row.programme_version_id, (primaryCount.get(row.programme_version_id) ?? 0) + 1);
    const itemsBySpine = new Map<string, { count: number; hours: number }>();
    for (const row of itemRows) {
      const current = itemsBySpine.get(row.spine_id) ?? { count: 0, hours: 0 };
      current.count += 1;
      current.hours += Number(row.planned_otj_hours) || 0;
      itemsBySpine.set(row.spine_id, current);
    }

    const rows = versionList.map((version) => {
      const spineId = spinesByVersion.get(version.id as string);
      const chosen = spineId?.length === 1 ? itemsBySpine.get(spineId[0]!) : undefined;
      return {
        programmeVersionId: version.id as string,
        programmeId: version.programme_id as string,
        programmeTitle: titleByProg.get(version.programme_id as string) || "GTA Delivery",
        internalVersion: String(version.internal_version || "1"),
        status: String(version.status || "draft"),
        standardVersionId: version.standard_version_id as string,
        updatedAt: version.updated_at as string,
        primaryCount: primaryCount.get(version.id as string) ?? 0,
        spineItemCount: chosen?.count ?? 0,
        structuredOtjHours: chosen?.hours ?? 0,
      };
    });

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
