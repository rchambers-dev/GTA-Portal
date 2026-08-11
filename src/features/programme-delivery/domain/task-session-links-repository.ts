/**
 * Persist / load TASK↔SESSION links for a pinned programme version.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isTaskSessionLinkType,
  type TaskSessionLinkRecord,
  type TaskSessionLinkType,
  type TaskSessionLinkUpsertInput,
} from "./task-session-links";

type LinkRow = {
  id: string;
  programme_version_id: string;
  task_id: string;
  session_id: string;
  link_type: string;
  created_at: string;
  updated_at: string;
};

function rowToRecord(row: LinkRow): TaskSessionLinkRecord {
  if (!isTaskSessionLinkType(row.link_type)) {
    throw new Error(`Unknown link_type: ${row.link_type}`);
  }
  return {
    id: row.id,
    programmeVersionId: row.programme_version_id,
    taskId: row.task_id,
    sessionId: row.session_id,
    linkType: row.link_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertTaskAndSessionOnVersion(
  supabase: SupabaseClient,
  programmeVersionId: string,
  taskId: string,
  sessionId: string,
): Promise<void> {
  const { data: task, error: taskErr } = await supabase
    .from("gta_course_tasks")
    .select("id, programme_version_id")
    .eq("id", taskId)
    .maybeSingle();
  if (taskErr) throw new Error(taskErr.message);
  if (!task) throw new Error(`Task ${taskId} was not found.`);
  if (task.programme_version_id !== programmeVersionId) {
    throw new Error("Task does not belong to this programme version.");
  }

  const { data: session, error: sessionErr } = await supabase
    .from("gta_programme_sessions")
    .select("id, programme_version_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr) throw new Error(sessionErr.message);
  if (!session) throw new Error(`Session ${sessionId} was not found.`);
  if (session.programme_version_id !== programmeVersionId) {
    throw new Error("Session does not belong to this programme version.");
  }
}

export async function listTaskSessionLinksForVersion(
  supabase: SupabaseClient,
  programmeVersionId: string,
): Promise<TaskSessionLinkRecord[]> {
  const id = programmeVersionId.trim();
  if (!id) throw new Error("programmeVersionId is required.");

  const { data, error } = await supabase
    .from("gta_course_task_session_links")
    .select(
      "id, programme_version_id, task_id, session_id, link_type, created_at, updated_at",
    )
    .eq("programme_version_id", id)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as LinkRow[]).map(rowToRecord);
}

/** Upsert provided links only — never delete-missing on PUT. */
export async function upsertTaskSessionLinks(
  supabase: SupabaseClient,
  programmeVersionId: string,
  links: TaskSessionLinkUpsertInput[],
): Promise<TaskSessionLinkRecord[]> {
  const versionId = programmeVersionId.trim();
  if (!versionId) throw new Error("programmeVersionId is required.");
  if (!Array.isArray(links)) throw new Error("links array is required.");

  const saved: TaskSessionLinkRecord[] = [];
  for (const link of links) {
    const taskId = link.taskId?.trim() || "";
    const sessionId = link.sessionId?.trim() || "";
    const linkType = link.linkType;
    if (!taskId || !sessionId) {
      throw new Error("taskId and sessionId are required.");
    }
    if (!isTaskSessionLinkType(linkType)) {
      throw new Error(`Invalid linkType: ${String(linkType)}`);
    }
    await assertTaskAndSessionOnVersion(
      supabase,
      versionId,
      taskId,
      sessionId,
    );

    const { data, error } = await supabase
      .from("gta_course_task_session_links")
      .upsert(
        {
          programme_version_id: versionId,
          task_id: taskId,
          session_id: sessionId,
          link_type: linkType as TaskSessionLinkType,
        },
        { onConflict: "task_id,session_id,link_type" },
      )
      .select(
        "id, programme_version_id, task_id, session_id, link_type, created_at, updated_at",
      )
      .single();

    if (error) throw new Error(error.message);
    saved.push(rowToRecord(data as LinkRow));
  }
  return saved;
}

export async function deleteTaskSessionLink(
  supabase: SupabaseClient,
  programmeVersionId: string,
  taskId: string,
  sessionId: string,
  linkType: string,
): Promise<void> {
  const versionId = programmeVersionId.trim();
  if (!versionId || !taskId.trim() || !sessionId.trim() || !linkType.trim()) {
    throw new Error(
      "programmeVersionId, taskId, sessionId and linkType are required.",
    );
  }
  if (!isTaskSessionLinkType(linkType)) {
    throw new Error(`Invalid linkType: ${linkType}`);
  }

  const { error, count } = await supabase
    .from("gta_course_task_session_links")
    .delete({ count: "exact" })
    .eq("programme_version_id", versionId)
    .eq("task_id", taskId.trim())
    .eq("session_id", sessionId.trim())
    .eq("link_type", linkType);

  if (error) throw new Error(error.message);
  if (!count) {
    throw new Error("Link was not found.");
  }
}
