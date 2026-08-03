/**
 * Course Builder overrides — local edits on top of seeded packs.
 * KSBs are never stored here (pending Jon).
 */

import type { CeaPackDef } from "@/features/apprentice-portal/domain/cea/types";
import {
  getGroupsPackById,
  GROUPS_PACK_SEEDS,
} from "@/features/apprentice-portal/domain/cea/packs";
import type { GtaBlockPack } from "@/features/programme-delivery/domain/gta-block-shells";
import {
  getBlockPackById,
  GTA_BLOCK_PACKS,
} from "@/features/programme-delivery/domain/gta-block-shells";
import type { PracticalTaskDef } from "@/features/programme-delivery/domain/task-schema";
import {
  createTaskDraft,
  draftToPracticalTask,
  type CourseBuilderTaskDraft,
  type CourseBuilderTaskInput,
} from "@/features/programme-delivery/domain/course-builder-tasks";
import {
  buildAutocareGroupsSeedFormsForPack,
  getAutocareGroupsSeedForm,
  isAutocareGroupsPackId,
} from "@/features/programme-delivery/domain/autocare-groups-forms";
import type { AuthoredTaskForm } from "@/features/programme-delivery/domain/form-modules";
import { defaultAuthoredTaskForm } from "@/features/programme-delivery/domain/form-modules";

const STORAGE_KEY = "gta.courseBuilder.v4";
const LEGACY_STORAGE_KEYS = [
  "gta.courseBuilder.v3",
  "gta.courseBuilder.v2",
  "gta.courseBuilder.v1",
];

export type GroupsPackOverride = {
  title?: string;
  groups?: Array<{
    id: string;
    title?: string;
    tasks?: Array<{ id: string; title?: string }>;
  }>;
};

export type BlockPackOverride = {
  title?: string;
  blocks?: Array<{ id: number; name?: string }>;
  /** Apprentice-completable tasks authored in Course Builder. */
  tasks?: CourseBuilderTaskDraft[];
};

export type CourseBuilderState = {
  groups: Record<string, GroupsPackOverride>;
  blocks: Record<string, BlockPackOverride>;
  /** Form builders keyed by `${packId}::${taskId}` (groups or blocks). */
  taskForms: Record<string, AuthoredTaskForm>;
};

type Listener = () => void;

const listeners = new Set<Listener>();

/** Stable empty state for SSR / hydration — must not read localStorage. */
const SERVER_SNAPSHOT: CourseBuilderState = Object.freeze({
  groups: {},
  blocks: {},
  taskForms: {},
});

function emptyState(): CourseBuilderState {
  return { groups: {}, blocks: {}, taskForms: {} };
}

function readState(): CourseBuilderState {
  if (typeof window === "undefined") return emptyState();
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    const raw =
      current ??
      LEGACY_STORAGE_KEYS.map((k) => window.localStorage.getItem(k)).find(
        Boolean,
      ) ??
      null;
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<CourseBuilderState>;
    const fromLegacy = !current;
    const next: CourseBuilderState = {
      groups: parsed.groups ?? {},
      blocks: parsed.blocks ?? {},
      // v4 starts task canvases empty; keep group/block headings from older saves.
      taskForms: fromLegacy ? {} : (parsed.taskForms ?? {}),
    };
    if (fromLegacy) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    return next;
  } catch {
    return emptyState();
  }
}

let cache: CourseBuilderState | null = null;

function state(): CourseBuilderState {
  if (!cache) cache = readState();
  return cache;
}

function writeState(next: CourseBuilderState) {
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

export function subscribeCourseBuilder(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCourseBuilderSnapshot(): CourseBuilderState {
  return state();
}

/** Cached empty snapshot for SSR and hydration (avoids localStorage mismatch). */
export function getCourseBuilderServerSnapshot(): CourseBuilderState {
  return SERVER_SNAPSHOT;
}

function applyGroupsOverride(
  pack: CeaPackDef,
  override: GroupsPackOverride | undefined,
): CeaPackDef {
  if (!override) return pack;
  const groupMap = new Map((override.groups ?? []).map((g) => [g.id, g]));
  return {
    ...pack,
    title: override.title ?? pack.title,
    groups: pack.groups.map((group) => {
      const gOver = groupMap.get(group.id);
      if (!gOver) return group;
      const taskMap = new Map((gOver.tasks ?? []).map((t) => [t.id, t]));
      return {
        ...group,
        title: gOver.title ?? group.title,
        tasks: group.tasks.map((task) => {
          const tOver = taskMap.get(task.id);
          if (!tOver?.title) return task;
          return { ...task, title: tOver.title };
        }),
      };
    }),
  };
}

function applyBlocksOverride(
  pack: GtaBlockPack,
  override: BlockPackOverride | undefined,
): GtaBlockPack {
  if (!override) return pack;
  const blockMap = new Map((override.blocks ?? []).map((b) => [b.id, b]));
  return {
    ...pack,
    title: override.title ?? pack.title,
    blocks: pack.blocks.map((block) => {
      const bOver = blockMap.get(block.id);
      if (!bOver?.name) return block;
      return { ...block, name: bOver.name };
    }),
  };
}

export function resolveEditableGroupsPack(
  packId: string,
  snap: CourseBuilderState = state(),
): CeaPackDef | null {
  const seed = getGroupsPackById(packId);
  if (!seed) return null;
  return applyGroupsOverride(seed, snap.groups[packId]);
}

export function resolveEditableBlockPack(
  packId: string,
  snap: CourseBuilderState = state(),
): GtaBlockPack | null {
  const seed = getBlockPackById(packId);
  if (!seed) return null;
  return applyBlocksOverride(seed, snap.blocks[packId]);
}

export function listEditableGroupsPacks(
  snap: CourseBuilderState = state(),
): CeaPackDef[] {
  return GROUPS_PACK_SEEDS.map((p) => resolveEditableGroupsPack(p.id, snap)!);
}

export function listEditableBlockPacks(
  snap: CourseBuilderState = state(),
): GtaBlockPack[] {
  return GTA_BLOCK_PACKS.map((p) => resolveEditableBlockPack(p.id, snap)!);
}

export function updateGroupTitle(packId: string, groupId: string, title: string) {
  const prev = state();
  const existing = prev.groups[packId] ?? {};
  const groups = [...(existing.groups ?? [])];
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx >= 0) groups[idx] = { ...groups[idx], title };
  else groups.push({ id: groupId, title });
  writeState({
    ...prev,
    groups: {
      ...prev.groups,
      [packId]: { ...existing, groups },
    },
  });
}

export function updateGroupTaskTitle(
  packId: string,
  groupId: string,
  taskId: string,
  title: string,
) {
  const prev = state();
  const existing = prev.groups[packId] ?? {};
  const groups = [...(existing.groups ?? [])];
  let gIdx = groups.findIndex((g) => g.id === groupId);
  if (gIdx < 0) {
    groups.push({ id: groupId, tasks: [] });
    gIdx = groups.length - 1;
  }
  const tasks = [...(groups[gIdx].tasks ?? [])];
  const tIdx = tasks.findIndex((t) => t.id === taskId);
  if (tIdx >= 0) tasks[tIdx] = { ...tasks[tIdx], title };
  else tasks.push({ id: taskId, title });
  groups[gIdx] = { ...groups[gIdx], tasks };
  writeState({
    ...prev,
    groups: {
      ...prev.groups,
      [packId]: { ...existing, groups },
    },
  });
}

export function updateBlockHeading(
  packId: string,
  blockId: number,
  name: string,
) {
  const prev = state();
  const existing = prev.blocks[packId] ?? {};
  const blocks = [...(existing.blocks ?? [])];
  const idx = blocks.findIndex((b) => b.id === blockId);
  if (idx >= 0) blocks[idx] = { ...blocks[idx], name };
  else blocks.push({ id: blockId, name });
  writeState({
    ...prev,
    blocks: {
      ...prev.blocks,
      [packId]: { ...existing, blocks },
    },
  });
}

export function listBlockTaskDrafts(
  packId: string,
  snap: CourseBuilderState = state(),
): CourseBuilderTaskDraft[] {
  return snap.blocks[packId]?.tasks ?? [];
}

export function listBlockTaskDraftsForBlock(
  packId: string,
  blockId: number,
  snap: CourseBuilderState = state(),
): CourseBuilderTaskDraft[] {
  return listBlockTaskDrafts(packId, snap)
    .filter((t) => t.blockId === blockId)
    .sort((a, b) => a.taskNumber - b.taskNumber);
}

export function listAllCourseBuilderPracticalTasks(): PracticalTaskDef[] {
  const packs = Object.values(state().blocks);
  return packs.flatMap((pack) =>
    (pack.tasks ?? []).map((draft) => draftToPracticalTask(draft)),
  );
}

export function getCourseBuilderPracticalTask(
  taskId: string,
): PracticalTaskDef | null {
  for (const pack of Object.values(state().blocks)) {
    const draft = (pack.tasks ?? []).find((t) => t.id === taskId);
    if (draft) return draftToPracticalTask(draft);
  }
  return null;
}

export function addBlockTask(
  input: CourseBuilderTaskInput,
): CourseBuilderTaskDraft | null {
  if (!input.title.trim()) return null;
  const prev = state();
  const existing = prev.blocks[input.packId] ?? {};
  const tasks = [...(existing.tasks ?? [])];
  const inBlock = tasks.filter((t) => t.blockId === input.blockId);
  const draft = createTaskDraft(input, inBlock);
  tasks.push(draft);
  writeState({
    ...prev,
    blocks: {
      ...prev.blocks,
      [input.packId]: { ...existing, tasks },
    },
  });
  return draft;
}

export function updateBlockTask(
  packId: string,
  taskId: string,
  patch: Partial<
    Pick<
      CourseBuilderTaskDraft,
      | "title"
      | "scenario"
      | "kind"
      | "objectives"
      | "instructions"
      | "estimatedMinutes"
      | "knowledgeQuestions"
      | "taskNumber"
    >
  >,
): void {
  const prev = state();
  const existing = prev.blocks[packId] ?? {};
  const tasks = [...(existing.tasks ?? [])];
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return;
  tasks[idx] = { ...tasks[idx], ...patch };
  writeState({
    ...prev,
    blocks: {
      ...prev.blocks,
      [packId]: { ...existing, tasks },
    },
  });
}

export function removeBlockTask(packId: string, taskId: string): void {
  const prev = state();
  const existing = prev.blocks[packId] ?? {};
  const tasks = (existing.tasks ?? []).filter((t) => t.id !== taskId);
  const formKey = taskFormKey(packId, taskId);
  const { [formKey]: _removed, ...taskForms } = prev.taskForms;
  writeState({
    ...prev,
    blocks: {
      ...prev.blocks,
      [packId]: { ...existing, tasks },
    },
    taskForms,
  });
}

export function taskFormKey(packId: string, taskId: string): string {
  return `${packId}::${taskId}`;
}

export function getAuthoredTaskForm(
  packId: string,
  taskId: string,
  fallbackTitle = "Task",
  snap: CourseBuilderState = state(),
): AuthoredTaskForm {
  const key = taskFormKey(packId, taskId);
  const stored = snap.taskForms[key];
  if (!stored) {
    return (
      getAutocareGroupsSeedForm(packId, taskId) ??
      defaultAuthoredTaskForm(fallbackTitle)
    );
  }
  return {
    ...stored,
    status: stored.status === "ready" ? "ready" : "pending",
  };
}

/** Create the learner form if missing (includes difficulty feedback by default). */
export function ensureAuthoredTaskForm(
  packId: string,
  taskId: string,
  title: string,
): AuthoredTaskForm {
  const key = taskFormKey(packId, taskId);
  const stored = state().taskForms[key];
  if (!stored) {
    const form =
      getAutocareGroupsSeedForm(packId, taskId) ??
      defaultAuthoredTaskForm(title);
    saveAuthoredTaskForm(packId, taskId, form);
    return form;
  }
  return getAuthoredTaskForm(packId, taskId, title);
}

/**
 * Persist Autocare group form seeds for any tasks not already in local storage.
 * Safe to call when opening Course Builder — never overwrites staff edits.
 */
export function seedAutocareGroupsFormsIfNeeded(packId: string): number {
  if (!isAutocareGroupsPackId(packId)) return 0;
  const prev = state();
  const seeds = buildAutocareGroupsSeedFormsForPack(packId);
  let added = 0;
  const nextForms = { ...prev.taskForms };
  for (const [key, form] of Object.entries(seeds)) {
    if (nextForms[key]) continue;
    nextForms[key] = form;
    added += 1;
  }
  if (added === 0) return 0;
  writeState({ ...prev, taskForms: nextForms });
  return added;
}

export function saveAuthoredTaskForm(
  packId: string,
  taskId: string,
  form: AuthoredTaskForm,
): void {
  const prev = state();
  const key = taskFormKey(packId, taskId);
  writeState({
    ...prev,
    taskForms: {
      ...prev.taskForms,
      [key]: form,
    },
  });
}

export function hasAuthoredTaskForm(
  packId: string,
  taskId: string,
  snap: CourseBuilderState = state(),
): boolean {
  if (snap.taskForms[taskFormKey(packId, taskId)]) return true;
  return getAutocareGroupsSeedForm(packId, taskId) != null;
}

/** True only when staff have explicitly marked the learner form complete. */
export function isAuthoredTaskFormReady(
  packId: string,
  taskId: string,
  snap: CourseBuilderState = state(),
): boolean {
  const stored = snap.taskForms[taskFormKey(packId, taskId)];
  if (stored) return stored.status === "ready";
  return getAutocareGroupsSeedForm(packId, taskId)?.status === "ready";
}

export function authoredTaskFormBadge(
  packId: string,
  taskId: string,
  snap: CourseBuilderState = state(),
): { label: "Form ready" | "Pending"; tone: "green" | "amber" } {
  if (isAuthoredTaskFormReady(packId, taskId, snap)) {
    return { label: "Form ready", tone: "green" };
  }
  return { label: "Pending", tone: "amber" };
}
