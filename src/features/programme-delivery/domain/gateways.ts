/**
 * Autocare gateway / EPA milestones — mirrors MBB `gateways` table.
 * Separate from training blocks: Block 11 is consolidation; Block 12 holds EPA tasks.
 *
 * MBB seed (standard_id Autocare):
 *   Gateway 1 — after block 5 / +12 months
 *   Gateway 2 — after block 10 / +24 months
 *   EPA — after block 12 / +25 months
 */

import { AUTOCARE_BLOCKS } from "./autocare-blocks";
import { cohortDateForProgrammeWeek } from "./rpl-funding-calc";

export type GatewayMilestoneKind = "gateway" | "epa";

export type GatewayMilestoneDef = {
  id: string;
  /** Matches MBB gw_id. */
  gwId: 1 | 2 | 3;
  name: string;
  description: string;
  kind: GatewayMilestoneKind;
  /** Schedule after this training/EPA block ends (MBB gw_start_after_block). */
  startAfterBlockId: number;
  /** Fallback / primary calendar offset from cohort start (MBB gw_months_from_start). */
  monthsFromStart: number;
};

export const AUTOCARE_GATEWAYS: GatewayMilestoneDef[] = [
  {
    id: "gw-1",
    gwId: 1,
    name: "Gateway 1",
    description: "Initial Assessment Gateway — mid-programme review before Year 2.",
    kind: "gateway",
    startAfterBlockId: 5,
    monthsFromStart: 12,
  },
  {
    id: "gw-2",
    gwId: 2,
    name: "Gateway 2",
    description:
      "Mid-Programme Review Gateway — final gateway assessments before EPA.",
    kind: "gateway",
    startAfterBlockId: 10,
    monthsFromStart: 24,
  },
  {
    id: "gw-epa",
    gwId: 3,
    name: "EPA",
    description: "End Point Assessment (EPA).",
    kind: "epa",
    startAfterBlockId: 12,
    monthsFromStart: 25,
  },
];

/** Add calendar months to an ISO date (UTC noon), return YYYY-MM-DD. */
export function addMonthsIso(startIso: string, months: number): string {
  const d = new Date(`${startIso}T12:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Due date for a gateway milestone.
 * Prefer end of the anchor block week window; fall back to start + N months;
 * for EPA, prefer cohort delivery end when provided.
 */
export function gatewayMilestoneDueIso(args: {
  milestone: GatewayMilestoneDef;
  cohortStartIso: string;
  deliveryEndIso?: string | null;
}): string | null {
  const { milestone, cohortStartIso, deliveryEndIso } = args;

  if (milestone.kind === "epa" && deliveryEndIso) {
    return deliveryEndIso;
  }

  const anchor = AUTOCARE_BLOCKS.find((b) => b.id === milestone.startAfterBlockId);
  if (anchor?.weekEnd != null) {
    return cohortDateForProgrammeWeek(cohortStartIso, anchor.weekEnd);
  }

  if (cohortStartIso) {
    return addMonthsIso(cohortStartIso, milestone.monthsFromStart);
  }

  return null;
}

export function gatewayMilestoneAnchorLabel(
  milestone: GatewayMilestoneDef,
): string {
  if (milestone.kind === "epa") {
    return "cohort delivery end";
  }
  return `after Block ${milestone.startAfterBlockId} · ~${milestone.monthsFromStart} months`;
}
