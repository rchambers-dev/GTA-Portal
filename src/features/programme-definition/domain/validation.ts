import type {
  GtaProgrammeVersion,
  OfficialStandardVersion,
  ProgrammeDefinitionState,
  SpineItem,
} from "./types";

export type ProgrammeValidationIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
};

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

export function validateProgrammeDefinition(
  official: OfficialStandardVersion,
  programme: GtaProgrammeVersion,
): ProgrammeValidationIssue[] {
  const issues: ProgrammeValidationIssue[] = [];
  const hours = summariseHours(programme);

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

  const assigned = new Set<string>();
  for (const item of programme.spineItems) {
    if (item.itemType !== "block") continue;
    for (const code of item.assignedKsbCodes) assigned.add(code.toUpperCase());
  }

  for (const ksb of official.ksbs) {
    if (!assigned.has(ksb.code.toUpperCase())) {
      issues.push({
        code: "ksb_unassigned",
        severity: "error",
        message: `${ksb.code} is not assigned to any block.`,
      });
    }
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

  if (!official.apprenticeshipDetailsComplete) {
    issues.push({
      code: "apprenticeship_incomplete",
      severity: "warning",
      message:
        "Apprenticeship product details (funding / hours / duration) were not fully imported.",
    });
  }

  return issues;
}

export function emptyState(): ProgrammeDefinitionState {
  return {
    version: 2,
    officialVersions: [],
    programmes: [],
    selectedProgrammeId: null,
  };
}

/** Structural edits blocked once apprentices are on this programme version. */
export function isStructureLocked(programme: GtaProgrammeVersion): boolean {
  return (
    programme.hasEnrolledApprentices ||
    programme.status === "published" ||
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

export function toggleKsbOnBlock(
  items: SpineItem[],
  spineItemId: string,
  ksbCode: string,
): SpineItem[] {
  const code = ksbCode.toUpperCase();
  return items.map((item) => {
    if (item.id !== spineItemId || item.itemType !== "block") return item;
    const has = item.assignedKsbCodes.some((c) => c.toUpperCase() === code);
    return {
      ...item,
      assignedKsbCodes: has
        ? item.assignedKsbCodes.filter((c) => c.toUpperCase() !== code)
        : [...item.assignedKsbCodes, code],
    };
  });
}
