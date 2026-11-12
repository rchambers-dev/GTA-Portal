import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireCurriculumAuthoringAccess } from "@/features/programme-definition/domain/curriculum-authoring-access";
import {
  listProgrammeSessionsForVersion,
  updateProgrammeSessionAuthoring,
} from "@/features/programme-definition/domain/programme-sessions-repository";
import type { LearningObjectivesReview } from "@/features/programme-definition/domain/programme-resources";
import type { LearnerFacingContent } from "@/features/programme-definition/domain/learner-facing-content";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireCurriculumAuthoringAccess(request);
  if (access instanceof NextResponse) return access;
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

type PatchBody = {
  programmeVersionId?: string;
  sessionId?: string;
  publishStatus?: "draft" | "published";
  learningObjectivesReview?: LearningObjectivesReview;
  learnerFacingContent?: LearnerFacingContent;
};

export async function PATCH(request: Request) {
  const access = await requireCurriculumAuthoringAccess(request);
  if (access instanceof NextResponse) return access;
  try {
    const body = (await request.json().catch(() => ({}))) as PatchBody;
    const programmeVersionId = body.programmeVersionId?.trim() || "";
    const sessionId = body.sessionId?.trim() || "";
    if (!programmeVersionId || !sessionId) {
      return NextResponse.json(
        {
          ok: false,
          error: "programmeVersionId and sessionId are required.",
        },
        { status: 400 },
      );
    }
    const supabase = createSupabaseAdminClient();
    const session = await updateProgrammeSessionAuthoring(
      supabase,
      programmeVersionId,
      sessionId,
      {
        publishStatus: body.publishStatus,
        learningObjectivesReview: body.learningObjectivesReview,
        learnerFacingContent: body.learnerFacingContent,
      },
    );
    return NextResponse.json({ ok: true, session });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not update session.";
    const status = /required|No session/i.test(message) ? 422 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
