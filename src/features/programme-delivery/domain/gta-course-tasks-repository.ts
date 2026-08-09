/**
 * Persist / load GTA Course Builder tasks (gta_course_tasks).
 * No newest-version fallback — programmeVersionId is always required.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultAuthoredTaskForm } from "./form-modules";
import type { FormModule } from "./form-modules";
import {
  assertValidUpsertInput,
  newForkedTaskKey,
  type GtaCourseTaskRecord,
  type GtaCourseTaskUpsertInput,
} from "./gta-course-tasks";
import type { PracticalTaskKind } from "./task-schema";

type TaskRow = {
  id: string;
  programme_version_id: string;
  spine_item_id: string;
  task_key: string;
  sequence: number;
  task_number: number;
  kind: string;
  title: string;
  scenario: string;
  objectives: unknown;
  instructions: unknown;
  knowledge_questions: unknown;
  estimated_minutes: number;
  block_ordinal: number;
  form_title: string;
  form_scenario: string;
  form_status: string;
  form_modules: unknown;
  publish_status: string;
  copied_from_task_id: string | null;
  created_at: string;
  updated_at: string;
};

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v));
}

function asModules(raw: unknown): FormModule[] {
  if (!Array.isArray(raw)) return [];
  return raw as FormModule[];
}

function rowToRecord(row: TaskRow): GtaCourseTaskRecord {
  const formStatus = row.form_status === "ready" ? "ready" : "pending";
  const publishStatus =
    row.publish_status === "published" ? "published" : "draft";
  return {
    id: row.id,
    programmeVersionId: row.programme_version_id,
    spineItemId: row.spine_item_id,
    taskKey: row.task_key,
    sequence: row.sequence,
    taskNumber: row.task_number,
    kind: row.kind as PracticalTaskKind,
    title: row.title,
    scenario: row.scenario,
    objectives: asStringArray(row.objectives),
    instructions: asStringArray(row.instructions),
    knowledgeQuestions: asStringArray(row.knowledge_questions),
    estimatedMinutes: Number(row.estimated_minutes) || 60,
    blockOrdinal: Number(row.block_ordinal) || 1,
    form: {
      title: row.form_title || row.title,
      scenario: row.form_scenario || "",
      status: formStatus,
      modules: asModules(row.form_modules),
    },
    publishStatus,
    copiedFromTaskId: row.copied_from_task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertBlockOnVersion(
  supabase: SupabaseClient,
  programmeVersionId: string,
  spineItemId: string,
): Promise<void> {
  const { data: item, error } = await supabase
    .from("gta_spine_items")
    .select("id, item_type, spine_id")
    .eq("id", spineItemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) {
    throw new Error(`Spine item ${spineItemId} was not found.`);
  }
  if (item.item_type !== "block") {
    throw new Error(
      `Course Builder tasks may only attach to spine blocks (got ${item.item_type}).`,
    );
  }
  const { data: spine, error: sErr } = await supabase
    .from("gta_spines")
    .select("programme_version_id")
    .eq("id", item.spine_id)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!spine || spine.programme_version_id !== programmeVersionId) {
    throw new Error(
      `Spine item ${spineItemId} does not belong to programme version ${programmeVersionId}.`,
    );
  }
}

export async function listCourseTasksForVersion(
  supabase: SupabaseClient,
  programmeVersionId: string,
): Promise<GtaCourseTaskRecord[]> {
  const versionId = programmeVersionId.trim();
  if (!versionId) {
    throw new Error("programmeVersionId is required.");
  }

  const { data, error } = await supabase
    .from("gta_course_tasks")
    .select("*")
    .eq("programme_version_id", versionId)
    .order("spine_item_id", { ascending: true })
    .order("sequence", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as TaskRow[]).map(rowToRecord);
}

export async function upsertCourseTasks(
  supabase: SupabaseClient,
  programmeVersionId: string,
  tasks: GtaCourseTaskUpsertInput[],
): Promise<GtaCourseTaskRecord[]> {
  const versionId = programmeVersionId.trim();
  if (!versionId) {
    throw new Error("programmeVersionId is required.");
  }

  const { data: version, error: vErr } = await supabase
    .from("gta_programme_versions")
    .select("id")
    .eq("id", versionId)
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!version) {
    throw new Error(`Programme version ${versionId} was not found.`);
  }

  for (const task of tasks) {
    assertValidUpsertInput(task);
    await assertBlockOnVersion(supabase, versionId, task.spineItemId);
  }

  if (tasks.length === 0) {
    return listCourseTasksForVersion(supabase, versionId);
  }

  const rows = tasks.map((task) => {
    const form = task.form ?? defaultAuthoredTaskForm(task.title);
    return {
      programme_version_id: versionId,
      spine_item_id: task.spineItemId,
      task_key: task.taskKey.trim(),
      sequence: task.sequence ?? task.taskNumber,
      task_number: task.taskNumber,
      kind: task.kind,
      title: task.title,
      scenario: task.scenario,
      objectives: task.objectives,
      instructions: task.instructions,
      knowledge_questions: task.knowledgeQuestions,
      estimated_minutes: task.estimatedMinutes,
      block_ordinal: task.blockOrdinal,
      form_title: form.title ?? task.title,
      form_scenario: form.scenario ?? "",
      form_status: form.status === "ready" ? "ready" : "pending",
      form_modules: form.modules ?? [],
      publish_status: task.publishStatus === "published" ? "published" : "draft",
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase.from("gta_course_tasks").upsert(rows, {
    onConflict: "programme_version_id,task_key",
  });
  if (error) throw new Error(error.message);

  return listCourseTasksForVersion(supabase, versionId);
}

export async function deleteCourseTask(
  supabase: SupabaseClient,
  programmeVersionId: string,
  taskKey: string,
): Promise<void> {
  const versionId = programmeVersionId.trim();
  const key = taskKey.trim();
  if (!versionId) throw new Error("programmeVersionId is required.");
  if (!key) throw new Error("taskKey is required.");

  const { data, error } = await supabase
    .from("gta_course_tasks")
    .delete()
    .eq("programme_version_id", versionId)
    .eq("task_key", key)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) {
    throw new Error(
      `Task ${key} was not found on programme version ${versionId}.`,
    );
  }
}

export type CopyCourseTasksForForkArgs = {
  sourceProgrammeVersionId: string;
  targetProgrammeVersionId: string;
  /** old spine_item_id → new spine_item_id */
  spineItemIdMap: Record<string, string>;
};

/**
 * Copy Course Builder tasks onto a forked programme version.
 * New row ids + new version-scoped task_keys. Source rows unchanged.
 * Does NOT wire into createNextProgrammeVersion (later slice).
 */
export async function copyCourseTasksForFork(
  supabase: SupabaseClient,
  args: CopyCourseTasksForForkArgs,
): Promise<GtaCourseTaskRecord[]> {
  const sourceId = args.sourceProgrammeVersionId.trim();
  const targetId = args.targetProgrammeVersionId.trim();
  if (!sourceId || !targetId) {
    throw new Error(
      "sourceProgrammeVersionId and targetProgrammeVersionId are required.",
    );
  }
  if (sourceId === targetId) {
    throw new Error("Fork source and target programme versions must differ.");
  }

  const sourceTasks = await listCourseTasksForVersion(supabase, sourceId);
  if (sourceTasks.length === 0) return [];

  const inserts: Array<Record<string, unknown>> = [];
  for (const task of sourceTasks) {
    const newSpineId = args.spineItemIdMap[task.spineItemId];
    if (!newSpineId) {
      throw new Error(
        `Missing spine item mapping for block ${task.spineItemId} (task_key=${task.taskKey}).`,
      );
    }
    await assertBlockOnVersion(supabase, targetId, newSpineId);

    inserts.push({
      id: crypto.randomUUID(),
      programme_version_id: targetId,
      spine_item_id: newSpineId,
      task_key: newForkedTaskKey(task.taskKey),
      sequence: task.sequence,
      task_number: task.taskNumber,
      kind: task.kind,
      title: task.title,
      scenario: task.scenario,
      objectives: task.objectives,
      instructions: task.instructions,
      knowledge_questions: task.knowledgeQuestions,
      estimated_minutes: task.estimatedMinutes,
      block_ordinal: task.blockOrdinal,
      form_title: task.form.title,
      form_scenario: task.form.scenario,
      form_status: task.form.status === "ready" ? "ready" : "pending",
      form_modules: task.form.modules,
      publish_status: "draft",
      copied_from_task_id: task.id,
    });
  }

  const { error } = await supabase.from("gta_course_tasks").insert(inserts);
  if (error) throw new Error(error.message);

  return listCourseTasksForVersion(supabase, targetId);
}
