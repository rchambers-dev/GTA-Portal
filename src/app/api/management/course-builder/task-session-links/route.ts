import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import {
  deleteTaskSessionLink,
  listTaskSessionLinksForVersion,
  upsertTaskSessionLinks,
} from "@/features/programme-delivery/domain/task-session-links-repository";
import type { TaskSessionLinkUpsertInput } from "@/features/programme-delivery/domain/task-session-links";

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
          error: "programmeVersionId is required.",
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const links = await listTaskSessionLinksForVersion(
      supabase,
      programmeVersionId,
    );
    return NextResponse.json({ ok: true, programmeVersionId, links });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Could not load links.",
      },
      { status: 500 },
    );
  }
}

type PutBody = {
  programmeVersionId?: string;
  links?: TaskSessionLinkUpsertInput[];
};

/** Upsert provided links only — never delete-missing on PUT. */
export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as PutBody;
    const programmeVersionId = body.programmeVersionId?.trim() || "";
    if (!programmeVersionId) {
      return NextResponse.json(
        { ok: false, error: "programmeVersionId is required." },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.links)) {
      return NextResponse.json(
        { ok: false, error: "links array is required." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const links = await upsertTaskSessionLinks(
      supabase,
      programmeVersionId,
      body.links,
    );
    return NextResponse.json({ ok: true, programmeVersionId, links });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save links.";
    const status =
      /does not belong|was not found|required|Invalid linkType/i.test(message)
        ? 422
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const programmeVersionId =
      url.searchParams.get("programmeVersionId")?.trim() || "";
    const taskId = url.searchParams.get("taskId")?.trim() || "";
    const sessionId = url.searchParams.get("sessionId")?.trim() || "";
    const linkType = url.searchParams.get("linkType")?.trim() || "";
    if (!programmeVersionId || !taskId || !sessionId || !linkType) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "programmeVersionId, taskId, sessionId and linkType are required.",
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    await deleteTaskSessionLink(
      supabase,
      programmeVersionId,
      taskId,
      sessionId,
      linkType,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not delete link.";
    const status = /was not found|required|Invalid/i.test(message)
      ? 404
      : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
