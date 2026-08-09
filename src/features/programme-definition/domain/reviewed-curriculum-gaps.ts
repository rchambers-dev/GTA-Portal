/**
 * Human-reviewed curriculum gap register (advisory review evidence).
 *
 * NOT programme truth. Proposed Primaries listed here MUST NOT be counted as
 * approved coverage until explicitly human-approved and persisted to DB.
 *
 * Coverage numbers always come from Block↔KSB mappings in the programme version.
 */

export type ReviewedCurriculumGapGroup = {
  groupId: string;
  title: string;
  ksbs: string[];
  reason: string;
  /** Affected / natural host block numbers from review (not approved Primaries). */
  affectedBlocks: number[];
  proposedAmendment: {
    proposedPrimaryBlock: number;
    amendSessionWeek: number | null;
    status: "PROVISIONAL_AFTER_AMENDMENT_ONLY";
    note: string;
  };
};

export type ReviewedCurriculumGapRegister = {
  programmeVersionId: string;
  standardCode: string;
  title: string;
  statusNote: string;
  groups: ReviewedCurriculumGapGroup[];
};

/**
 * Distributed-skill / Primary-ownership exception.
 * Teaching evidence exists across multiple blocks, but the one-Primary model
 * has no single defensible owner for the complete official breadth.
 * Distinct from "no curriculum teaching" gaps.
 */
export type DistributedSkillOwnershipReview = {
  programmeVersionId: string;
  classification: "DISTRIBUTED_SKILL_PRIMARY_OWNERSHIP_REVIEW";
  ksbCode: string;
  title: string;
  reason: string;
  evidenceExistsAcrossBlocks: number[];
  statusNote: string;
};

/**
 * Autocare L2 rebuild — V1 golden baseline reviewed curriculum gaps.
 * Original SOW remains current curriculum truth; proposed amendments are advisory.
 */
export const AUTOCARE_ST0499_V1_REVIEWED_GAPS: ReviewedCurriculumGapRegister = {
  programmeVersionId: "231a8a32-d876-4312-a178-960d19dcf938",
  standardCode: "ST0499",
  title: "Autocare Technician v1.3 — reviewed curriculum gaps",
  statusNote:
    "18 KSBs across 13 groups remain without a defensible Primary on the current original SOW. AI Proposed Amendments are review evidence only.",
  groups: [
    {
      groupId: "role_industry_autonomy",
      title: "Industry context, technician role, autonomy & reporting",
      ksbs: ["K1"],
      reason:
        "No explicit teaching of automotive industry context, autocare technician role, limits of autonomy, or reporting channels.",
      affectedBlocks: [2],
      proposedAmendment: {
        proposedPrimaryBlock: 2,
        amendSessionWeek: 16,
        status: "PROVISIONAL_AFTER_AMENDMENT_ONLY",
        note: "Proposed W16 strengthen; does not count as coverage until approved and persisted.",
      },
    },
    {
      groupId: "edi_inclusive_workplace",
      title: "Equity, diversity, inclusion & inclusive workplace",
      ksbs: ["B5", "K31", "S20"],
      reason:
        "No defensible Primary teaching/application home for EDI principles, inclusive workplace behaviour, and EDI compliance.",
      affectedBlocks: [2],
      proposedAmendment: {
        proposedPrimaryBlock: 2,
        amendSessionWeek: 11,
        status: "PROVISIONAL_AFTER_AMENDMENT_ONLY",
        note: "Proposed W11 strengthen; advisory only.",
      },
    },
    {
      groupId: "workplace_instructions",
      title: "Workplace instructions (purpose and use)",
      ksbs: ["K7"],
      reason:
        "Workplace instructions are not taught as an explicit object of learning (purpose and use).",
      affectedBlocks: [3],
      proposedAmendment: {
        proposedPrimaryBlock: 3,
        amendSessionWeek: 26,
        status: "PROVISIONAL_AFTER_AMENDMENT_ONLY",
        note: "Proposed W26 strengthen; advisory only.",
      },
    },
    {
      groupId: "inspection_to_spec",
      title: "Safety inspection & routine maintenance to manufacturer data/schedules",
      ksbs: ["K2", "S7"],
      reason:
        "No explicit inspection-to-spec / manufacturer data & schedules teaching with matching practical evidence.",
      affectedBlocks: [2],
      proposedAmendment: {
        proposedPrimaryBlock: 2,
        amendSessionWeek: 16,
        status: "PROVISIONAL_AFTER_AMENDMENT_ONLY",
        note: "Proposed W16 strengthen; advisory only.",
      },
    },
    {
      groupId: "fluids_filtration",
      title: "Fluids & filtration (knowledge + skill)",
      ksbs: ["K20", "S25"],
      reason:
        "No explicit fluids AND filtration components/procedures practical; generic servicing/brakes must not be inferred.",
      affectedBlocks: [2],
      proposedAmendment: {
        proposedPrimaryBlock: 2,
        amendSessionWeek: 13,
        status: "PROVISIONAL_AFTER_AMENDMENT_ONLY",
        note: "Proposed W13 restructure; advisory only.",
      },
    },
    {
      groupId: "emissions_systems",
      title: "Emission control systems knowledge",
      ksbs: ["K13"],
      reason:
        "No dedicated emission-control systems teaching (purpose/function/location of key systems).",
      affectedBlocks: [5],
      proposedAmendment: {
        proposedPrimaryBlock: 5,
        amendSessionWeek: 43,
        status: "PROVISIONAL_AFTER_AMENDMENT_ONLY",
        note: "Proposed W43 strengthen; advisory only.",
      },
    },
    {
      groupId: "digital_gdpr_cyber",
      title: "Information & digital technology / GDPR / cyber",
      ksbs: ["K34", "S23"],
      reason:
        "No explicit digital systems + GDPR/cyber teaching; stock-security must never be used as evidence.",
      affectedBlocks: [5],
      proposedAmendment: {
        proposedPrimaryBlock: 5,
        amendSessionWeek: 45,
        status: "PROVISIONAL_AFTER_AMENDMENT_ONLY",
        note: "Proposed W45 strengthen; advisory only.",
      },
    },
    {
      groupId: "adas_autonomy_levels",
      title: "ADAS levels of autonomy (passive/active)",
      ksbs: ["K18"],
      reason:
        "Pre-calibration adjacency is insufficient; ADAS autonomy levels (passive vs active) are not taught.",
      affectedBlocks: [9],
      proposedAmendment: {
        proposedPrimaryBlock: 9,
        amendSessionWeek: 89,
        status: "PROVISIONAL_AFTER_AMENDMENT_ONLY",
        note: "Proposed W89 strengthen; advisory only.",
      },
    },
    {
      groupId: "hv_battery_soh",
      title: "HV battery / charger state-of-health testing",
      ksbs: ["S11"],
      reason:
        "No explicit HV battery/charger state-of-health practical (generic EV awareness/safety is not enough).",
      affectedBlocks: [6],
      proposedAmendment: {
        proposedPrimaryBlock: 6,
        amendSessionWeek: 54,
        status: "PROVISIONAL_AFTER_AMENDMENT_ONLY",
        note: "Proposed W54 strengthen; advisory only.",
      },
    },
    {
      groupId: "service_literature_manuals_warranties",
      title: "Service literature / owner's manuals / warranties",
      ksbs: ["K8"],
      reason:
        "No defensible combined teaching of vehicle service records, owner's manuals, and warranties. W10 is job-card/handover documentation only; W35 warranty evidence is partial and must not count as Primary.",
      affectedBlocks: [4, 1],
      proposedAmendment: {
        proposedPrimaryBlock: 4,
        amendSessionWeek: 35,
        status: "PROVISIONAL_AFTER_AMENDMENT_ONLY",
        note: "Prefer strengthening an existing documentation/service-information session; advisory only. Warranty-only W35 is partial evidence, not approved coverage.",
      },
    },
    {
      groupId: "tyre_remove_replace_balance",
      title: "Tyre remove / repair / replace / balance",
      ksbs: ["S9"],
      reason:
        "No Primary-eligible strip/remove/replace/balance practical. W64 is tyre/TPMS inspection integration; W14 is TPMS-only; W106 is late consolidation.",
      affectedBlocks: [7, 2, 10],
      proposedAmendment: {
        proposedPrimaryBlock: 7,
        amendSessionWeek: 64,
        status: "PROVISIONAL_AFTER_AMENDMENT_ONLY",
        note: "Proposed strengthen of tyre service practical to include strip/balance; advisory only.",
      },
    },
    {
      groupId: "steering_systems",
      title: "Steering systems knowledge",
      ksbs: ["K10"],
      reason:
        "No original session teaches steering systems (mechanical/hydraulic/EPAS) purpose/function/location for inspection/removal/replacement. Geometry/tyre-wear adjacency is insufficient.",
      affectedBlocks: [4],
      proposedAmendment: {
        proposedPrimaryBlock: 4,
        amendSessionWeek: 34,
        status: "PROVISIONAL_AFTER_AMENDMENT_ONLY",
        note: "Proposed remodel of adjacent session into steering-systems teaching; advisory only.",
      },
    },
    {
      groupId: "fca_pci_financial_compliance",
      title: "Customer sales financial compliance (FCA / PCI)",
      ksbs: ["K28"],
      reason:
        "No defensible original teaching of FCA / PCI financial-compliance requirements.",
      affectedBlocks: [8, 2],
      proposedAmendment: {
        proposedPrimaryBlock: 8,
        amendSessionWeek: 78,
        status: "PROVISIONAL_AFTER_AMENDMENT_ONLY",
        note: "Proposed add FCA/PCI content to commercial/quotation teaching; advisory only.",
      },
    },
  ],
};

/**
 * Autocare V1 — S10 distributed-skill / one-Primary ownership exception.
 * Not a "no teaching" gap. Remains publication-blocking without an approved Primary.
 */
export const AUTOCARE_ST0499_V1_DISTRIBUTED_SKILL_REVIEWS: DistributedSkillOwnershipReview[] =
  [
    {
      programmeVersionId: "231a8a32-d876-4312-a178-960d19dcf938",
      classification: "DISTRIBUTED_SKILL_PRIMARY_OWNERSHIP_REVIEW",
      ksbCode: "S10",
      title: "Multi-system inspect / remove / replace — Primary ownership",
      reason:
        "Official S10 breadth spans multiple vehicle systems. Original curriculum teaches aspects across several blocks, but no single defensible Primary owner exists for the complete official requirement under the one-Primary rule.",
      evidenceExistsAcrossBlocks: [2, 3, 4, 5, 6, 7, 10],
      statusNote:
        "Distributed-skill / Primary-ownership review. Teaching evidence exists; do not classify as 'no curriculum teaching'. Remains without approved Primary and blocks publication.",
    },
  ];

const REGISTERS: ReviewedCurriculumGapRegister[] = [
  AUTOCARE_ST0499_V1_REVIEWED_GAPS,
];

export function getReviewedCurriculumGapRegister(
  programmeVersionId: string,
): ReviewedCurriculumGapRegister | null {
  return (
    REGISTERS.find((r) => r.programmeVersionId === programmeVersionId) ?? null
  );
}

export function getDistributedSkillOwnershipReviews(
  programmeVersionId: string,
): DistributedSkillOwnershipReview[] {
  return AUTOCARE_ST0499_V1_DISTRIBUTED_SKILL_REVIEWS.filter(
    (r) => r.programmeVersionId === programmeVersionId,
  );
}

export function reviewedGapKsbCodes(
  register: ReviewedCurriculumGapRegister | null,
): Set<string> {
  const out = new Set<string>();
  if (!register) return out;
  for (const g of register.groups) {
    for (const code of g.ksbs) out.add(code.toUpperCase());
  }
  return out;
}

export function distributedSkillKsbCodes(
  reviews: DistributedSkillOwnershipReview[],
): Set<string> {
  return new Set(reviews.map((r) => r.ksbCode.toUpperCase()));
}
