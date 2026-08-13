import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { loadApprenticeLearningJourney } from "@/features/programme-delivery/domain/apprentice-learning-repository";
import { includesTutorLessonPlan } from "@/features/programme-delivery/domain/learner-session-view";

export const runtime = "nodejs";

type Props = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, { params }: Props) {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (session.account.workspace !== "apprentice") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const apprenticeId = session.account.linkedApprenticeId?.trim();
  if (!apprenticeId) {
    return NextResponse.json(
      { ok: false, error: "This login is not linked to an apprentice record." },
      { status: 404 },
    );
  }

  const { sessionId } = await params;
  const id = sessionId?.trim();
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "sessionId is required." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const journey = await loadApprenticeLearningJourney(supabase, apprenticeId);
    const view = journey.blocks
      .flatMap((b) => b.sessions)
      .find((s) => s.id === id);
    if (!view) {
      return NextResponse.json(
        { ok: false, error: "Session not found on your programme." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      session: view,
      programmeTitle: journey.programmeTitle,
      visibilityProof: {
        includesTutorLessonPlan: includesTutorLessonPlan(view.materials),
        resourceTitles: view.materials.map((m) => m.title),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not load Session.",
      },
      { status: 500 },
    );
  }
}
