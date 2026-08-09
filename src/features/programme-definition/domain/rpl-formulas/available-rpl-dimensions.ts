/**
 * RPL recognition dimensions = official KSB types ∩ programme RPL-eligible flags.
 *
 * 1. Category exists — from bound official Skills England pack.
 * 2. Category is RPL-enabled — GTA config on the programme version (includeRpl*).
 *
 * Do not confuse "absent from official" with "exists but excluded from RPL".
 */

import type {
  ImportedKsb,
  KsbType,
  ProgrammeDeliveryParameters,
} from "../types";

/** Ordered recognition dimensions used by Phase 1 learner RPL. */
export type RplDimension = Extract<
  KsbType,
  "knowledge" | "skill" | "behaviour"
>;

export const RPL_DIMENSION_ORDER: RplDimension[] = [
  "knowledge",
  "skill",
  "behaviour",
];

export const RPL_DIMENSION_LABELS: Record<RplDimension, string> = {
  knowledge: "Knowledge already held",
  skill: "Skills already demonstrated",
  behaviour: "Behaviours already evidenced",
};

export const RPL_DIMENSION_PCT_FIELD: Record<
  RplDimension,
  "knowledgePct" | "skillsPct" | "behavioursPct"
> = {
  knowledge: "knowledgePct",
  skill: "skillsPct",
  behaviour: "behavioursPct",
};

export const RPL_DIMENSION_INCLUDE_FIELD: Record<
  RplDimension,
  | "includeRplKnowledge"
  | "includeRplSkills"
  | "includeRplBehaviours"
> = {
  knowledge: "includeRplKnowledge",
  skill: "includeRplSkills",
  behaviour: "includeRplBehaviours",
};

/** Programme RPL-eligibility flags for block_ksb_value_v1 (missing ⇒ true). */
export type ProgrammeRplIncludeFlags = Partial<
  Pick<
    ProgrammeDeliveryParameters,
    "includeRplKnowledge" | "includeRplSkills" | "includeRplBehaviours"
  >
> | null | undefined;

/**
 * Dimensions present on the official pack (existence only).
 * Used by Programme Builder to decide which eligibility toggles to show.
 */
export function officialRplDimensions(
  officialKsbs: Pick<ImportedKsb, "type">[],
): RplDimension[] {
  const present = new Set<KsbType>();
  for (const k of officialKsbs) {
    present.add(k.type);
  }
  return RPL_DIMENSION_ORDER.filter((d) => present.has(d));
}

/**
 * Whether a dimension is RPL-eligible on this programme version.
 * Missing / undefined flags default to true (historical snapshots).
 */
export function isProgrammeRplDimensionEnabled(
  flags: ProgrammeRplIncludeFlags,
  dimension: RplDimension,
): boolean {
  const key = RPL_DIMENSION_INCLUDE_FIELD[dimension];
  const value = flags?.[key];
  return value !== false;
}

/**
 * Learner RPL controls / engine dimensions for a bound programme version:
 * official dimensions ∩ programme RPL-enabled.
 *
 * When programme flags are omitted, all official dimensions remain enabled.
 */
export function availableRplDimensions(
  officialKsbs: Pick<ImportedKsb, "type">[],
  programmeInclude?: ProgrammeRplIncludeFlags,
): RplDimension[] {
  return officialRplDimensions(officialKsbs).filter((d) =>
    isProgrammeRplDimensionEnabled(programmeInclude, d),
  );
}

export function hasRplDimension(
  dimensions: RplDimension[],
  dimension: RplDimension,
): boolean {
  return dimensions.includes(dimension);
}
