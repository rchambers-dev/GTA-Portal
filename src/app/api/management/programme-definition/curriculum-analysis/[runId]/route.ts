import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireCurriculumAuthoringAccess } from "@/features/programme-definition/domain/curriculum-authoring-access";
import { getAnalysisRunWithResults } from "@/features/programme-definition/domain/curriculum-analysis";

export const runtime = "nodejs";

type Params = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const access = await requireCurriculumAuthoringAccess();
  if (access instanceof NextResponse) return access;
  try {
    const { runId } = await params;
    if (!runId) {
      return NextResponse.json(
        { ok: false, error: "runId is required." },
        { status: 400 },
      );
    }
    const supabase = createSupabaseAdminClient();
    const run = await getAnalysisRunWithResults(supabase, runId);
    if (!run) {
      return NextResponse.json(
        { ok: false, error: "Analysis run not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      run,
      note: "Recommendations only — not current programme coverage.",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
