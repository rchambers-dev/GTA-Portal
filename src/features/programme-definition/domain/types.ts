/** Programme definition domain types — Skills England lock + GTA spine. */

import type { FixedCostLineItem } from "./rpl-formulas/tnp1";

export type { FixedCostLineItem };

export type KsbType = "knowledge" | "skill" | "behaviour";

export type SpineItemType = "block" | "gateway" | "epa" | "milestone" | "break";

export type ProgrammeVersionStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "published"
  | "superseded"
  | "archived";

/**
 * How a KSB is used educationally in a specific block.
 *
 * ASSESS means learning for this KSB is being checked / evidenced within
 * this teaching block — not that the spine item owns a separately scheduled
 * formal exam (EPA / gateway remain their own spine types).
 */
export type LearningIntent =
  | "introduce"
  | "practise"
  | "apply"
  | "reinforce"
  | "consolidate"
  | "assess";

export const LEARNING_INTENTS: LearningIntent[] = [
  "introduce",
  "practise",
  "apply",
  "reinforce",
  "consolidate",
  "assess",
];

export const LEARNING_INTENT_LABELS: Record<LearningIntent, string> = {
  introduce: "INTRODUCE",
  practise: "PRACTISE",
  apply: "APPLY",
  reinforce: "REINFORCE",
  consolidate: "CONSOLIDATE",
  assess: "ASSESS",
};

/** Who ultimately created / confirmed the mapping row. */
export type MappingSource = "manual" | "ai_suggested" | "imported";

/** What helped staff choose LearningIntent (orthogonal to mappingSource). */
export type RecommendationProvider = "portal_ai" | "heuristic";

/**
 * One Block ↔ KSB relationship.
 * - isPrimary: curriculum ownership / uniqueness (not financial)
 * - learningIntent: pedagogical role
 * - curriculumValue: contribution of THIS occurrence to THIS block's value
 * Only `itemType === "block"` spine items may be targets.
 */
export type BlockKsbMapping = {
  id: string;
  blockId: string;
  ksbCode: string;
  isPrimary: boolean;
  learningIntent: LearningIntent;
  /**
   * Contribution of this Block↔KSB occurrence to block curriculum value.
   * Must be finite and > 0. Default 1.0. Not official SE metadata.
   */
  curriculumValue: number;
  mappingSource: MappingSource;
  /** Suggestion engine that last helped (kept even if staff overrode). */
  recommendationProvider: RecommendationProvider | null;
  /** e.g. programme.recommend_ksb_intent@1 */
  recommendationFeature: string | null;
  /** Intent the recommender suggested (may differ from learningIntent). */
  recommendedIntent: LearningIntent | null;
  /** True when staff kept recommendedIntent as learningIntent. */
  recommendationAccepted: boolean | null;
  confidence: number | null;
  aiReasonSummary: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ImportedDuty = {
  code: string;
  description: string;
  mappedKsbCodes: string[];
};

export type ImportedKsb = {
  code: string;
  type: KsbType;
  description: string;
};

export type ImportedProduct = {
  code: string;
  name: string;
  type: string;
  level?: number;
  status?: string;
};

export type OfficialStandardVersion = {
  id: string;
  standardCode: string;
  occupationCode: string;
  title: string;
  externalVersion: string;
  level: number;
  status: string;
  typicalDurationMonths: number | null;
  assessmentPeriodMonths: number | null;
  minimumComplianceHours: number | null;
  maximumFundingPounds: number | null;
  larsCode: number | null;
  route: string;
  pathway: string;
  cluster: string;
  assessmentPlanUrl: string;
  approvedForDeliveryDate: string | null;
  updatedDate: string | null;
  apprenticeshipDetailsComplete: boolean;
  duties: ImportedDuty[];
  ksbs: ImportedKsb[];
  linkedProducts: ImportedProduct[];
  occupationRawPayload: unknown;
  apprenticeshipRawPayload: unknown | null;
  sourceHash: string;
  importedAt: string;
  locked: true;
};

/**
 * Named RPL / APL calculator locked onto a programme version.
 * Add new keys when the maths changes — never silently rewrite behaviour
 * of an existing key (learners may already be enrolled against it).
 */
/**
 * Named RPL calculator locked onto a programme version.
 * - block_ksb_value_v1: curriculum values + VALUE_SHARE OTJ (current default)
 * - weighted_ksb_cap_v1: legacy Autocare weights + max % cap (frozen)
 */
export type RplFormulaKey = "block_ksb_value_v1" | "weighted_ksb_cap_v1";

export type RplFormulaStatus = "draft" | "published";

export type ProgrammeDeliveryParameters = {
  /**
   * Versioned programme expected OTJ hours used by VALUE_SHARE allocation.
   * Not hard-coded per standard — set per programme version.
   */
  expectedOtjHours: number | null;
  /** Which calculator to run when a learner’s prior learning is entered. */
  formulaKey: RplFormulaKey;
  /** Publish state for the RPL formula snapshot (separate from spine publish). */
  formulaStatus: RplFormulaStatus;
  /**
   * Legacy weighted_ksb_cap_v1 only: when false, letter omitted from factor.
   * Do not use for block_ksb_value_v1 — use includeRpl* instead.
   */
  includeAplK: boolean;
  includeAplS: boolean;
  includeAplB: boolean;
  /**
   * Legacy weighted_ksb_cap_v1 only: weights on K/S/B prior-learning %.
   * Enabled letters must sum to 1.0. Unused by block_ksb_value_v1.
   */
  aplWeightK: number;
  aplWeightS: number;
  aplWeightB: number;
  /**
   * Legacy weighted_ksb_cap_v1 only: max APL deduction as fraction of block OTJ.
   * Unused by block_ksb_value_v1 (no cap).
   */
  aplMaxFraction: number;
  /**
   * block_ksb_value_v1 only: whether this KSB category may contribute recognised
   * curriculum value via learner RPL. OFF keeps mappings/curriculum intact but
   * forces recognised value for that dimension to 0. Defaults true.
   * Independent of legacy includeApl*.
   */
  includeRplKnowledge: boolean;
  includeRplSkills: boolean;
  includeRplBehaviours: boolean;
  /**
   * Programme / negotiated funding base (GBP). Versioned config.
   * Used by Phase 2 TNP1: band − fixed = variable pot.
   */
  fundingBandPounds: number | null;
  /**
   * Editable fixed-cost line items for this programme version.
   * fixedCostTotal is DERIVED (sum of enabled lines) — never typed separately.
   */
  fixedCostLines: FixedCostLineItem[];
  /** Optional staff notes (evidence rules, local policy, etc.). */
  rplNotes: string;
};

export type SpineItem = {
  id: string;
  itemType: SpineItemType;
  /** UI always shows "Gateway"; this is for distinction if needed. */
  gatewayType: "internal" | "official" | null;
  title: string;
  sequence: number;
  plannedWeeks: number | null;
  plannedOtjHours: number;
  countsTowardsLearningHours: boolean;
  metadata: Record<string, unknown>;
};

export type GtaProgrammeVersion = {
  id: string;
  programmeId: string;
  programmeTitle: string;
  standardVersionId: string;
  /** Skills England ST code — used to reopen the same draft without duplicates. */
  standardCode: string;
  /** Skills England external version string (e.g. "1.5"). */
  externalVersion: string;
  internalVersion: string;
  status: ProgrammeVersionStatus;
  spineItems: SpineItem[];
  /** Flat Block ↔ KSB mappings for this programme version. */
  ksbMappings: BlockKsbMapping[];
  /** Jon-owned delivery parameters (RPL formula, expected OTJ, etc.). */
  parameters: ProgrammeDeliveryParameters;
  /**
   * When true, structure/KSB/hours are locked (apprentices enrolled).
   */
  hasEnrolledApprentices: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProgrammeActivityKind =
  | "api_request"
  | "api_ok"
  | "api_error"
  | "new_version"
  | "official_cached"
  | "draft_reopened"
  | "programme_created"
  | "spine_saved"
  | "parameters_saved"
  | "formula_published"
  | "spine_published"
  | "title_saved"
  | "primary_moved"
  | "version_forked"
  | "ksb_curriculum_value_changed";

/** Append-only audit trail for Programme Builder (API + staff edits). */
export type ProgrammeActivityEntry = {
  id: string;
  at: string;
  kind: ProgrammeActivityKind;
  /** Human summary shown in the log. */
  summary: string;
  /** Who did it — multi-staff ready; defaults to this device until auth actor is wired. */
  actor: string;
  standardCode?: string;
  externalVersion?: string;
  programmeId?: string;
  /** Compact request/response set for operational checks. */
  detail?: Record<string, string | number | boolean | null>;
};

export type ApiPingScheduleEntry = {
  lastApiCallAt: string | null;
  nextPingAt: string;
};

export type ProgrammeDefinitionState = {
  version: 5;
  officialVersions: OfficialStandardVersion[];
  programmes: GtaProgrammeVersion[];
  selectedProgrammeId: string | null;
  activityLog: ProgrammeActivityEntry[];
  /** Per-standard schedule for the 6-hour Skills England freshness ping. */
  apiPingByStandard: Record<string, ApiPingScheduleEntry>;
};

/** Feature version stamped on recommendation provenance. */
export const KSB_INTENT_RECOMMENDATION_FEATURE =
  "programme.recommend_ksb_intent@1";
