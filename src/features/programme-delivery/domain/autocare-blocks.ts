/**
 * Autocare Technician L2 — programme block masters (ST0499).
 * Source: GTA SOW Design and RPL Adjustment Guide v1.4 Portal Logic.
 *
 * Weeks are the primary calendar measure. Months are display-only.
 * Published OTJ minimum is 605 hrs; planned OTJ has headroom (no maximum).
 */

export const AUTOCARE_STANDARD = {
  code: "ST0499",
  /** Newest version for new starts — do not put new learners on older versions. */
  version: "v1.3",
  label: "Autocare Technician (Level 2)",
  fundingBandGbp: 13000,
  publishedMinOtjHours: 605,
  plannedOtjHours: 611.5,
  /** Fixed headroom on programme master; revise only when standard version changes. */
  otjHeadroomHours: 6.5,
  deliveryWeeks: 113,
  practicalEndWeek: 113,
} as const;

export type ProgrammeBlockKind = "training" | "gateway" | "epa";

export type ProgrammeBlockDef = {
  id: number;
  name: string;
  kind: ProgrammeBlockKind;
  /** Inclusive week range (primary measure). */
  weekStart: number | null;
  weekEnd: number | null;
  plannedOtjHours: number;
  plannedNonOtjHours: number;
  /** Display hint only — weeks are authoritative. */
  monthHint: string | null;
};

/** Blocks 1–10 training; 11 gateway; 12 EPA (dates only, 0 OTJ). */
export const AUTOCARE_BLOCKS: ProgrammeBlockDef[] = [
  {
    id: 1,
    name: "Motor Vehicle Foundation Skills (shared)",
    kind: "training",
    weekStart: 1,
    weekEnd: 10,
    plannedOtjHours: 45,
    plannedNonOtjHours: 15,
    monthHint: "Months 1–3",
  },
  {
    id: 2,
    name: "Vehicle Inspection, Servicing & Customer Interaction",
    kind: "training",
    weekStart: 11,
    weekEnd: 20,
    plannedOtjHours: 55,
    plannedNonOtjHours: 5,
    monthHint: "Months 3–5",
  },
  {
    id: 3,
    name: "Workshop Processes, Tools & Environmental Awareness",
    kind: "training",
    weekStart: 21,
    weekEnd: 30,
    plannedOtjHours: 55,
    plannedNonOtjHours: 5,
    monthHint: "Months 5–8",
  },
  {
    id: 4,
    name: "Emerging Technology & Driveline Systems",
    kind: "training",
    weekStart: 31,
    weekEnd: 40,
    plannedOtjHours: 55,
    plannedNonOtjHours: 5,
    monthHint: "Months 8–10",
  },
  {
    id: 5,
    name: "Diagnostic Thinking & Complex Repair",
    kind: "training",
    weekStart: 41,
    weekEnd: 50,
    plannedOtjHours: 55,
    plannedNonOtjHours: 5,
    monthHint: "Months 10–13",
  },
  {
    id: 6,
    name: "Vehicle Systems Integration & Advanced Diagnostics",
    kind: "training",
    weekStart: 51,
    weekEnd: 60,
    plannedOtjHours: 55,
    plannedNonOtjHours: 5,
    monthHint: "Months 13–15",
  },
  {
    id: 7,
    name: "Advanced Workshop Practice & Technical Communication",
    kind: "training",
    weekStart: 61,
    weekEnd: 70,
    plannedOtjHours: 55,
    plannedNonOtjHours: 5,
    monthHint: "Months 15–18",
  },
  {
    id: 8,
    name: "Advanced Diagnostics & Workshop Organisation",
    kind: "training",
    weekStart: 71,
    weekEnd: 80,
    plannedOtjHours: 55,
    plannedNonOtjHours: 5,
    monthHint: "Months 18–20",
  },
  {
    id: 9,
    name: "Emerging Tech, EV & Hydrogen Awareness",
    kind: "training",
    weekStart: 81,
    weekEnd: 94,
    plannedOtjHours: 77,
    plannedNonOtjHours: 7,
    monthHint: "Months 20–24",
  },
  {
    id: 10,
    name: "Final Consolidation, Corrective Learning & EPA Readiness",
    kind: "training",
    weekStart: 95,
    weekEnd: 113,
    plannedOtjHours: 104.5,
    plannedNonOtjHours: 9.5,
    monthHint: "Months 24–29",
  },
  {
    id: 11,
    name: "Gateway Readiness",
    kind: "gateway",
    weekStart: null,
    weekEnd: null,
    plannedOtjHours: 0,
    plannedNonOtjHours: 0,
    monthHint: "Within programme duration",
  },
  {
    id: 12,
    name: "End-Point Assessment",
    kind: "epa",
    weekStart: null,
    weekEnd: null,
    plannedOtjHours: 0,
    plannedNonOtjHours: 0,
    monthHint: "Assessment only — dates tracked, not OTJ",
  },
];

export function blockById(id: number): ProgrammeBlockDef | undefined {
  return AUTOCARE_BLOCKS.find((b) => b.id === id);
}
