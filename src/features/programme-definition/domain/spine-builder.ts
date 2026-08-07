/**
 * Helpers for Spine Builder structure + KSB assignment.
 */

import type { ImportedKsb, SpineItem, SpineItemType } from "./types";

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

function baseItem(
  type: SpineItemType,
  title: string,
  sequenceHint: number,
  extras: Partial<SpineItem> = {},
): SpineItem {
  return {
    id: crypto.randomUUID(),
    itemType: type,
    gatewayType: null,
    title,
    sequence: sequenceHint,
    plannedWeeks: null,
    plannedOtjHours: 0,
    countsTowardsLearningHours: false,
    metadata: {},
    ...extras,
  };
}

export function createSpineItemFromType(
  type: SpineItemType,
  sequenceHint: number,
): SpineItem {
  const blockNumber = Math.max(1, sequenceHint);
  switch (type) {
    case "block":
      return baseItem("block", `Block ${blockNumber}`, sequenceHint, {
        countsTowardsLearningHours: true,
        metadata: { blockNumber },
      });
    case "gateway":
      return baseItem("gateway", "Gateway", sequenceHint, {
        gatewayType: "internal",
      });
    case "epa":
      return baseItem("epa", "End-Point Assessment (EPA)", sequenceHint, {
        plannedWeeks: 0,
      });
    case "milestone":
      return baseItem("milestone", "Milestone", sequenceHint);
    case "break":
      return baseItem("break", "Break", sequenceHint);
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
