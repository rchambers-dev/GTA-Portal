import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { loadApprenticeLearningJourney } from "@/features/programme-delivery/domain/apprentice-learning-repository";
import { decideApprenticeResourceAccess } from "@/features/programme-delivery/domain/learner-resource-access";
import { listSessionReviewReleases } from "@/features/programme-delivery/domain/session-review-release-repository";
import {
  listProgrammeResourcesForVersion,
  listResourceAttachmentsForVersion,
} from "@/features/programme-definition/domain/programme-resources-repository";
import { getResourceBinary } from "@/features/programme-definition/domain/programme-resource-binaries-repository";
import { getResourcePreview } from "@/features/programme-definition/domain/programme-resource-previews-repository";
import { previewIsCurrent } from "@/features/programme-definition/domain/programme-resource-previews";

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
    return NextResponse.json({ ok: false, error: "resourceId is required." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const journey = await loadApprenticeLearningJourney(supabase, apprenticeId);
    const [resources, attachments, reviewReleases] = await Promise.all([
      listProgrammeResourcesForVersion(supabase, journey.programmeVersionId),
      listResourceAttachmentsForVersion(supabase, journey.programmeVersionId),
      listSessionReviewReleases(supabase, {
        programmeVersionId: journey.programmeVersionId,
        apprenticeId,
        apprenticeProgrammeId: journey.enrolmentId,
      }),
    ]);
    const resource = resources.find((row) => row.id === id) ?? null;
    const access = decideApprenticeResourceAccess({
      resourceId: id,
      resource,
      attachments,
      blocks: journey.blocks,
      isTest: journey.isTest,
      reviewReleasedSessionIds: new Set(
        reviewReleases.map((row) => row.sessionId),
      ),
    });
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status },
      );
    }
    const binary = await getResourceBinary(
      supabase,
      journey.programmeVersionId,
      id,
    );
    const preview = await getResourcePreview(
      supabase,
      journey.programmeVersionId,
      id,
    );
    if (
      !previewIsCurrent({
        preview,
        binarySha256: binary?.sha256 || null,
      })
    ) {
      return NextResponse.json(
        { ok: false, error: "Preview unavailable" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      resource: {
        id: resource?.id,
        title: resource?.title,
        filename: resource?.filename,
      },
      preview: {
        type: preview!.previewType,
        slideCount: preview!.slideCount,
        slides: (preview!.manifest.slides || []).map((s) => ({
          index: s.index,
          hasImage: Boolean(s.storagePath),
          text: s.text || [],
        })),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not open preview.",
      },
      { status: 500 },
    );
  }
}
