/**
 * Version-scoped published delivery catalogue.
 *
 * enrolment.gtaProgrammeVersionId → GTA programme version → spine blocks
 * → published gta_course_tasks → tutor/apprentice delivery.
 *
 * No Autocare fallback. No newest-version resolution.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { draftToPracticalTask } from "./course-builder-tasks";
import { recordToTaskDraft } from "./gta-course-tasks";
import { listCourseTasksForVersion } from "./gta-course-tasks-repository";
import type { PracticalTaskDef } from "./task-schema";

export type DeliveryBlockView = {
  /** Canonical spine item UUID. */
  spineItemId: string;
  title: string;
  sequence: number;
  /** Display / migration helper only — not identity. */
  displayOrdinal: number;
  plannedOtjHours: number;
  weekStart: number | null;
  weekEnd: number | null;
};

export type DeliveryTaskView = PracticalTaskDef & {
  spineItemId: string;
  programmeVersionId: string;
};

export type PublishedDeliveryStatus =
  | "ready"
  | "unpinned"
  | "version_missing"
  | "empty_published";

export type PublishedDeliveryCatalogue = {
  status: PublishedDeliveryStatus;
  message: string;
  programmeVersionId: string | null;
  programmeTitle: string | null;
  standardCode: string | null;
  externalVersion: string | null;
  internalVersion: string | null;
  blocks: DeliveryBlockView[];
  tasks: DeliveryTaskView[];
};

export function emptyCatalogue(
  status: PublishedDeliveryStatus,
  message: string,
  programmeVersionId: string | null = null,
): PublishedDeliveryCatalogue {
  return {
    status,
    message,
    programmeVersionId,
    programmeTitle: null,
    standardCode: null,
    externalVersion: null,
    internalVersion: null,
    blocks: [],
    tasks: [],
  };
}

function metaNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const v = metadata?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

/**
 * Pure assembly: filter published tasks for an explicit programme version.
 * Callers must pass the version id from the enrolment pin — never invent one.
 */
export function buildPublishedDeliveryCatalogue(args: {
  programmeVersionId: string | null | undefined;
  programmeTitle?: string | null;
  standardCode?: string | null;
  externalVersion?: string | null;
  internalVersion?: string | null;
  spineItems: Array<{
    id: string;
    itemType: string;
    title: string;
    sequence: number;
    plannedOtjHours: number;
    metadata?: Record<string, unknown> | null;
  }>;
  /** Full task rows for this version (draft + published). */
  tasks: Array<{
    taskKey: string;
    spineItemId: string;
    programmeVersionId: string;
    publishStatus: "draft" | "published";
    taskNumber: number;
    kind: PracticalTaskDef["kind"];
    title: string;
    scenario: string;
    objectives: string[];
    instructions: string[];
    knowledgeQuestions: string[];
    estimatedMinutes: number;
    blockOrdinal: number;
  }>;
  versionExists?: boolean;
}): PublishedDeliveryCatalogue {
  const versionId = args.programmeVersionId?.trim() || "";
  if (!versionId) {
    return emptyCatalogue(
      "unpinned",
      "No GTA programme version is assigned to this enrolment. Bind a programme version before college tasks can appear.",
    );
  }

  if (args.versionExists === false) {
    return emptyCatalogue(
      "version_missing",
      "The pinned GTA programme version was not found.",
      versionId,
    );
  }

  const blocks = args.spineItems
    .filter((i) => i.itemType === "block")
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((item): DeliveryBlockView => {
      const displayOrdinal =
        metaNumber(item.metadata ?? undefined, "blockNumber") ??
        Math.max(1, item.sequence);
      return {
        spineItemId: item.id,
        title: item.title || `Block ${displayOrdinal}`,
        sequence: item.sequence,
        displayOrdinal,
        plannedOtjHours: item.plannedOtjHours,
        weekStart: metaNumber(item.metadata ?? undefined, "weekStart"),
        weekEnd: metaNumber(item.metadata ?? undefined, "weekEnd"),
      };
    });

  const blockIds = new Set(blocks.map((b) => b.spineItemId));
  const published = args.tasks
    .filter(
      (t) =>
        t.publishStatus === "published" &&
        t.programmeVersionId === versionId &&
        blockIds.has(t.spineItemId),
    )
    .slice()
    .sort((a, b) => {
      const ba = blocks.findIndex((x) => x.spineItemId === a.spineItemId);
      const bb = blocks.findIndex((x) => x.spineItemId === b.spineItemId);
      if (ba !== bb) return ba - bb;
      return a.taskNumber - b.taskNumber;
    });

  if (published.length === 0) {
    return {
      ...emptyCatalogue(
        "empty_published",
        "This programme version has no published Course Builder tasks yet. Publish tasks in Course Builder to make them available for delivery.",
        versionId,
      ),
      programmeTitle: args.programmeTitle ?? null,
      standardCode: args.standardCode ?? null,
      externalVersion: args.externalVersion ?? null,
      internalVersion: args.internalVersion ?? null,
      blocks,
    };
  }

  const tasks: DeliveryTaskView[] = published.map((t) => {
    const draft = recordToTaskDraft({
      id: "",
      programmeVersionId: t.programmeVersionId,
      spineItemId: t.spineItemId,
      taskKey: t.taskKey,
      sequence: t.taskNumber,
      taskNumber: t.taskNumber,
      kind: t.kind,
      title: t.title,
      scenario: t.scenario,
      objectives: t.objectives,
      instructions: t.instructions,
      knowledgeQuestions: t.knowledgeQuestions,
      estimatedMinutes: t.estimatedMinutes,
      blockOrdinal: t.blockOrdinal,
      form: {
        title: t.title,
        scenario: t.scenario,
        status: "ready",
        modules: [],
      },
      publishStatus: "published",
      copiedFromTaskId: null,
      createdAt: "",
      updatedAt: "",
    });
    const practical = draftToPracticalTask(draft);
    return {
      ...practical,
      // Prefer authored form sections when present: not loaded here — PracticalTaskDef
      // sections come from draftToPracticalTask until form-driven fill lands.
      spineItemId: t.spineItemId,
      programmeVersionId: t.programmeVersionId,
      reviewStatus: "approved",
    };
  });

  return {
    status: "ready",
    message: "",
    programmeVersionId: versionId,
    programmeTitle: args.programmeTitle ?? null,
    standardCode: args.standardCode ?? null,
    externalVersion: args.externalVersion ?? null,
    internalVersion: args.internalVersion ?? null,
    blocks,
    tasks,
  };
}

export function tasksForDeliveryBlock(
  catalogue: PublishedDeliveryCatalogue,
  spineItemId: string,
): DeliveryTaskView[] {
  return catalogue.tasks
    .filter((t) => t.spineItemId === spineItemId)
    .sort((a, b) => a.taskNumber - b.taskNumber);
}

export function taskByDeliveryId(
  catalogue: PublishedDeliveryCatalogue,
  taskId: string,
): DeliveryTaskView | undefined {
  return catalogue.tasks.find((t) => t.id === taskId);
}

/** Load published delivery catalogue from Supabase for an explicit pin. */
export async function loadPublishedDeliveryCatalogue(
  supabase: SupabaseClient,
  programmeVersionId: string | null | undefined,
): Promise<PublishedDeliveryCatalogue> {
  const versionId = programmeVersionId?.trim() || "";
  if (!versionId) {
    return emptyCatalogue(
      "unpinned",
      "No GTA programme version is assigned to this enrolment. Bind a programme version before college tasks can appear.",
    );
  }

  const { data: version, error: vErr } = await supabase
    .from("gta_programme_versions")
    .select("id, programme_id, standard_version_id, internal_version, status")
    .eq("id", versionId)
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!version) {
    return emptyCatalogue(
      "version_missing",
      "The pinned GTA programme version was not found.",
      versionId,
    );
  }

  const { data: prog } = await supabase
    .from("gta_programmes")
    .select("id, title")
    .eq("id", version.programme_id)
    .maybeSingle();

  const { data: stdVer } = await supabase
    .from("se_standard_versions")
    .select("external_version, standard_id")
    .eq("id", version.standard_version_id)
    .maybeSingle();

  const { data: std } = stdVer
    ? await supabase
        .from("se_standards")
        .select("standard_code")
        .eq("id", stdVer.standard_id)
        .maybeSingle()
    : { data: null };

  const { data: spine } = await supabase
    .from("gta_spines")
    .select("id")
    .eq("programme_version_id", versionId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let spineItems: Array<{
    id: string;
    itemType: string;
    title: string;
    sequence: number;
    plannedOtjHours: number;
    metadata: Record<string, unknown> | null;
  }> = [];

  if (spine?.id) {
    const { data: items, error: iErr } = await supabase
      .from("gta_spine_items")
      .select(
        "id, item_type, title, sequence, planned_otj_hours, metadata",
      )
      .eq("spine_id", spine.id)
      .order("sequence", { ascending: true });
    if (iErr) throw new Error(iErr.message);
    spineItems = (items ?? []).map((row) => ({
      id: row.id as string,
      itemType: String(row.item_type),
      title: String(row.title ?? ""),
      sequence: Number(row.sequence) || 0,
      plannedOtjHours: Number(row.planned_otj_hours) || 0,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    }));
  }

  const allTasks = await listCourseTasksForVersion(supabase, versionId);

  return buildPublishedDeliveryCatalogue({
    programmeVersionId: versionId,
    programmeTitle: prog?.title ?? null,
    standardCode: (std?.standard_code as string | undefined)?.toUpperCase() ?? null,
    externalVersion: (stdVer?.external_version as string | undefined) ?? null,
    internalVersion: version.internal_version ?? null,
    spineItems,
    tasks: allTasks.map((t) => ({
      taskKey: t.taskKey,
      spineItemId: t.spineItemId,
      programmeVersionId: t.programmeVersionId,
      publishStatus: t.publishStatus,
      taskNumber: t.taskNumber,
      kind: t.kind,
      title: t.title,
      scenario: t.scenario,
      objectives: t.objectives,
      instructions: t.instructions,
      knowledgeQuestions: t.knowledgeQuestions,
      estimatedMinutes: t.estimatedMinutes,
      blockOrdinal: t.blockOrdinal,
    })),
    versionExists: true,
  });
}
