/**
 * S4 Block unlock: calendar / sequence by default.
 * Exception: authorised per-enrolment override (gta_enrolment_block_unlocks).
 *
 * Task 5 / reflection verified does NOT unlock the next Block.
 * All Sessions green does NOT unlock the next Block.
 * Task completion does NOT unlock the next Block.
 */

import type { DeliveryBlockView } from "./published-delivery-catalogue";

export function isDeliveryBlockUnlocked(input: {
  block: DeliveryBlockView;
  blocks: DeliveryBlockView[];
  programmeWeek: number;
  /** Spine item ids unlocked for THIS enrolment only. */
  manuallyUnlockedBlockIds?: string[];
}): boolean {
  const ordered = input.blocks
    .slice()
    .sort((a, b) => a.sequence - b.sequence);
  const index = ordered.findIndex(
    (b) => b.spineItemId === input.block.spineItemId,
  );
  if (index < 0) return false;
  if (index === 0) return true;

  const unlocked = new Set(input.manuallyUnlockedBlockIds ?? []);
  if (unlocked.has(input.block.spineItemId)) return true;

  const week = Number.isFinite(input.programmeWeek) ? input.programmeWeek : 1;
  let reachedIndex = 0;
  for (let i = 0; i < ordered.length; i++) {
    const w = ordered[i]!.weekStart;
    if (w != null && week >= w) reachedIndex = i;
  }
  return index <= reachedIndex;
}
