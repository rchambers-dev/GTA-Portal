import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireCurriculumAuthoringAccess } from "@/features/programme-definition/domain/curriculum-authoring-access";
import {
  deleteResourceAttachment,
  listProgrammeResourcesForVersion,
  listResourceAttachmentsForVersion,
  placeUnplacedAttachmentOnSession,
  upsertProgrammeResources,
  upsertResourceAttachments,
  type AttachmentUpsertInput,
  type ResourceUpsertInput,
} from "@/features/programme-definition/domain/programme-resources-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireCurriculumAuthoringAccess();
  if (access instanceof NextResponse) return access;
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
    const spineItemId = url.searchParams.get("spineItemId")?.trim() || "";
    const sessionId = url.searchParams.get("sessionId")?.trim() || "";

    const supabase = createSupabaseAdminClient();
    const [resources, attachments] = await Promise.all([
      listProgrammeResourcesForVersion(supabase, programmeVersionId),
      listResourceAttachmentsForVersion(supabase, programmeVersionId, {
        spineItemId: spineItemId || undefined,
        sessionId: sessionId || undefined,
      }),
    ]);
    return NextResponse.json({
      ok: true,
      programmeVersionId,
      resources,
      attachments,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not load resources.",
      },
      { status: 500 },
    );
  }
}

type PutBody = {
  programmeVersionId?: string;
  resources?: ResourceUpsertInput[];
  attachments?: AttachmentUpsertInput[];
};

export async function PUT(request: Request) {
  const access = await requireCurriculumAuthoringAccess();
  if (access instanceof NextResponse) return access;
  try {
    const body = (await request.json().catch(() => ({}))) as PutBody;
    const programmeVersionId = body.programmeVersionId?.trim() || "";
    if (!programmeVersionId) {
      return NextResponse.json(
        { ok: false, error: "programmeVersionId is required." },
        { status: 400 },
      );
    }
    const supabase = createSupabaseAdminClient();
    const resources = Array.isArray(body.resources)
      ? await upsertProgrammeResources(
          supabase,
          programmeVersionId,
          body.resources,
        )
      : [];
    const attachments = Array.isArray(body.attachments)
      ? await upsertResourceAttachments(
          supabase,
          programmeVersionId,
          body.attachments,
        )
      : [];
    return NextResponse.json({
      ok: true,
      programmeVersionId,
      resources,
      attachments,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save resources.";
    const status = /required|Invalid/i.test(message) ? 422 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

type PostBody = {
  programmeVersionId?: string;
  action?: "place_unplaced";
  attachmentId?: string;
  sessionId?: string;
};

export async function POST(request: Request) {
  const access = await requireCurriculumAuthoringAccess();
  if (access instanceof NextResponse) return access;
  try {
    const body = (await request.json().catch(() => ({}))) as PostBody;
    const programmeVersionId = body.programmeVersionId?.trim() || "";
    if (!programmeVersionId) {
      return NextResponse.json(
        { ok: false, error: "programmeVersionId is required." },
        { status: 400 },
      );
    }
    if (body.action !== "place_unplaced") {
      return NextResponse.json(
        { ok: false, error: "Unsupported action." },
        { status: 400 },
      );
    }
    const supabase = createSupabaseAdminClient();
    const attachment = await placeUnplacedAttachmentOnSession(
      supabase,
      programmeVersionId,
      body.attachmentId || "",
      body.sessionId || "",
    );
    return NextResponse.json({ ok: true, attachment });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not place attachment.";
    const status = /required|not found|already placed|does not belong/i.test(
      message,
    )
      ? 422
      : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  const access = await requireCurriculumAuthoringAccess();
  if (access instanceof NextResponse) return access;
  try {
    const url = new URL(request.url);
    const programmeVersionId =
      url.searchParams.get("programmeVersionId")?.trim() || "";
    const attachmentId = url.searchParams.get("attachmentId")?.trim() || "";
    if (!programmeVersionId || !attachmentId) {
      return NextResponse.json(
        {
          ok: false,
          error: "programmeVersionId and attachmentId are required.",
        },
        { status: 400 },
      );
    }
    const supabase = createSupabaseAdminClient();
    await deleteResourceAttachment(
      supabase,
      programmeVersionId,
      attachmentId,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not delete attachment.";
    const status = /not found|required/i.test(message) ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
