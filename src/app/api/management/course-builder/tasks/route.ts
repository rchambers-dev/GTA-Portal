import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import {
  deleteCourseTask,
  listCourseTasksForVersion,
  upsertCourseTasks,
} from "@/features/programme-delivery/domain/gta-course-tasks-repository";
import type { GtaCourseTaskUpsertInput } from "@/features/programme-delivery/domain/gta-course-tasks";

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
            "programmeVersionId is required. Course Builder content is never resolved from the newest programme.",
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const tasks = await listCourseTasksForVersion(
      supabase,
      programmeVersionId,
    );
    return NextResponse.json({ ok: true, programmeVersionId, tasks });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Could not load tasks.",
      },
      { status: 500 },
    );
  }
}

type PutBody = {
  programmeVersionId?: string;
  tasks?: GtaCourseTaskUpsertInput[];
};

/** Upsert provided tasks only — never delete-missing on PUT. */
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
    if (!Array.isArray(body.tasks)) {
      return NextResponse.json(
        { ok: false, error: "tasks array is required." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const tasks = await upsertCourseTasks(
      supabase,
      programmeVersionId,
      body.tasks,
    );
    return NextResponse.json({ ok: true, programmeVersionId, tasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save tasks.";
    const status =
      /only attach to spine blocks|does not belong|was not found|required/i.test(
        message,
      )
        ? 422
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

/** Explicit delete — partial PUT payloads never remove DB rows. */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const programmeVersionId =
      url.searchParams.get("programmeVersionId")?.trim() || "";
    const taskKey = url.searchParams.get("taskKey")?.trim() || "";
    if (!programmeVersionId || !taskKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "programmeVersionId and taskKey are required.",
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    await deleteCourseTask(supabase, programmeVersionId, taskKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not delete task.";
    const status = /was not found|required/i.test(message) ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
