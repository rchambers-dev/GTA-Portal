/**
 * Helpers for Spine Builder structure + KSB assignment.
 */

import type { ImportedKsb, SpineItem, SpineItemType } from "./types";
import { toggleKsbOnBlock } from "./validation";

export const SPINE_STRUCTURE_PALETTE: Array<{
  type: SpineItemType;
  label: string;
  description: string;
}> = [
  {
    type: "block",
    label: "Block",
    description: "Delivery block — can hold assigned KSBs",
  },
  {
    type: "gateway",
    label: "Gateway",
    description: "Internal or official gateway checkpoint",
  },
  {
    type: "epa",
    label: "EPA",
    description: "End-point assessment stage",
  },
  {
    type: "milestone",
    label: "Milestone",
    description: "Non-delivery milestone marker",
  },
  {
    type: "break",
    label: "Break",
    description: "Scheduled break in the spine",
  },
];

export function resequenceSpineItems(items: SpineItem[]): SpineItem[] {
  return items.map((item, index) => ({
    ...item,
    sequence: index + 1,
    metadata:
      item.itemType === "block"
        ? {
            ...item.metadata,
            blockNumber:
              items
                .slice(0, index + 1)
                .filter((i) => i.itemType === "block").length,
          }
        : item.metadata,
  }));
}

export function createSpineItemFromType(
  type: SpineItemType,
  sequenceHint: number,
): SpineItem {
  const blockNumber = Math.max(1, sequenceHint);
  switch (type) {
    case "block":
      return {
        id: crypto.randomUUID(),
        itemType: "block",
        gatewayType: null,
        title: `Block ${blockNumber}`,
        sequence: sequenceHint,
        plannedWeeks: null,
        plannedOtjHours: 0,
        countsTowardsLearningHours: true,
        assignedKsbCodes: [],
        metadata: { blockNumber },
      };
    case "gateway":
      return {
        id: crypto.randomUUID(),
        itemType: "gateway",
        gatewayType: "internal",
        title: "Gateway",
        sequence: sequenceHint,
        plannedWeeks: null,
        plannedOtjHours: 0,
        countsTowardsLearningHours: false,
        assignedKsbCodes: [],
        metadata: {},
      };
    case "epa":
      return {
        id: crypto.randomUUID(),
        itemType: "epa",
        gatewayType: null,
        title: "End-Point Assessment (EPA)",
        sequence: sequenceHint,
        plannedWeeks: 0,
        plannedOtjHours: 0,
        countsTowardsLearningHours: false,
        assignedKsbCodes: [],
        metadata: {},
      };
    case "milestone":
      return {
        id: crypto.randomUUID(),
        itemType: "milestone",
        gatewayType: null,
        title: "Milestone",
        sequence: sequenceHint,
        plannedWeeks: null,
        plannedOtjHours: 0,
        countsTowardsLearningHours: false,
        assignedKsbCodes: [],
        metadata: {},
      };
    case "break":
      return {
        id: crypto.randomUUID(),
        itemType: "break",
        gatewayType: null,
        title: "Break",
        sequence: sequenceHint,
        plannedWeeks: null,
        plannedOtjHours: 0,
        countsTowardsLearningHours: false,
        assignedKsbCodes: [],
        metadata: {},
      };
  }
}

export function insertSpineItemAt(
  items: SpineItem[],
  item: SpineItem,
  index: number,
): SpineItem[] {
  const sorted = items.slice().sort((a, b) => a.sequence - b.sequence);
  const next = [...sorted];
  const clamped = Math.max(0, Math.min(index, next.length));
  next.splice(clamped, 0, item);
  return resequenceSpineItems(next);
}

export function moveSpineItem(
  items: SpineItem[],
  fromIndex: number,
  toIndex: number,
): SpineItem[] {
  const sorted = items.slice().sort((a, b) => a.sequence - b.sequence);
  if (
    fromIndex < 0 ||
    fromIndex >= sorted.length ||
    toIndex < 0 ||
    toIndex > sorted.length
  ) {
    return sorted;
  }
  const next = [...sorted];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return sorted;
  const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
  next.splice(insertAt, 0, moved);
  return resequenceSpineItems(next);
}

export function updateSpineItemFields(
  items: SpineItem[],
  id: string,
  patch: Partial<
    Pick<SpineItem, "title" | "plannedWeeks" | "plannedOtjHours" | "gatewayType">
  >,
): SpineItem[] {
  return items.map((item) =>
    item.id === id
      ? {
          ...item,
          ...patch,
          plannedOtjHours:
            patch.plannedOtjHours != null
              ? Math.max(0, patch.plannedOtjHours)
              : item.plannedOtjHours,
        }
      : item,
  );
}

export function removeSpineItem(items: SpineItem[], id: string): SpineItem[] {
  return resequenceSpineItems(items.filter((item) => item.id !== id));
}

export function assignKsbToBlock(
  items: SpineItem[],
  blockId: string,
  ksbCode: string,
): SpineItem[] {
  return toggleKsbOnBlock(items, blockId, ksbCode);
}

export function removeKsbFromBlock(
  items: SpineItem[],
  blockId: string,
  ksbCode: string,
): SpineItem[] {
  const code = ksbCode.toUpperCase();
  return items.map((item) => {
    if (item.id !== blockId || item.itemType !== "block") return item;
    return {
      ...item,
      assignedKsbCodes: item.assignedKsbCodes.filter(
        (c) => c.toUpperCase() !== code,
      ),
    };
  });
}

export function labelSpineType(item: SpineItem): string {
  if (item.itemType === "gateway") return "Gateway";
  if (item.itemType === "epa") return "EPA";
  if (item.itemType === "block") return "Block";
  if (item.itemType === "milestone") return "Milestone";
  if (item.itemType === "break") return "Break";
  return item.itemType;
}

export function ksbByCode(
  ksbs: ImportedKsb[],
  code: string,
): ImportedKsb | undefined {
  const needle = code.toUpperCase();
  return ksbs.find((k) => k.code.toUpperCase() === needle);
}
