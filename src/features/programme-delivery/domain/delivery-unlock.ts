/**
 * Block unlock / reflection helpers for spine-based delivery catalogues.
 * Uses sequence + prior-block task lists — not Autocare numeric block ids.
 */

import type { PracticalTaskDef } from "./task-schema";
import { getTaskSubmission } from "./task-submission-store";
import type { DeliveryBlockView } from "./published-delivery-catalogue";

export function isPriorBlockReflectionVerified(
  priorBlockTasks: PracticalTaskDef[],
  apprenticeId: string,
): boolean {
  const reflection = priorBlockTasks.find((t) => t.kind === "reflection");
  if (!reflection) return false;
  return getTaskSubmission(reflection.id, apprenticeId).status === "verified";
}

/**
 * Unlock by catalogue sequence + optional week metadata.
 * Future blocks stay locked until their week begins (when weekStart is set)
 * unless the prior block reflection is verified.
 */
export function isDeliveryBlockUnlocked(input: {
  block: DeliveryBlockView;
  blocks: DeliveryBlockView[];
  programmeWeek: number;
  priorBlockTasks: PracticalTaskDef[];
  apprenticeId: string;
}): boolean {
  const ordered = input.blocks
    .slice()
    .sort((a, b) => a.sequence - b.sequence);
  const index = ordered.findIndex(
    (b) => b.spineItemId === input.block.spineItemId,
  );
  if (index <= 0) return true;

  // Calendar reach: any block whose weekStart has been reached unlocks that far
  const week = Number.isFinite(input.programmeWeek) ? input.programmeWeek : 1;
  let reachedIndex = 0;
  for (let i = 0; i < ordered.length; i++) {
    const w = ordered[i]!.weekStart;
    if (w != null && week >= w) reachedIndex = i;
  }
  if (index <= reachedIndex) return true;

  return isPriorBlockReflectionVerified(
    input.priorBlockTasks,
    input.apprenticeId,
  );
}
