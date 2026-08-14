import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { loadApprenticeLearningJourney } from "@/features/programme-delivery/domain/apprentice-learning-repository";
import { resolveApprenticeSessionAccess } from "@/features/programme-delivery/domain/apprentice-learning";
import { includesTutorLessonPlan } from "@/features/programme-delivery/domain/learner-session-view";
import {
  isSecurityTestFixtureResource,
  LEARNER_SESSION_LOCKED_ERROR,
} from "@/features/programme-definition/domain/learner-facing-content";
import { loadResourceExtractText } from "@/features/programme-definition/domain/resource-extract";

export const runtime = "nodejs";

type Props = { params: Promise<{ resourceId: string }> };

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

  const { resourceId } = await params;
  const id = resourceId?.trim();
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "resourceId is required." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const journey = await loadApprenticeLearningJourney(supabase, apprenticeId);
    const owner = journey.blocks
      .flatMap((b) => b.sessions.map((s) => ({ session: s, block: b })))
      .find(({ session }) => session.materials.some((m) => m.id === id));
    if (!owner) {
      return NextResponse.json(
        { ok: false, error: "Resource not found on your learning journey." },
        { status: 404 },
      );
    }
    const access = resolveApprenticeSessionAccess(
      journey.blocks,
      owner.session.id,
    );
    if (access.status === "locked") {
      return NextResponse.json(
        { ok: false, error: LEARNER_SESSION_LOCKED_ERROR },
        { status: 403 },
      );
    }
    const material = owner.session.materials.find((m) => m.id === id);
    if (!material) {
      return NextResponse.json(
        { ok: false, error: "Resource not found on your learning journey." },
        { status: 404 },
      );
    }
    if (includesTutorLessonPlan([material])) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    if (isSecurityTestFixtureResource(material)) {
      return NextResponse.json(
        { ok: false, error: "Resource not found on your learning journey." },
        { status: 404 },
      );
    }

    const { data, error } = await supabase
      .from("gta_programme_resources")
      .select("id, title, filename, extract_path, evidence_resource_id")
      .eq("id", id)
      .eq("programme_version_id", journey.programmeVersionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Resource not found." },
        { status: 404 },
      );
    }

    const loaded = loadResourceExtractText({
      extractPath: data.extract_path || "",
      evidenceResourceId: data.evidence_resource_id || "",
    });

    return NextResponse.json({
      ok: true,
      resource: {
        id: data.id,
        title: data.title,
        filename: data.filename,
      },
      binaryAvailableInApp: false,
      note:
        loaded.mode === "extract_file"
          ? "Showing the available text extract for this resource. The original file is not opened in the portal."
          : "This resource is listed for your Session, but a viewable copy is not available in the portal yet.",
      extractText: loaded.text,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not open resource.",
      },
      { status: 500 },
    );
  }
}
