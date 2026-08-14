import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { loadApprenticeLearningJourney } from "@/features/programme-delivery/domain/apprentice-learning-repository";
import { resolveApprenticeSessionAccess } from "@/features/programme-delivery/domain/apprentice-learning";
import { LEARNER_SESSION_LOCKED_ERROR } from "@/features/programme-definition/domain/learner-facing-content";
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
    const access = resolveApprenticeSessionAccess(journey.blocks, id);
    if (access.status === "missing") {
      return NextResponse.json(
        { ok: false, error: "Session not found on your programme." },
        { status: 404 },
      );
    }
    if (access.status === "locked") {
      return NextResponse.json(
        { ok: false, error: LEARNER_SESSION_LOCKED_ERROR },
        { status: 403 },
      );
    }
    return NextResponse.json({
      ok: true,
      session: access.session,
      programmeTitle: journey.programmeTitle,
      visibilityProof: {
        includesTutorLessonPlan: includesTutorLessonPlan(
          access.session.materials,
        ),
        resourceTitles: access.session.materials.map((m) => m.title),
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
