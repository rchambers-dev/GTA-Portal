/**
 * Groups-spine progression / BRAG engine.
 *
 * Separate from the Autocare blocks week engine in `progression-status.ts`.
 * Dating comes from MV personal-tracking month brackets on pack milestones;
 * completion comes from CEA mandatory sign-off (and gateway reflections).
 */

import {
  groupMandatoryComplete,
  type CeaApprenticeState,
  type CeaGroupDef,
  type CeaMilestoneDef,
  type CeaPackDef,
} from "@/features/apprentice-portal/domain/cea";
import { groupsPhaseWindowDates } from "./programme-months";
import {
  calculateBlockProgressionBrag,
  calculateMilestoneStatus,
  rollUpProgressionBrag,
  type MilestoneStatus,
  type ProgressionBrag,
} from "./progression-status";

export type GroupCompletionSummary = {
  groupId: string;
  mandatoryRequired: number;
  mandatorySigned: number;
  complete: boolean;
  completedAt: string | null;
};

export type GroupsUnitBragRow = {
  group: CeaGroupDef;
  milestone: CeaMilestoneDef;
  summary: GroupCompletionSummary;
  window: { startIso: string; endIso: string } | null;
  brag: ProgressionBrag | null;
  courseWeightPercent: number;
};

export type GroupsMilestoneBragRow = {
  milestone: CeaMilestoneDef;
  window: { startIso: string; endIso: string } | null;
  complete: boolean;
  status: MilestoneStatus;
  courseWeightPercent: number;
};

export type GroupsProgressTotals = {
  actualPercent: number;
  plannedPercent: number;
  behindPlan: boolean;
  gapPercent: number;
};

export type GroupsBragBoard = {
  trainingRows: GroupsUnitBragRow[];
  milestoneRows: GroupsMilestoneBragRow[];
  overall: ProgressionBrag | null;
  progress: GroupsProgressTotals;
};

function todayIso(asOfIso?: string): string {
  return asOfIso ?? new Date().toISOString().slice(0, 10);
}

export function summariseGroupCompletion(
  group: CeaGroupDef,
  state: CeaApprenticeState,
): GroupCompletionSummary {
  const allocated = state.mandatoryByGroup[group.id] ?? [];
  let mandatorySigned = 0;
  let completedAt: string | null = null;

  for (const id of allocated) {
    const p = state.progress[id];
    if (p?.status === "signed_off") {
      mandatorySigned += 1;
      const stamp = p.signedOffAt;
      if (stamp && (!completedAt || stamp > completedAt)) completedAt = stamp;
    }
  }

  const complete = groupMandatoryComplete(group, state);
  return {
    groupId: group.id,
    mandatoryRequired: group.mandatoryRequired,
    mandatorySigned,
    complete,
    completedAt: complete ? completedAt : null,
  };
}

/** Gateway / EPA complete when tutor accepts the milestone reflection. */
export function isGroupsGatewayComplete(
  milestoneId: string,
  state: CeaApprenticeState,
): boolean {
  return state.milestoneReflections[milestoneId]?.status === "accepted";
}

function daysBetween(startIso: string, endIso: string): number {
  const a = new Date(`${startIso}T12:00:00.000Z`).getTime();
  const b = new Date(`${endIso}T12:00:00.000Z`).getTime();
  return Math.max(1, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}

/**
 * Resolve course weights: prefer sheet `courseWeightPercent`, else equal share
 * across groups + gateway/EPA milestones that participate in progress.
 */
export function resolveGroupsCourseWeights(pack: CeaPackDef): {
  groupWeights: Map<string, number>;
  milestoneWeights: Map<string, number>;
  total: number;
} {
  const groupWeights = new Map<string, number>();
  const milestoneWeights = new Map<string, number>();

  let declared = 0;
  let undeclaredSlots = 0;

  for (const g of pack.groups) {
    if (g.courseWeightPercent != null && g.courseWeightPercent > 0) {
      groupWeights.set(g.id, g.courseWeightPercent);
      declared += g.courseWeightPercent;
    } else {
      undeclaredSlots += 1;
    }
  }

  for (const m of pack.milestones) {
    if (m.kind !== "gateway" && m.kind !== "epa") continue;
    if (m.courseWeightPercent != null && m.courseWeightPercent > 0) {
      milestoneWeights.set(m.id, m.courseWeightPercent);
      declared += m.courseWeightPercent;
    } else {
      undeclaredSlots += 1;
    }
  }

  if (undeclaredSlots > 0) {
    const remainder = Math.max(0, 100 - declared);
    const each = remainder / undeclaredSlots;
    for (const g of pack.groups) {
      if (!groupWeights.has(g.id)) groupWeights.set(g.id, each);
    }
    for (const m of pack.milestones) {
      if (m.kind !== "gateway" && m.kind !== "epa") continue;
      if (!milestoneWeights.has(m.id)) milestoneWeights.set(m.id, each);
    }
  }

  const total =
    [...groupWeights.values()].reduce((s, n) => s + n, 0) +
    [...milestoneWeights.values()].reduce((s, n) => s + n, 0);

  return { groupWeights, milestoneWeights, total: total > 0 ? total : 100 };
}

function plannedShareForWindow(
  weight: number,
  window: { startIso: string; endIso: string } | null,
  asOfIso: string,
): number {
  if (!window || weight <= 0) return 0;
  if (asOfIso >= window.endIso) return weight;
  if (asOfIso < window.startIso) return 0;
  const total = daysBetween(window.startIso, window.endIso);
  const elapsed = daysBetween(window.startIso, asOfIso);
  return weight * Math.min(1, elapsed / total);
}

export function calculateGroupsProgress(input: {
  pack: CeaPackDef;
  state: CeaApprenticeState;
  programmeStartIso: string;
  asOfIso?: string;
}): GroupsProgressTotals {
  const asOf = todayIso(input.asOfIso);
  const { groupWeights, milestoneWeights, total } = resolveGroupsCourseWeights(
    input.pack,
  );
  const byId = new Map(input.pack.milestones.map((m) => [m.id, m]));

  let actual = 0;
  let planned = 0;

  for (const group of input.pack.groups) {
    const weight = groupWeights.get(group.id) ?? 0;
    const milestone = byId.get(group.milestoneId);
    const window = groupsPhaseWindowDates({
      programmeStartIso: input.programmeStartIso,
      monthStart: milestone?.monthStart ?? null,
      monthEnd: milestone?.monthEnd ?? null,
    });
    if (summariseGroupCompletion(group, input.state).complete) {
      actual += weight;
    }
    planned += plannedShareForWindow(weight, window, asOf);
  }

  for (const milestone of input.pack.milestones) {
    if (milestone.kind !== "gateway" && milestone.kind !== "epa") continue;
    const weight = milestoneWeights.get(milestone.id) ?? 0;
    const window = groupsPhaseWindowDates({
      programmeStartIso: input.programmeStartIso,
      monthStart: milestone.monthStart,
      monthEnd: milestone.monthEnd,
    });
    if (isGroupsGatewayComplete(milestone.id, input.state)) {
      actual += weight;
    }
    planned += plannedShareForWindow(weight, window, asOf);
  }

  const actualPercent = Math.round((actual / total) * 100);
  const plannedPercent = Math.round((planned / total) * 100);
  const gapPercent = Math.max(0, plannedPercent - actualPercent);
  return {
    actualPercent: Math.min(100, actualPercent),
    plannedPercent: Math.min(100, plannedPercent),
    behindPlan: actualPercent < plannedPercent,
    gapPercent,
  };
}

/**
 * Build the management / progress board for a groups-spine apprentice.
 * Training rows = CEA groups (BRAG). Milestone rows = gateway / EPA (RAG).
 */
export function buildGroupsBragBoard(input: {
  pack: CeaPackDef;
  state: CeaApprenticeState;
  programmeStartIso: string;
  asOfIso?: string;
}): GroupsBragBoard {
  const asOf = todayIso(input.asOfIso);
  const { groupWeights, milestoneWeights } = resolveGroupsCourseWeights(
    input.pack,
  );
  const byId = new Map(input.pack.milestones.map((m) => [m.id, m]));

  const trainingRows: GroupsUnitBragRow[] = [];
  for (const group of input.pack.groups) {
    const milestone = byId.get(group.milestoneId);
    if (!milestone || milestone.kind !== "groups_phase") continue;

    const window = groupsPhaseWindowDates({
      programmeStartIso: input.programmeStartIso,
      monthStart: milestone.monthStart,
      monthEnd: milestone.monthEnd,
    });
    const summary = summariseGroupCompletion(group, input.state);
    const brag = calculateBlockProgressionBrag({
      windowStartIso: window?.startIso ?? null,
      windowEndIso: window?.endIso ?? null,
      complete: summary.complete,
      completedAtIso: summary.completedAt,
      asOfIso: asOf,
    });

    trainingRows.push({
      group,
      milestone,
      summary,
      window,
      brag,
      courseWeightPercent: groupWeights.get(group.id) ?? 0,
    });
  }

  trainingRows.sort((a, b) => {
    const ms = a.milestone.sortOrder - b.milestone.sortOrder;
    if (ms !== 0) return ms;
    return a.group.number - b.group.number;
  });

  const milestoneRows: GroupsMilestoneBragRow[] = [];
  for (const milestone of input.pack.milestones) {
    if (milestone.kind !== "gateway" && milestone.kind !== "epa") continue;
    const window = groupsPhaseWindowDates({
      programmeStartIso: input.programmeStartIso,
      monthStart: milestone.monthStart,
      monthEnd: milestone.monthEnd,
    });
    const complete = isGroupsGatewayComplete(milestone.id, input.state);
    const status = calculateMilestoneStatus({
      kind: milestone.kind === "epa" ? "epa" : "gateway",
      complete,
      dueIso: window?.endIso ?? null,
      asOfIso: asOf,
    });
    milestoneRows.push({
      milestone,
      window,
      complete,
      status,
      courseWeightPercent: milestoneWeights.get(milestone.id) ?? 0,
    });
  }

  milestoneRows.sort((a, b) => a.milestone.sortOrder - b.milestone.sortOrder);

  const overall = rollUpProgressionBrag(
    trainingRows.map((row) => ({
      brag: row.brag,
      windowEndIso: row.window?.endIso ?? null,
      complete: row.summary.complete,
    })),
    asOf,
  );

  return {
    trainingRows,
    milestoneRows,
    overall,
    progress: calculateGroupsProgress(input),
  };
}
