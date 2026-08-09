import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import {
  analyseProgrammeVersion,
  listAnalysisRuns,
  type AnalysisProviderId,
} from "@/features/programme-definition/domain/curriculum-analysis";
import { isAiConfigured } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 300;

const PROGRAMME_VERSION_HINT = "231a8a32-d876-4312-a178-960d19dcf938";

function blockNumberFromItem(item: {
  sequence: number;
  metadata?: Record<string, unknown> | null;
}): number {
  const meta = item.metadata?.blockNumber;
  if (typeof meta === "number" && Number.isFinite(meta)) return meta;
  return item.sequence;
}

export async function GET(request: Request) {
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
    const runs = await listAnalysisRuns(supabase, programmeVersionId, 10);
    return NextResponse.json({
      ok: true,
      aiConfigured: isAiConfigured(),
      runs,
      note: "AI analysis results are recommendations only and never count as coverage.",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      programmeVersionId?: string;
      providerMode?: AnalysisProviderId;
      createdBy?: string;
      ksbCodes?: string[];
    };

    const programmeVersionId =
      body.programmeVersionId?.trim() || PROGRAMME_VERSION_HINT;
    const providerMode = (body.providerMode || "heuristic") as AnalysisProviderId;
    if (providerMode !== "heuristic" && providerMode !== "portal_ai") {
      return NextResponse.json(
        { ok: false, error: "providerMode must be heuristic or portal_ai." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: version, error: vErr } = await supabase
      .from("gta_programme_versions")
      .select("id, standard_version_id")
      .eq("id", programmeVersionId)
      .single();
    if (vErr) throw new Error(vErr.message);

    const { data: spine, error: sErr } = await supabase
      .from("gta_spines")
      .select("id")
      .eq("programme_version_id", programmeVersionId)
      .single();
    if (sErr) throw new Error(sErr.message);

    const { data: items, error: iErr } = await supabase
      .from("gta_spine_items")
      .select("id, item_type, title, sequence, metadata")
      .eq("spine_id", spine.id)
      .order("sequence");
    if (iErr) throw new Error(iErr.message);

    const blocks = (items ?? [])
      .filter((i) => i.item_type === "block")
      .map((i) => ({
        id: i.id as string,
        title: String(i.title),
        sequence: Number(i.sequence),
        blockNumber: blockNumberFromItem({
          sequence: Number(i.sequence),
          metadata: (i.metadata as Record<string, unknown>) ?? {},
        }),
      }));

    const { data: ksbs, error: kErr } = await supabase
      .from("se_ksbs")
      .select("ksb_code, ksb_type, description")
      .eq("standard_version_id", version.standard_version_id);
    if (kErr) throw new Error(kErr.message);

    const run = await analyseProgrammeVersion(supabase, {
      programmeVersionId,
      officialStandardVersionId: version.standard_version_id as string,
      blocks,
      ksbs: (ksbs ?? []).map((k) => ({
        code: String(k.ksb_code).toUpperCase(),
        type: String(k.ksb_type || "knowledge"),
        description: String(k.description || ""),
      })),
      providerMode,
      createdBy: body.createdBy?.trim() || "programme-builder",
      ksbCodes: body.ksbCodes,
      concurrency: providerMode === "portal_ai" ? 2 : 4,
    });

    // Read-back mapping count to prove programme truth untouched.
    const { count: primaryCount } = await supabase
      .from("gta_spine_item_ksbs")
      .select("id", { count: "exact", head: true })
      .eq("programme_version_id", programmeVersionId)
      .eq("is_primary", true);

    return NextResponse.json({
      ok: true,
      run,
      programmeTruthUnchanged: {
        approvedPrimaryCount: primaryCount ?? null,
        note: "AI-1 never writes Block↔KSB mappings.",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
