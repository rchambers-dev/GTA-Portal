/**
 * TASK↔SESSION link types (S2 / S3).
 */

export const TASK_SESSION_LINK_TYPES = [
  "supports",
  "earliest_available_after",
  "target",
  "due_by",
  "requires",
] as const;

export type TaskSessionLinkType = (typeof TASK_SESSION_LINK_TYPES)[number];

export type TaskReleaseMode =
  | "session"
  | "manual"
  | "date"
  | "immediate_when_block_open";

export type TaskSessionLinkRecord = {
  id: string;
  programmeVersionId: string;
  taskId: string;
  sessionId: string;
  linkType: TaskSessionLinkType;
  createdAt: string;
  updatedAt: string;
};

export type TaskSessionLinkUpsertInput = {
  taskId: string;
  sessionId: string;
  linkType: TaskSessionLinkType;
};

export function isTaskSessionLinkType(value: string): value is TaskSessionLinkType {
  return (TASK_SESSION_LINK_TYPES as readonly string[]).includes(value);
}
