import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { listProgrammeSessionsForVersion } from "@/features/programme-definition/domain/programme-sessions-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const programmeVersionId =
      url.searchParams.get("programmeVersionId")?.trim() || "";
    if (!programmeVersionId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "programmeVersionId is required. Sessions are never resolved from the newest programme.",
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const sessions = await listProgrammeSessionsForVersion(
      supabase,
      programmeVersionId,
    );
    return NextResponse.json({
      ok: true,
      programmeVersionId,
      sessions,
      count: sessions.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not load sessions.",
      },
      { status: 500 },
    );
  }
}
