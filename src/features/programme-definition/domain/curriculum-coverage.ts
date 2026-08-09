/**
 * Curriculum Coverage / Gap snapshot for Programme Builder.
 *
 * AUTHORITATIVE coverage = DB Block↔KSB mappings on the programme version.
 * Reviewed gaps / distributed-skill reviews / proposed amendments are
 * review evidence only and never inflate approved Primary counts.
 */

import { primaryCoverage } from "./validation";
import {
  distributedSkillKsbCodes,
  getDistributedSkillOwnershipReviews,
  getReviewedCurriculumGapRegister,
  reviewedGapKsbCodes,
  type DistributedSkillOwnershipReview,
  type ReviewedCurriculumGapRegister,
} from "./reviewed-curriculum-gaps";
import type {
  BlockKsbMapping,
  GtaProgrammeVersion,
  OfficialStandardVersion,
  SpineItem,
} from "./types";

export type KsbCoverageBucket =
  | "approved_primary"
  | "reviewed_gap"
  | "distributed_skill_review"
  | "not_yet_resolved";

export type ApprovedPrimaryRow = {
  ksbCode: string;
  blockId: string;
  blockNumber: number | null;
  blockTitle: string;
  learningIntent: string;
  curriculumValue: number;
};

export type CurriculumCoverageSnapshot = {
  officialRequired: number;
  approvedPrimaryCount: number;
  reviewedGapCount: number;
  distributedSkillCount: number;
  notYetResolvedCount: number;
  /** Official KSBs without an approved Primary (includes gaps + distributed + unresolved). */
  missingPrimaryCount: number;
  duplicatePrimaryCount: number;
  nonBlockPrimaryCount: number;
  gatewayEpaMappingCount: number;
  publicationBlocked: boolean;
  publicationBlockReason: string;
  approvedPrimaries: ApprovedPrimaryRow[];
  reviewedGapCodes: string[];
  distributedSkillCodes: string[];
  notYetResolvedCodes: string[];
  duplicatePrimaryCodes: string[];
  nonBlockPrimaryCodes: string[];
  bucketByCode: Record<string, KsbCoverageBucket>;
  reviewedRegister: ReviewedCurriculumGapRegister | null;
  distributedSkillReviews: DistributedSkillOwnershipReview[];
};

function blockNumberMap(spineItems: SpineItem[]): Map<string, number> {
  const blocks = spineItems
    .filter((i) => i.itemType === "block")
    .slice()
    .sort((a, b) => a.sequence - b.sequence);
  const map = new Map<string, number>();
  blocks.forEach((b, idx) => {
    const meta = b.metadata?.blockNumber;
    const n =
      typeof meta === "number" && Number.isFinite(meta) ? meta : idx + 1;
    map.set(b.id, n);
  });
  return map;
}

function compareKsbCode(a: string, b: string): number {
  const ma = /^([KSB])(\d+)$/i.exec(a);
  const mb = /^([KSB])(\d+)$/i.exec(b);
  if (ma && mb) {
    const order = { K: 0, S: 1, B: 2 } as const;
    const ta = order[ma[1].toUpperCase() as keyof typeof order] ?? 9;
    const tb = order[mb[1].toUpperCase() as keyof typeof order] ?? 9;
    if (ta !== tb) return ta - tb;
    return Number(ma[2]) - Number(mb[2]);
  }
  return a.localeCompare(b);
}

/**
 * Build coverage snapshot.
 * Proposed amendments never increment approvedPrimaryCount.
 */
export function buildCurriculumCoverageSnapshot(
  programme: GtaProgrammeVersion,
  official: OfficialStandardVersion,
): CurriculumCoverageSnapshot {
  const mappings = programme.ksbMappings ?? [];
  const coverage = primaryCoverage(programme, official);
  const register = getReviewedCurriculumGapRegister(programme.id);
  const distributedReviews = getDistributedSkillOwnershipReviews(programme.id);
  const gapCodes = reviewedGapKsbCodes(register);
  const distributedCodes = distributedSkillKsbCodes(distributedReviews);
  const blockNums = blockNumberMap(programme.spineItems);
  const itemById = new Map(programme.spineItems.map((i) => [i.id, i]));

  const primaryByCode = new Map<string, BlockKsbMapping[]>();
  for (const m of mappings) {
    if (!m.isPrimary) continue;
    const code = m.ksbCode.toUpperCase();
    const list = primaryByCode.get(code) ?? [];
    list.push(m);
    primaryByCode.set(code, list);
  }

  const duplicatePrimaryCodes: string[] = [];
  const nonBlockPrimaryCodes: string[] = [];
  const approvedPrimaries: ApprovedPrimaryRow[] = [];

  for (const [code, list] of primaryByCode) {
    if (list.length !== 1) {
      duplicatePrimaryCodes.push(code);
      continue;
    }
    const m = list[0];
    const item = itemById.get(m.blockId);
    if (!item || item.itemType !== "block") {
      nonBlockPrimaryCodes.push(code);
      continue;
    }
    approvedPrimaries.push({
      ksbCode: code,
      blockId: m.blockId,
      blockNumber: blockNums.get(m.blockId) ?? null,
      blockTitle: item.title,
      learningIntent: m.learningIntent,
      curriculumValue: m.curriculumValue,
    });
  }
  approvedPrimaries.sort((a, b) => compareKsbCode(a.ksbCode, b.ksbCode));
  duplicatePrimaryCodes.sort(compareKsbCode);
  nonBlockPrimaryCodes.sort(compareKsbCode);

  const approvedSet = new Set(approvedPrimaries.map((r) => r.ksbCode));

  const gatewayEpaMappingCount = mappings.filter((m) => {
    const t = itemById.get(m.blockId)?.itemType;
    return t === "gateway" || t === "epa";
  }).length;

  const reviewedGapCodes: string[] = [];
  const distributedSkillCodes: string[] = [];
  const notYetResolvedCodes: string[] = [];
  const bucketByCode: Record<string, KsbCoverageBucket> = {};

  for (const ksb of official.ksbs) {
    const code = ksb.code.toUpperCase();
    if (approvedSet.has(code)) {
      bucketByCode[code] = "approved_primary";
      continue;
    }
    // Prefer gap over distributed if both listed (should not happen).
    if (gapCodes.has(code)) {
      bucketByCode[code] = "reviewed_gap";
      reviewedGapCodes.push(code);
      continue;
    }
    if (distributedCodes.has(code)) {
      bucketByCode[code] = "distributed_skill_review";
      distributedSkillCodes.push(code);
      continue;
    }
    bucketByCode[code] = "not_yet_resolved";
    notYetResolvedCodes.push(code);
  }
  reviewedGapCodes.sort(compareKsbCode);
  distributedSkillCodes.sort(compareKsbCode);
  notYetResolvedCodes.sort(compareKsbCode);

  const publicationBlocked =
    coverage.withPrimary < coverage.required ||
    duplicatePrimaryCodes.length > 0 ||
    nonBlockPrimaryCodes.length > 0;

  const publicationBlockReason = publicationBlocked
    ? `${coverage.withPrimary} / ${coverage.required} official KSBs have an approved Primary. Publication is blocked until every required KSB has exactly one approved Primary teaching location (${reviewedGapCodes.length} reviewed gaps; ${distributedSkillCodes.length} distributed-skill ownership reviews; ${notYetResolvedCodes.length} unresolved).`
    : "All official KSBs have an approved Primary.";

  return {
    officialRequired: coverage.required,
    approvedPrimaryCount: approvedPrimaries.length,
    reviewedGapCount: reviewedGapCodes.length,
    distributedSkillCount: distributedSkillCodes.length,
    notYetResolvedCount: notYetResolvedCodes.length,
    missingPrimaryCount: coverage.missingPrimary.length,
    duplicatePrimaryCount: duplicatePrimaryCodes.length,
    nonBlockPrimaryCount: nonBlockPrimaryCodes.length,
    gatewayEpaMappingCount,
    publicationBlocked,
    publicationBlockReason,
    approvedPrimaries,
    reviewedGapCodes,
    distributedSkillCodes,
    notYetResolvedCodes,
    duplicatePrimaryCodes,
    nonBlockPrimaryCodes,
    bucketByCode,
    reviewedRegister: register,
    distributedSkillReviews: distributedReviews,
  };
}
