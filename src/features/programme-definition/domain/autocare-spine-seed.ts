/**
 * DEPRECATED — kept as offline reference only.
 * Programme Builder no longer seeds Autocare spines automatically.
 * Build spines manually in Spine Builder from an empty spine.
 *
 * Former Autocare (ST0499) layout from live portal / Jon's reference.
 * Weeks are fixed on the programme; dates come later from learner start.
 */

import type { SpineItem } from "./types";

function id(suffix: string): string {
  return `spine-st0499-${suffix}`;
}

/** User-confirmed Autocare layout (weeks + themes). */
export const AUTOCARE_SPINE_SEED: Omit<
  SpineItem,
  "assignedKsbCodes"
>[] = [
  {
    id: id("b01"),
    itemType: "block",
    gatewayType: null,
    title: "Motor Vehicle Foundation Skills - Shared Controlled Programme",
    sequence: 1,
    plannedWeeks: 8,
    plannedOtjHours: 45,
    countsTowardsLearningHours: true,
    metadata: { blockNumber: 1 },
  },
  {
    id: id("b02"),
    itemType: "block",
    gatewayType: null,
    title: "Vehicle Inspection, Servicing and Customer Interaction",
    sequence: 2,
    plannedWeeks: 11,
    plannedOtjHours: 55,
    countsTowardsLearningHours: true,
    metadata: { blockNumber: 2 },
  },
  {
    id: id("b03"),
    itemType: "block",
    gatewayType: null,
    title: "Workshop Processes, Tools and Environmental Awareness",
    sequence: 3,
    plannedWeeks: 11,
    plannedOtjHours: 55,
    countsTowardsLearningHours: true,
    metadata: { blockNumber: 3 },
  },
  {
    id: id("b04"),
    itemType: "block",
    gatewayType: null,
    title: "Emerging Technology and Driveline Systems",
    sequence: 4,
    plannedWeeks: 10,
    plannedOtjHours: 55,
    countsTowardsLearningHours: true,
    metadata: { blockNumber: 4 },
  },
  {
    id: id("b05"),
    itemType: "block",
    gatewayType: null,
    title: "Diagnostic Thinking and Complex Repair Activities",
    sequence: 5,
    plannedWeeks: 11,
    plannedOtjHours: 55,
    countsTowardsLearningHours: true,
    metadata: { blockNumber: 5 },
  },
  {
    id: id("gw1"),
    itemType: "gateway",
    gatewayType: "internal",
    title: "Gateway 1 — Initial Assessment Gateway",
    sequence: 6,
    plannedWeeks: null,
    plannedOtjHours: 0,
    countsTowardsLearningHours: false,
    metadata: { monthsFromStartHint: 12 },
  },
  {
    id: id("b06"),
    itemType: "block",
    gatewayType: null,
    title: "Vehicle Systems Integration and Advanced Diagnostics",
    sequence: 7,
    plannedWeeks: 10,
    plannedOtjHours: 55,
    countsTowardsLearningHours: true,
    metadata: { blockNumber: 6 },
  },
  {
    id: id("b07"),
    itemType: "block",
    gatewayType: null,
    title: "Advanced Workshop Practice and Technical Communication",
    sequence: 8,
    plannedWeeks: 11,
    plannedOtjHours: 55,
    countsTowardsLearningHours: true,
    metadata: { blockNumber: 7 },
  },
  {
    id: id("b08"),
    itemType: "block",
    gatewayType: null,
    title: "Advanced Diagnostics and Workshop Organisation",
    sequence: 9,
    plannedWeeks: 11,
    plannedOtjHours: 55,
    countsTowardsLearningHours: true,
    metadata: { blockNumber: 8 },
  },
  {
    id: id("b09"),
    itemType: "block",
    gatewayType: null,
    title: "Emerging Technologies, Electric Vehicles and Hydrogen Awareness",
    sequence: 10,
    plannedWeeks: 14,
    plannedOtjHours: 77,
    countsTowardsLearningHours: true,
    metadata: { blockNumber: 9 },
  },
  {
    id: id("b10"),
    itemType: "block",
    gatewayType: null,
    title: "Final Consolidation, Corrective Learning and EPA Readiness Training",
    sequence: 11,
    plannedWeeks: 20,
    plannedOtjHours: 104.5,
    countsTowardsLearningHours: true,
    metadata: { blockNumber: 10 },
  },
  {
    id: id("gw2"),
    itemType: "gateway",
    gatewayType: "internal",
    title: "Gateway 2 — Mid-Programme Review Gateway",
    sequence: 12,
    plannedWeeks: null,
    plannedOtjHours: 0,
    countsTowardsLearningHours: false,
    metadata: { monthsFromStartHint: 24 },
  },
  {
    id: id("b11"),
    itemType: "block",
    gatewayType: null,
    title: "Gateway Readiness and Confirmation",
    sequence: 13,
    plannedWeeks: 3,
    plannedOtjHours: 0,
    countsTowardsLearningHours: false,
    metadata: { blockNumber: 11 },
  },
  {
    id: id("epa"),
    itemType: "epa",
    gatewayType: null,
    title: "End-Point Assessment (EPA)",
    sequence: 14,
    plannedWeeks: 0,
    plannedOtjHours: 0,
    countsTowardsLearningHours: false,
    metadata: { blockNumber: 12, monthsFromStartHint: 25 },
  },
];

export function buildAutocareSpineItems(): SpineItem[] {
  return AUTOCARE_SPINE_SEED.map((item) => ({
    ...item,
    assignedKsbCodes: [],
  }));
}
