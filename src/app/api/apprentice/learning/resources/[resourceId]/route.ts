import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { loadApprenticeLearningJourney } from "@/features/programme-delivery/domain/apprentice-learning-repository";
import { decideApprenticeResourceAccess } from "@/features/programme-delivery/domain/learner-resource-access";
import { listSessionReviewReleases } from "@/features/programme-delivery/domain/session-review-release-repository";
import {
  catalogueFileOpenCapabilities,
  isPowerpointFilename,
} from "@/features/programme-definition/domain/programme-resources";
import {
  listProgrammeResourcesForVersion,
  listResourceAttachmentsForVersion,
} from "@/features/programme-definition/domain/programme-resources-repository";
import { loadResourceExtractText } from "@/features/programme-definition/domain/resource-extract";
import { getResourceBinary } from "@/features/programme-definition/domain/programme-resource-binaries-repository";
import {
  catalogueFileOpenCapabilities,
  isPowerpointFilename,
} from "@/features/programme-definition/domain/programme-resources";

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
    if (!resource) {
      return NextResponse.json(
        { ok: false, error: "Resource not found." },
        { status: 404 },
      );
    }

    const loaded = loadResourceExtractText({
      extractPath: resource.extractPath || "",
      evidenceResourceId: resource.evidenceResourceId || "",
    });
    const binary = await getResourceBinary(
      supabase,
      journey.programmeVersionId,
      id,
    );
    const binaryAvailable = Boolean(binary);
    const capabilities = catalogueFileOpenCapabilities(resource.filename);
    const isPpt = isPowerpointFilename(resource.filename);
    const note = binaryAvailable
      ? isPpt
        ? "The original PowerPoint is available to download. Browsers cannot preview PowerPoint files; open the downloaded file in PowerPoint or equivalent."
        : "The original file is available to download."
      : loaded.mode === "extract_file"
        ? isPpt
          ? "Original file not currently available. This is the available text extract of the presentation."
          : "Original file not currently available. This is the available text extract."
        : isPpt
          ? "Original file not currently available, and no text extract is available yet."
          : "This resource is listed for your Session, but a viewable copy is not available in the portal yet.";

    return NextResponse.json({
      ok: true,
      resource: {
        id: resource.id,
        title: resource.title,
        filename: resource.filename,
      },
      binaryAvailableInApp: binaryAvailable,
      powerpointOpenableInBrowser: false,
      downloadOriginal: binaryAvailable,
      capabilities,
      viewMode: loaded.mode,
      note,
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
