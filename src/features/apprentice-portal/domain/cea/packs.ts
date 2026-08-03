/**
 * Groups-spine pack registry: Skills England standard + version → CEA pack.
 * Legacy and current share the same starter structure; version is metadata only.
 * KSBs are never seeded — Jon maps later.
 */

import type { StandardCode } from "@/features/administration/domain/cohort-products";
import {
  CURRENT_STANDARD_VERSION,
  LEGACY_STANDARD_VERSION,
  normalizeStandardCode,
} from "@/features/administration/domain/cohort-products";
import { AUTOCARE_CEA_PACK } from "./autocare-pack";
import { HEAVY_CEA_PACK } from "./heavy-pack";
import { LIGHT_CEA_PACK } from "./light-pack";
import { PAINT_CEA_PACK } from "./paint-pack";
import { PANEL_CEA_PACK } from "./panel-pack";
import { clonePackForVersion } from "./pack-builder";
import type { CeaPackDef } from "./types";

const BASE_PACKS: Record<StandardCode, CeaPackDef> = {
  ST0499: AUTOCARE_CEA_PACK,
  ST0068: HEAVY_CEA_PACK,
  ST0033: LIGHT_CEA_PACK,
  ST0448: PAINT_CEA_PACK,
  ST0403: PANEL_CEA_PACK,
};

function versionedPack(
  standardCode: StandardCode,
  standardVersion: string,
): CeaPackDef {
  const base = BASE_PACKS[standardCode];
  const version = standardVersion.replace(/^v/i, "");
  // Autocare 1.1 finishers share the same groups starter (structure only).
  if (standardCode === "ST0499" && (version === "1.0" || version === "1.1")) {
    return clonePackForVersion(base, "1.1", {
      id: `cea-autocare-st0499-v1.1`,
      title: `${base.title} (v1.1 finishers)`,
    });
  }
  if (version === base.version.replace(/^v/i, "")) {
    return {
      ...base,
      id: `${base.id}-v${version}`,
      version,
    };
  }
  return clonePackForVersion(base, version, {
    id: `${base.id}-v${version}`,
  });
}

/** Seed packs for every product version we expose. */
export const GROUPS_PACK_SEEDS: CeaPackDef[] = (
  Object.keys(BASE_PACKS) as StandardCode[]
).flatMap((code) => {
  const versions = new Set([
    LEGACY_STANDARD_VERSION[code],
    CURRENT_STANDARD_VERSION[code],
  ]);
  if (code === "ST0499") versions.add("1.1");
  return [...versions].map((v) => versionedPack(code, v));
});

const BY_ID = new Map(GROUPS_PACK_SEEDS.map((p) => [p.id, p]));

export function groupsPackId(
  standardCode: string,
  standardVersion: string,
): string {
  const code = normalizeStandardCode(standardCode);
  if (!code) return "";
  let version = standardVersion.trim().replace(/^v/i, "");
  if (code === "ST0499" && version === "1.0") version = "1.1";
  const base = BASE_PACKS[code];
  return `${base.id}-v${version}`;
}

export function resolveGroupsPack(
  standardCode: string,
  standardVersion: string,
): CeaPackDef | null {
  const id = groupsPackId(standardCode, standardVersion);
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function getGroupsPackById(packId: string): CeaPackDef | null {
  if (BY_ID.has(packId)) return BY_ID.get(packId) ?? null;
  // Backward compat with pre-versioned Autocare id.
  if (packId === AUTOCARE_CEA_PACK.id || packId === "cea-autocare-st0499") {
    return resolveGroupsPack("ST0499", "1.3");
  }
  return null;
}

export function listGroupsPacksForStandard(
  standardCode: string,
): CeaPackDef[] {
  const code = normalizeStandardCode(standardCode);
  if (!code) return [];
  return GROUPS_PACK_SEEDS.filter((p) => p.standardCode === code);
}
