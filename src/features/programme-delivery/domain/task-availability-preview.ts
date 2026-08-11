/**
 * S8 availability preview (pure). Aligns with S3/S4/S5.
 * Not learner delivery runtime yet.
 */

import type { ProgrammeSessionRecord } from "@/features/programme-definition/domain/programme-sessions";
import type {
  TaskReleaseMode,
  TaskSessionLinkRecord,
} from "./task-session-links";

export type PreviewTaskAvailabilityStatus =
  | "NOT_AVAILABLE"
  | "AVAILABLE"
  | "COMING_UP";

export type PreviewBlockMeta = {
  spineItemId: string;
  blockOrdinal: number;
  weekStart: number | null;
  title: string;
};

export type PreviewTaskInput = {
  id: string;
  title: string;
  taskNumber: number;
  blockOrdinal: number;
  spineItemId: string;
  publishStatus: "draft" | "published";
  releaseMode?: TaskReleaseMode;
};

export type TaskAvailabilityPreviewInput = {
  programmeWeek: number;
  blocks: PreviewBlockMeta[];
  sessions: ProgrammeSessionRecord[];
  tasks: PreviewTaskInput[];
  links: TaskSessionLinkRecord[];
  /** S4 — per-learner authorised early unlock of a block (spine item id). */
  manuallyUnlockedBlockIds?: string[];
  /** S3 — tutor force-release of a task. */
  manuallyReleasedTaskIds?: string[];
  /** S3 — tutor hold-back even if gates would open. */
  heldTaskIds?: string[];
};

export type TaskAvailabilityPreviewRow = {
  taskId: string;
  title: string;
  taskNumber: number;
  blockOrdinal: number;
  status: PreviewTaskAvailabilityStatus;
  openable: boolean;
  reasons: string[];
  publishStatus: "draft" | "published";
};

function blockOpen(
  block: PreviewBlockMeta,
  programmeWeek: number,
  manuallyUnlockedBlockIds: Set<string>,
): { open: boolean; reasons: string[] } {
  if (manuallyUnlockedBlockIds.has(block.spineItemId)) {
    return {
      open: true,
      reasons: ["Block manually unlocked (authorised override)."],
    };
  }
  if (block.weekStart == null) {
    // Gateway/EPA-like or missing weeks: treat as not open by calendar alone.
    return {
      open: false,
      reasons: ["Block has no weekStart — waiting for delivery sequence / override."],
    };
  }
  if (programmeWeek >= block.weekStart) {
    return {
      open: true,
      reasons: [
        `Programme week ${programmeWeek} has reached block weekStart ${block.weekStart}.`,
      ],
    };
  }
  return {
    open: false,
    reasons: [
      `Block opens at week ${block.weekStart} (currently week ${programmeWeek}).`,
    ],
  };
}

function sessionReached(
  session: ProgrammeSessionRecord,
  programmeWeek: number,
): boolean {
  return session.calendarWeek <= programmeWeek;
}

export function previewTaskAvailability(
  input: TaskAvailabilityPreviewInput,
): TaskAvailabilityPreviewRow[] {
  const week = Number.isFinite(input.programmeWeek)
    ? Math.max(1, Math.floor(input.programmeWeek))
    : 1;
  const unlocked = new Set(input.manuallyUnlockedBlockIds ?? []);
  const released = new Set(input.manuallyReleasedTaskIds ?? []);
  const held = new Set(input.heldTaskIds ?? []);
  const sessionsById = new Map(input.sessions.map((s) => [s.id, s]));
  const blocksBySpine = new Map(input.blocks.map((b) => [b.spineItemId, b]));

  const rows: TaskAvailabilityPreviewRow[] = [];

  for (const task of input.tasks) {
    const reasons: string[] = [];
    const block = blocksBySpine.get(task.spineItemId);
    const releaseMode: TaskReleaseMode = task.releaseMode ?? "session";

    if (!block) {
      rows.push({
        taskId: task.id,
        title: task.title,
        taskNumber: task.taskNumber,
        blockOrdinal: task.blockOrdinal,
        status: "NOT_AVAILABLE",
        openable: false,
        reasons: ["Task block was not found on the spine."],
        publishStatus: task.publishStatus,
      });
      continue;
    }

    const open = blockOpen(block, week, unlocked);
    reasons.push(...open.reasons);

    if (!open.open) {
      rows.push({
        taskId: task.id,
        title: task.title,
        taskNumber: task.taskNumber,
        blockOrdinal: task.blockOrdinal,
        status: "NOT_AVAILABLE",
        openable: false,
        reasons,
        publishStatus: task.publishStatus,
      });
      continue;
    }

    if (held.has(task.id)) {
      rows.push({
        taskId: task.id,
        title: task.title,
        taskNumber: task.taskNumber,
        blockOrdinal: task.blockOrdinal,
        status: "COMING_UP",
        openable: false,
        reasons: [...reasons, "Held back by tutor override."],
        publishStatus: task.publishStatus,
      });
      continue;
    }

    if (released.has(task.id)) {
      rows.push({
        taskId: task.id,
        title: task.title,
        taskNumber: task.taskNumber,
        blockOrdinal: task.blockOrdinal,
        status: "AVAILABLE",
        openable: true,
        reasons: [...reasons, "Manually released by tutor."],
        publishStatus: task.publishStatus,
      });
      continue;
    }

    if (releaseMode === "manual") {
      rows.push({
        taskId: task.id,
        title: task.title,
        taskNumber: task.taskNumber,
        blockOrdinal: task.blockOrdinal,
        status: "COMING_UP",
        openable: false,
        reasons: [...reasons, "Release mode is manual — waiting for tutor release."],
        publishStatus: task.publishStatus,
      });
      continue;
    }

    if (releaseMode === "immediate_when_block_open") {
      rows.push({
        taskId: task.id,
        title: task.title,
        taskNumber: task.taskNumber,
        blockOrdinal: task.blockOrdinal,
        status: "AVAILABLE",
        openable: true,
        reasons: [...reasons, "Immediate when block open."],
        publishStatus: task.publishStatus,
      });
      continue;
    }

    // session (default) or date (date not wired — treat like session/null)
    const taskLinks = input.links.filter((l) => l.taskId === task.id);
    const earliest = taskLinks.filter(
      (l) => l.linkType === "earliest_available_after",
    );

    if (earliest.length === 0) {
      rows.push({
        taskId: task.id,
        title: task.title,
        taskNumber: task.taskNumber,
        blockOrdinal: task.blockOrdinal,
        status: "AVAILABLE",
        openable: true,
        reasons: [
          ...reasons,
          "No earliest_available_after link — available when block opens (S3 null-link rule).",
        ],
        publishStatus: task.publishStatus,
      });
      continue;
    }

    let allReached = true;
    for (const link of earliest) {
      const session = sessionsById.get(link.sessionId);
      if (!session) {
        allReached = false;
        reasons.push("Earliest session link points to a missing session.");
        continue;
      }
      if (!sessionReached(session, week)) {
        allReached = false;
        reasons.push(
          `Waiting for session ${session.sessionKey} (week ${session.calendarWeek}).`,
        );
      } else {
        reasons.push(
          `Earliest session ${session.sessionKey} (week ${session.calendarWeek}) reached.`,
        );
      }
    }

    if (allReached) {
      rows.push({
        taskId: task.id,
        title: task.title,
        taskNumber: task.taskNumber,
        blockOrdinal: task.blockOrdinal,
        status: "AVAILABLE",
        openable: true,
        reasons,
        publishStatus: task.publishStatus,
      });
    } else {
      rows.push({
        taskId: task.id,
        title: task.title,
        taskNumber: task.taskNumber,
        blockOrdinal: task.blockOrdinal,
        status: "COMING_UP",
        openable: false,
        reasons,
        publishStatus: task.publishStatus,
      });
    }
  }

  return rows.sort(
    (a, b) =>
      a.blockOrdinal - b.blockOrdinal || a.taskNumber - b.taskNumber,
  );
}
