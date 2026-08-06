/** Programme definition domain types — Skills England lock + GTA spine. */

export type KsbType = "knowledge" | "skill" | "behaviour";

export type SpineItemType = "block" | "gateway" | "epa" | "milestone" | "break";

export type ProgrammeVersionStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "published"
  | "superseded"
  | "archived";

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
export type RplFormulaKey = "weighted_ksb_cap_v1";

export type RplFormulaStatus = "draft" | "published";

export type ProgrammeDeliveryParameters = {
  /**
   * Jon’s intended total OTJ hours for this delivery
   * (“how long he thinks the course will be” in OTJ hours).
   */
  expectedOtjHours: number | null;
  /** Which calculator to run when a learner’s prior learning is entered. */
  formulaKey: RplFormulaKey;
  /** Publish state for the RPL formula snapshot (separate from spine publish). */
  formulaStatus: RplFormulaStatus;
  /**
   * When false, that letter is omitted from the factor (not used in the calc).
   * Defaults all true — staff can drop e.g. Behaviours for a programme.
   */
  includeAplK: boolean;
  includeAplS: boolean;
  includeAplB: boolean;
  /**
   * Weights on Knowledge / Skill / Behaviour prior-learning % scores.
   * Autocare ST0499 live defaults: 0.30 / 0.50 / 0.20 (sum to 1).
   * Ignored for any letter with includeApl* = false.
   */
  aplWeightK: number;
  aplWeightS: number;
  aplWeightB: number;
  /**
   * Cap on APL deduction as a fraction of block OTJ (0–1).
   * Autocare ST0499 default: 0.30 → at most 30% of the block can be deducted.
   */
  aplMaxFraction: number;
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
  /** Official KSB codes assigned at block level. */
  assignedKsbCodes: string[];
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
  /** Jon-owned delivery parameters (RPL formula, expected OTJ, etc.). */
  parameters: ProgrammeDeliveryParameters;
  /**
   * When true, structure/KSB/hours are locked (apprentices enrolled).
   * Soft wording edits may still be allowed later.
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
  | "title_saved";

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
  version: 4;
  officialVersions: OfficialStandardVersion[];
  programmes: GtaProgrammeVersion[];
  selectedProgrammeId: string | null;
  /** Newest-first activity for Official panel history. */
  activityLog: ProgrammeActivityEntry[];
  /** Per-standard last API call + next scheduled ping (6-hour cadence). */
  apiPingByStandard: Record<string, ApiPingScheduleEntry>;
};
