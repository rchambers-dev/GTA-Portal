/**
 * Helpers for Block ↔ KSB mappings (primary allocation + LearningIntent).
 * Only block spine items may receive mappings.
 */

import type {
  BlockKsbMapping,
  LearningIntent,
  MappingSource,
  RecommendationProvider,
  SpineItem,
} from "./types";
import { LEARNING_INTENTS } from "./types";

export function isLearningIntent(value: unknown): value is LearningIntent {
  return (
    typeof value === "string" &&
    (LEARNING_INTENTS as string[]).includes(value)
  );
}

export function assertBlockTarget(
  spineItems: SpineItem[],
  blockId: string,
): SpineItem {
  const item = spineItems.find((i) => i.id === blockId);
  if (!item) {
    throw new Error("Cannot map a KSB — spine item not found.");
  }
  if (item.itemType !== "block") {
    throw new Error(
      "KSB mappings are only allowed on blocks (not gateway, EPA, milestone, or break).",
    );
  }
  return item;
}

export function mappingsForBlock(
  mappings: BlockKsbMapping[],
  blockId: string,
): BlockKsbMapping[] {
  return mappings.filter((m) => m.blockId === blockId);
}

export function primaryMappingForKsb(
  mappings: BlockKsbMapping[],
  ksbCode: string,
): BlockKsbMapping | undefined {
  const code = ksbCode.toUpperCase();
  return mappings.find(
    (m) => m.ksbCode.toUpperCase() === code && m.isPrimary,
  );
}

export function findMapping(
  mappings: BlockKsbMapping[],
  blockId: string,
  ksbCode: string,
): BlockKsbMapping | undefined {
  const code = ksbCode.toUpperCase();
  return mappings.find(
    (m) => m.blockId === blockId && m.ksbCode.toUpperCase() === code,
  );
}

export type MappingProvenanceInput = {
  recommendationProvider?: RecommendationProvider | null;
  recommendationFeature?: string | null;
  recommendedIntent?: LearningIntent | null;
  recommendationAccepted?: boolean | null;
  confidence?: number | null;
  aiReasonSummary?: string | null;
};

function emptyProvenance(): Pick<
  BlockKsbMapping,
  | "recommendationProvider"
  | "recommendationFeature"
  | "recommendedIntent"
  | "recommendationAccepted"
  | "confidence"
  | "aiReasonSummary"
> {
  return {
    recommendationProvider: null,
    recommendationFeature: null,
    recommendedIntent: null,
    recommendationAccepted: null,
    confidence: null,
    aiReasonSummary: null,
  };
}

export function createBlockKsbMapping(args: {
  blockId: string;
  ksbCode: string;
  isPrimary: boolean;
  learningIntent: LearningIntent;
  mappingSource: MappingSource;
  createdBy: string;
  existing?: BlockKsbMapping[];
  spineItems?: SpineItem[];
} & MappingProvenanceInput): BlockKsbMapping[] {
  if (args.spineItems) {
    assertBlockTarget(args.spineItems, args.blockId);
  }

  const code = args.ksbCode.trim().toUpperCase();
  const now = new Date().toISOString();
  const existing = args.existing ?? [];

  if (findMapping(existing, args.blockId, code)) {
    return existing;
  }

  let next = [...existing];
  if (args.isPrimary) {
    next = next.map((m) =>
      m.ksbCode.toUpperCase() === code && m.isPrimary
        ? { ...m, isPrimary: false, updatedAt: now }
        : m,
    );
  }

  const row: BlockKsbMapping = {
    id: crypto.randomUUID(),
    blockId: args.blockId,
    ksbCode: code,
    isPrimary: args.isPrimary,
    learningIntent: args.learningIntent,
    mappingSource: args.mappingSource,
    recommendationProvider: args.recommendationProvider ?? null,
    recommendationFeature: args.recommendationFeature ?? null,
    recommendedIntent: args.recommendedIntent ?? null,
    recommendationAccepted: args.recommendationAccepted ?? null,
    confidence: args.confidence ?? null,
    aiReasonSummary: args.aiReasonSummary ?? null,
    createdBy: args.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  return [...next, row];
}

export function updateBlockKsbMapping(
  mappings: BlockKsbMapping[],
  mappingId: string,
  patch: Partial<
    Pick<
      BlockKsbMapping,
      | "isPrimary"
      | "learningIntent"
      | "mappingSource"
      | "recommendationProvider"
      | "recommendationFeature"
      | "recommendedIntent"
      | "recommendationAccepted"
      | "confidence"
      | "aiReasonSummary"
    >
  >,
): BlockKsbMapping[] {
  const now = new Date().toISOString();
  const target = mappings.find((m) => m.id === mappingId);
  if (!target) return mappings;

  let next = mappings.map((m) =>
    m.id === mappingId ? { ...m, ...patch, updatedAt: now } : m,
  );

  if (patch.isPrimary === true) {
    const code = target.ksbCode.toUpperCase();
    next = next.map((m) =>
      m.id !== mappingId && m.ksbCode.toUpperCase() === code && m.isPrimary
        ? { ...m, isPrimary: false, updatedAt: now }
        : m,
    );
  }

  return next;
}

export function removeBlockKsbMapping(
  mappings: BlockKsbMapping[],
  blockId: string,
  ksbCode: string,
): BlockKsbMapping[] {
  const code = ksbCode.toUpperCase();
  return mappings.filter(
    (m) => !(m.blockId === blockId && m.ksbCode.toUpperCase() === code),
  );
}

export function removeMappingsForBlock(
  mappings: BlockKsbMapping[],
  blockId: string,
): BlockKsbMapping[] {
  return mappings.filter((m) => m.blockId !== blockId);
}

/** Strip mappings that no longer point at a block (orphans / non-blocks). */
export function filterMappingsToBlocks(
  mappings: BlockKsbMapping[],
  spineItems: SpineItem[],
): BlockKsbMapping[] {
  const blockIds = new Set(
    spineItems.filter((i) => i.itemType === "block").map((i) => i.id),
  );
  return mappings.filter((m) => blockIds.has(m.blockId));
}

/** Describe primary ownership changes for the activity log. */
export function describePrimaryOwnershipChanges(
  before: BlockKsbMapping[],
  after: BlockKsbMapping[],
  spineItems: SpineItem[],
): string[] {
  const title = (blockId: string) => {
    const item = spineItems.find((i) => i.id === blockId);
    if (!item) return blockId.slice(0, 8);
    const n = item.metadata?.blockNumber;
    return typeof n === "number"
      ? `Block ${n} — ${item.title}`
      : item.title;
  };

  const beforePrimary = new Map<string, string>();
  for (const m of before) {
    if (m.isPrimary) beforePrimary.set(m.ksbCode.toUpperCase(), m.blockId);
  }
  const afterPrimary = new Map<string, string>();
  for (const m of after) {
    if (m.isPrimary) afterPrimary.set(m.ksbCode.toUpperCase(), m.blockId);
  }

  const codes = new Set([...beforePrimary.keys(), ...afterPrimary.keys()]);
  const lines: string[] = [];
  for (const code of [...codes].sort()) {
    const from = beforePrimary.get(code);
    const to = afterPrimary.get(code);
    if (from === to) continue;
    if (from && to) {
      lines.push(`${code} primary moved ${title(from)} → ${title(to)}`);
    } else if (to) {
      lines.push(`${code} primary set on ${title(to)}`);
    } else if (from) {
      lines.push(`${code} primary cleared (was ${title(from)})`);
    }
  }
  return lines;
}

/** Migrate legacy assignedKsbCodes on spine items → flat mappings. */
export function migrateAssignedCodesToMappings(
  spineItems: Array<SpineItem & { assignedKsbCodes?: string[] }>,
  existing: BlockKsbMapping[] | undefined,
  createdBy: string,
): BlockKsbMapping[] {
  if (existing && existing.length > 0) {
    return existing.map((m) => ({
      ...emptyProvenance(),
      ...m,
      recommendationProvider: m.recommendationProvider ?? null,
      recommendationFeature: m.recommendationFeature ?? null,
      recommendedIntent: m.recommendedIntent ?? null,
      recommendationAccepted: m.recommendationAccepted ?? null,
    }));
  }

  const now = new Date().toISOString();
  const out: BlockKsbMapping[] = [];
  for (const item of spineItems) {
    if (item.itemType !== "block") continue;
    const codes = item.assignedKsbCodes ?? [];
    for (const raw of codes) {
      const code = raw.trim().toUpperCase();
      if (!code) continue;
      if (out.some((m) => m.blockId === item.id && m.ksbCode === code)) continue;
      out.push({
        id: crypto.randomUUID(),
        blockId: item.id,
        ksbCode: code,
        isPrimary: false,
        learningIntent: "practise",
        mappingSource: "imported",
        ...emptyProvenance(),
        createdBy,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return out;
}

export function stripLegacyAssignedCodes(
  spineItems: Array<SpineItem & { assignedKsbCodes?: string[] }>,
): SpineItem[] {
  return spineItems.map((item) => {
    const { assignedKsbCodes: _drop, ...rest } = item;
    return rest;
  });
}
