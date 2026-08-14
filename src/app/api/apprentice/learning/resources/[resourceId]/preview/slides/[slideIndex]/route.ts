import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { loadApprenticeLearningJourney } from "@/features/programme-delivery/domain/apprentice-learning-repository";
import { decideApprenticeResourceAccess } from "@/features/programme-delivery/domain/learner-resource-access";
import {
  listProgrammeResourcesForVersion,
  listResourceAttachmentsForVersion,
} from "@/features/programme-definition/domain/programme-resources-repository";
import { getResourceBinary } from "@/features/programme-definition/domain/programme-resource-binaries-repository";
import { getResourcePreview } from "@/features/programme-definition/domain/programme-resource-previews-repository";
import { previewIsCurrent } from "@/features/programme-definition/domain/programme-resource-previews";
import { readResourceBinaryBytes } from "@/features/programme-definition/domain/resource-binary-storage";

export const runtime = "nodejs";

type Props = { params: Promise<{ resourceId: string; slideIndex: string }> };

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
  const { resourceId, slideIndex } = await params;
  const id = resourceId?.trim();
  const index = Number(slideIndex);
  if (!id || !Number.isInteger(index) || index < 1) {
    return NextResponse.json({ ok: false, error: "Invalid slide." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const journey = await loadApprenticeLearningJourney(supabase, apprenticeId);
    const [resources, attachments] = await Promise.all([
      listProgrammeResourcesForVersion(supabase, journey.programmeVersionId),
      listResourceAttachmentsForVersion(supabase, journey.programmeVersionId),
    ]);
    const resource = resources.find((row) => row.id === id) ?? null;
    const access = decideApprenticeResourceAccess({
      resourceId: id,
      resource,
      attachments,
      blocks: journey.blocks,
      isTest: journey.isTest,
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
    const slide = (preview!.manifest.slides || []).find((s) => s.index === index);
    if (!slide?.storagePath) {
      return NextResponse.json(
        { ok: false, error: "Slide image not currently available" },
        { status: 404 },
      );
    }
    const bytes = await readResourceBinaryBytes({
      supabase,
      bucket: preview!.storageBucket,
      storagePath: slide.storagePath,
    });
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": slide.mimeType || "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not open slide.",
      },
      { status: 500 },
    );
  }
}
