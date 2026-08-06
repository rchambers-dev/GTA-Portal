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
  /**
   * When true, structure/KSB/hours are locked (apprentices enrolled).
   * Soft wording edits may still be allowed later.
   */
  hasEnrolledApprentices: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProgrammeDefinitionState = {
  version: 2;
  officialVersions: OfficialStandardVersion[];
  programmes: GtaProgrammeVersion[];
  selectedProgrammeId: string | null;
};
