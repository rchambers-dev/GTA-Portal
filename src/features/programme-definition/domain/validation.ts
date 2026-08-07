import type {
  GtaProgrammeVersion,
  OfficialStandardVersion,
  ProgrammeDefinitionState,
  SpineItem,
} from "./types";
import { primaryMappingForKsb } from "./block-ksb-mappings";
import {
  curriculumFindingsToIssues,
  curriculumValidation,
} from "./curriculum-validation";
import { validateFormulaWeights } from "./rpl-formulas";

export type ProgrammeValidationIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  /** KSB codes implicated when relevant. */
  ksbCodes?: string[];
};

/**
 * Validation contexts — severity of some rules depends on lifecycle stage.
 * Curriculum quality findings are advisory in every context.
 */
export type ValidationContext = "draft" | "publish" | "lock";

export function summariseHours(programme: GtaProgrammeVersion): {
  structurePlannedOtjHours: number;
  blockCount: number;
  gatewayCount: number;
  hasEpa: boolean;
} {
  const structurePlannedOtjHours = programme.spineItems
    .filter((i) => i.countsTowardsLearningHours)
    .reduce((sum, i) => sum + (i.plannedOtjHours || 0), 0);
  return {
    structurePlannedOtjHours,
    blockCount: programme.spineItems.filter((i) => i.itemType === "block")
      .length,
    gatewayCount: programme.spineItems.filter((i) => i.itemType === "gateway")
      .length,
    hasEpa: programme.spineItems.some((i) => i.itemType === "epa"),
  };
}

/** Hours still needed vs Skills England minimum (from Jon’s structured OTJ). */
export function hoursDeficitAgainstMinimum(
  minimumComplianceHours: number | null | undefined,
  structurePlannedOtjHours: number,
): number | null {
  if (minimumComplianceHours == null) return null;
  return Math.max(
    0,
    Math.round((minimumComplianceHours - structurePlannedOtjHours) * 10) / 10,
  );
}

export function hoursSurplusAgainstMinimum(
  minimumComplianceHours: number | null | undefined,
  structurePlannedOtjHours: number,
): number | null {
  if (minimumComplianceHours == null) return null;
  return Math.max(
    0,
    Math.round((structurePlannedOtjHours - minimumComplianceHours) * 10) / 10,
  );
}

export type PublishChecklistGroup = {
  id: string;
  title: string;
  /** One-line staff instruction. */
  action: string;
  severity: "error" | "warning";
  count: number;
  /** Collapsed code chips when the group is KSB-centric. */
  ksbCodes: string[];
  /** Non-code messages (structure / hours / other). */
  messages: string[];
};

/** Group raw validation issues into an actionable publish checklist. */
export function buildPublishChecklist(
  issues: ProgrammeValidationIssue[],
): PublishChecklistGroup[] {
  const byCode = new Map<string, ProgrammeValidationIssue[]>();
  for (const issue of issues) {
    const list = byCode.get(issue.code) ?? [];
    list.push(issue);
    byCode.set(issue.code, list);
  }

  const groups: PublishChecklistGroup[] = [];

  function pushGroup(
    id: string,
    title: string,
    action: string,
    codes: string[],
    severityHint: "error" | "warning" = "error",
  ) {
    const items = codes.flatMap((c) => byCode.get(c) ?? []);
    if (!items.length) return;
    const ksbCodes = [
      ...new Set(items.flatMap((i) => i.ksbCodes ?? [])),
    ].sort(compareKsbCode);
    const messages = items
      .filter((i) => !i.ksbCodes?.length)
      .map((i) => i.message);
    const severity = items.some((i) => i.severity === "error")
      ? "error"
      : items.some((i) => i.severity === "warning")
        ? "warning"
        : severityHint;
    groups.push({
      id,
      title,
      action,
      severity,
      count: ksbCodes.length || items.length,
      ksbCodes,
      messages,
    });
    for (const c of codes) byCode.delete(c);
  }

  pushGroup(
    "structure",
    "Spine structure",
    "Add the missing spine pieces in Spine Builder.",
    ["spine_needs_block", "spine_needs_epa"],
  );
  pushGroup(
    "hours",
    "OTJ hours",
    "Raise planned structure OTJ hours to meet minimum compliance.",
    ["hours_below_minimum"],
  );
  pushGroup(
    "unassigned",
    "Assign KSBs to blocks",
    "Drag each code onto a block and confirm LearningIntent.",
    ["ksb_unassigned"],
  );
  pushGroup(
    "missing_primary",
    "Set a Primary block",
    "Open each mapping and tick “Make this the Primary block” (exactly one per KSB).",
    ["ksb_missing_primary"],
  );
  pushGroup(
    "multi_primary",
    "Fix duplicate primaries",
    "Keep only one Primary mapping per KSB.",
    ["ksb_multi_primary"],
  );
  pushGroup(
    "non_block",
    "Invalid mapping targets",
    "Remove mappings that are not on blocks.",
    ["ksb_mapped_to_non_block"],
  );
  pushGroup(
    "duplicate_pair",
    "Remove duplicate mappings",
    "A KSB should appear at most once on the same block.",
    ["ksb_duplicate_block"],
  );
  pushGroup(
    "formula_weights",
    "RPL formula weights",
    "Enabled K/S/B weights must sum to exactly 1.0 (not auto-adjusted).",
    ["formula_weights_invalid"],
  );

  // Remaining errors
  const leftoverErrors = [...byCode.entries()].flatMap(([, list]) =>
    list.filter((i) => i.severity === "error"),
  );
  if (leftoverErrors.length) {
    groups.push({
      id: "other_errors",
      title: "Other blockers",
      action: "Resolve these before publishing.",
      severity: "error",
      count: leftoverErrors.length,
      ksbCodes: [
        ...new Set(leftoverErrors.flatMap((i) => i.ksbCodes ?? [])),
      ].sort(compareKsbCode),
      messages: leftoverErrors
        .filter((i) => !i.ksbCodes?.length)
        .map((i) => i.message),
    });
  }

  pushGroup(
    "warn_assess",
    "Assess before introduce",
    "Check progression — usually INTRODUCE before ASSESS.",
    ["ksb_assess_before_introduce"],
    "warning",
  );
  pushGroup(
    "warn_multi_introduce",
    "Multiple INTRODUCE",
    "Review whether more than one INTRODUCE is intentional.",
    ["ksb_multi_introduce"],
    "warning",
  );
  pushGroup(
    "warn_repeat",
    "Repeated LearningIntent",
    "Same intent used many times — trim if it isn’t needed.",
    ["ksb_repeated_intent"],
    "warning",
  );
  pushGroup(
    "warn_dup",
    "Heavy KSB duplication",
    "KSB appears on many blocks — confirm that’s intended.",
    ["ksb_heavy_duplication"],
    "warning",
  );
  pushGroup(
    "warn_peer",
    "Above peer frequency",
    "Appears far more often than similar KSBs — confirm the learning journey needs it.",
    ["ksb_above_peer_frequency"],
    "warning",
  );
  pushGroup(
    "warn_other",
    "Other warnings",
    "Review when you can — these do not block publish.",
    ["apprenticeship_incomplete"],
    "warning",
  );

  const leftoverWarnings = [...byCode.entries()].flatMap(([, list]) =>
    list.filter((i) => i.severity === "warning"),
  );
  if (leftoverWarnings.length) {
    groups.push({
      id: "other_warnings",
      title: "Other warnings",
      action: "Review when you can — these do not block publish.",
      severity: "warning",
      count: leftoverWarnings.length,
      ksbCodes: [
        ...new Set(leftoverWarnings.flatMap((i) => i.ksbCodes ?? [])),
      ].sort(compareKsbCode),
      messages: leftoverWarnings
        .filter((i) => !i.ksbCodes?.length)
        .map((i) => i.message),
    });
  }

  return groups;
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

export function primaryCoverage(programme: GtaProgrammeVersion, official: OfficialStandardVersion): {
  required: number;
  withPrimary: number;
  missingPrimary: string[];
  multiPrimary: string[];
} {
  const mappings = programme.ksbMappings ?? [];
  const missingPrimary: string[] = [];
  const multiPrimary: string[] = [];
  let withPrimary = 0;

  for (const ksb of official.ksbs) {
    const code = ksb.code.toUpperCase();
    const primaries = mappings.filter(
      (m) => m.ksbCode.toUpperCase() === code && m.isPrimary,
    );
    if (primaries.length === 1) withPrimary += 1;
    else if (primaries.length === 0) missingPrimary.push(ksb.code);
    else multiPrimary.push(ksb.code);
  }

  return {
    required: official.ksbs.length,
    withPrimary,
    missingPrimary,
    multiPrimary,
  };
}

export function validateProgrammeDefinition(
  official: OfficialStandardVersion,
  programme: GtaProgrammeVersion,
  options?: { context?: ValidationContext; forPublish?: boolean },
): ProgrammeValidationIssue[] {
  // Compat: forPublish true → publish; false → draft; default draft.
  const context: ValidationContext =
    options?.context ??
    (options?.forPublish === true
      ? "publish"
      : options?.forPublish === false
        ? "draft"
        : "draft");
  const hardGate = context === "publish" || context === "lock";
  const issues: ProgrammeValidationIssue[] = [];
  const hours = summariseHours(programme);
  const mappings = programme.ksbMappings ?? [];
  const blockIds = new Set(
    programme.spineItems
      .filter((i) => i.itemType === "block")
      .map((i) => i.id),
  );

  if (hours.blockCount < 1) {
    issues.push({
      code: "spine_needs_block",
      severity: "error",
      message: "Spine needs at least one block.",
    });
  }
  if (!hours.hasEpa) {
    issues.push({
      code: "spine_needs_epa",
      severity: "error",
      message: "Spine needs an EPA stage.",
    });
  }

  for (const m of mappings) {
    if (!blockIds.has(m.blockId)) {
      issues.push({
        code: "ksb_mapped_to_non_block",
        severity: "error",
        message: `${m.ksbCode} is mapped to a non-block spine item — KSBs may only sit on blocks.`,
        ksbCodes: [m.ksbCode],
      });
    }
  }

  const assigned = new Set(mappings.map((m) => m.ksbCode.toUpperCase()));

  const unassigned: string[] = [];
  for (const ksb of official.ksbs) {
    if (!assigned.has(ksb.code.toUpperCase())) {
      unassigned.push(ksb.code);
      issues.push({
        code: "ksb_unassigned",
        severity: "error",
        message: `${ksb.code} is not assigned to any block.`,
        ksbCodes: [ksb.code],
      });
    }
  }

  const seenPair = new Set<string>();
  for (const m of mappings) {
    const key = `${m.blockId}::${m.ksbCode.toUpperCase()}`;
    if (seenPair.has(key)) {
      issues.push({
        code: "ksb_duplicate_block",
        severity: "error",
        message: `${m.ksbCode} is mapped more than once to the same block.`,
        ksbCodes: [m.ksbCode],
      });
    }
    seenPair.add(key);
  }

  const coverage = primaryCoverage(programme, official);

  // Missing primary: soft in draft; blocker at publish/lock.
  // Unassigned KSBs are already errors — only flag missing primary on mapped codes.
  for (const code of coverage.missingPrimary) {
    if (!assigned.has(code.toUpperCase())) continue;
    issues.push({
      code: "ksb_missing_primary",
      severity: hardGate ? "error" : "warning",
      message: hardGate
        ? `${code} has no primary block.`
        : `${code} has no primary block yet (required before publish).`,
      ksbCodes: [code],
    });
  }
  // Multi-primary is always an immediate error in every context.
  for (const code of coverage.multiPrimary) {
    issues.push({
      code: "ksb_multi_primary",
      severity: "error",
      message: `${code} has more than one primary block.`,
      ksbCodes: [code],
    });
  }

  if (
    official.minimumComplianceHours != null &&
    hours.structurePlannedOtjHours + 0.001 < official.minimumComplianceHours
  ) {
    issues.push({
      code: "hours_below_minimum",
      severity: "error",
      message: `Planned structure hours (${hours.structurePlannedOtjHours}) are below minimum compliance hours (${official.minimumComplianceHours}).`,
    });
  }

  const formulaCheck = validateFormulaWeights(programme.parameters);
  if (!formulaCheck.ok) {
    issues.push({
      code: "formula_weights_invalid",
      severity: hardGate ? "error" : "warning",
      message: formulaCheck.message,
    });
  }

  if (!official.apprenticeshipDetailsComplete) {
    issues.push({
      code: "apprenticeship_incomplete",
      severity: "warning",
      message:
        "Apprenticeship product details (funding / hours / duration) were not fully imported.",
    });
  }

  // Curriculum quality (always advisory — never publish blockers).
  issues.push(
    ...curriculumFindingsToIssues(
      curriculumValidation.validate(programme, official),
    ),
  );

  void unassigned;
  return issues;
}

export function emptyState(): ProgrammeDefinitionState {
  return {
    version: 5,
    officialVersions: [],
    programmes: [],
    selectedProgrammeId: null,
    activityLog: [],
    apiPingByStandard: {},
  };
}

/** Structural edits blocked once apprentices are on this programme version. */
export function isStructureLocked(programme: GtaProgrammeVersion): boolean {
  return (
    programme.hasEnrolledApprentices ||
    programme.status === "superseded" ||
    programme.status === "archived"
  );
}

export function findOfficial(
  state: ProgrammeDefinitionState,
  id: string,
): OfficialStandardVersion | undefined {
  return state.officialVersions.find((v) => v.id === id);
}

export function findProgramme(
  state: ProgrammeDefinitionState,
  id: string,
): GtaProgrammeVersion | undefined {
  return state.programmes.find((p) => p.id === id);
}

/** @deprecated Prefer createBlockKsbMapping — kept for any leftover call sites. */
export function toggleKsbOnBlock(
  items: SpineItem[],
  _spineItemId: string,
  _ksbCode: string,
): SpineItem[] {
  return items;
}

export { primaryMappingForKsb };
