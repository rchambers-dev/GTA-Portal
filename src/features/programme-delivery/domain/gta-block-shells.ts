/**
 * GTA forward block spine: fixed 10 + 2 empty shells per standard.
 * Tutors add headings; no tasks / OTJ / KSBs seeded.
 */

import type { StandardCode } from "@/features/administration/domain/cohort-products";
import {
  CURRENT_STANDARD_VERSION,
  COURSE_STANDARD_CODES,
  normalizeStandardCode,
  standardLabel,
} from "@/features/administration/domain/cohort-products";

export type GtaBlockKind = "training" | "pre_epa" | "epa";

export type GtaBlockShell = {
  id: number;
  /** Editable heading — starts as placeholder. */
  name: string;
  kind: GtaBlockKind;
};

export type GtaBlockPack = {
  id: string;
  standardCode: StandardCode;
  standardVersion: string;
  standardLabel: string;
  title: string;
  blocks: GtaBlockShell[];
};

function emptyShells(): GtaBlockShell[] {
  const blocks: GtaBlockShell[] = [];
  for (let id = 1; id <= 10; id += 1) {
    blocks.push({
      id,
      name: `Block ${id}`,
      kind: "training",
    });
  }
  blocks.push({
    id: 11,
    name: "Pre-EPA Consolidation",
    kind: "pre_epa",
  });
  blocks.push({
    id: 12,
    name: "End-Point Assessment",
    kind: "epa",
  });
  return blocks;
}

function buildBlockPack(standardCode: StandardCode): GtaBlockPack {
  const standardVersion = CURRENT_STANDARD_VERSION[standardCode];
  const label = standardLabel(standardCode);
  return {
    id: `blocks-${standardCode.toLowerCase()}-v${standardVersion}`,
    standardCode,
    standardVersion,
    standardLabel: label,
    title: `${label} · GTA blocks (10+2)`,
    blocks: emptyShells(),
  };
}

export const GTA_BLOCK_PACKS: GtaBlockPack[] =
  COURSE_STANDARD_CODES.map(buildBlockPack);

const BY_STANDARD = new Map(
  GTA_BLOCK_PACKS.map((p) => [p.standardCode, p] as const),
);

export function resolveBlockPack(
  standardCode: string,
  standardVersion?: string,
): GtaBlockPack | null {
  const code = normalizeStandardCode(standardCode);
  if (!code) return null;
  const pack = BY_STANDARD.get(code);
  if (!pack) return null;
  if (standardVersion) {
    const version = standardVersion.trim().replace(/^v/i, "");
    // Blocks only exist on the newest SE version.
    if (version && version !== pack.standardVersion) return null;
  }
  return pack;
}

export function getBlockPackById(packId: string): GtaBlockPack | null {
  return GTA_BLOCK_PACKS.find((p) => p.id === packId) ?? null;
}

export function listBlockPacks(): GtaBlockPack[] {
  return GTA_BLOCK_PACKS;
}
