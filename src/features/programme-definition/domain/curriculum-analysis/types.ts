/**
 * AI-1 curriculum analysis domain types.
 * Recommendations only — never programme coverage truth.
 */

export const CURRICULUM_ANALYSIS_PROMPT_VERSION =
  "baseline-curriculum-analysis@1.5" as const;

/**
 * AI-1.4 = evidence-sufficiency calibration (NEAR_FULL vs MATERIAL_PARTIAL).
 * AI-1.3 = false-Primary / gap-precision.
 * Future AI-1.xb = teaching-material enriched evaluation (separate).
 */
export const CURRICULUM_ANALYSIS_EVAL_STAGE = "AI-1.4" as const;

export const CURRICULUM_ANALYSIS_FEATURE_KEY =
  "programme.baseline_curriculum_analysis@1" as const;

export type EvidenceStatus =
  | "current_approved"
  | "historical"
  | "proposed";

export type EvidenceSourceType =
  | "lesson_plan_corpus"
  | "lesson_plan"
  | "sow"
  | "presentation"
  | "worksheet"
  | "practical_brief"
  | "handout"
  | "activity_sheet"
  | "assessment_guidance"
  | "other_teaching_resource";

export type AnalysisClassification =
  | "primary_candidate"
  | "curriculum_gap"
  | "distributed_skill"
  | "ambiguous";

export type AnalysisConfidence = "high" | "medium" | "low";

export type AnalysisRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type AnalysisProviderId = "portal_ai" | "heuristic" | "stub";

export type AnalysisMode = "full_baseline" | "delta";

export type CurriculumEvidenceRef = {
  sourceDocumentId: string;
  sourceType: EvidenceSourceType;
  evidenceStatus: EvidenceStatus;
  title: string;
  version: string | null;
  week: number | null;
  sessionLabel: string | null;
  blockNumber: number | null;
  locationRef: string;
  contentHashSha256?: string;
  excerpt: string;
  strength: "strong" | "weak" | "rejected";
  acceptRejectReason: string;
};

export type ReinforcementCandidate = {
  blockNumber: number;
  spineItemId?: string;
  week?: number | null;
  topic?: string | null;
  note: string;
};

export type CurriculumAnalysisResult = {
  id?: string;
  analysisRunId?: string;
  ksbCode: string;
  officialDescription: string;
  classification: AnalysisClassification;
  confidence: AnalysisConfidence;
  confidenceScore: number | null;
  proposedPrimarySpineItemId: string | null;
  proposedPrimaryBlockNumber: number | null;
  reinforcementCandidates: ReinforcementCandidate[];
  evidence: CurriculumEvidenceRef[];
  reasoningSummary: string;
  warnings: string[];
  providerRawMeta: Record<string, unknown>;
};

export type CurriculumAnalysisRun = {
  id: string;
  programmeVersionId: string;
  officialStandardVersionId: string;
  featureKey: string;
  provider: AnalysisProviderId;
  model: string;
  promptVersion: string;
  analysisMode: AnalysisMode;
  copiedFromRunId: string | null;
  sourceSnapshot: Record<string, unknown>;
  status: AnalysisRunStatus;
  errorSummary: string | null;
  stats: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  results?: CurriculumAnalysisResult[];
};

export type SpineBlockRef = {
  id: string;
  blockNumber: number;
  title: string;
  sequence: number;
};

export type OfficialKsbRef = {
  code: string;
  type: "knowledge" | "skill" | "behaviour" | string;
  description: string;
};

export type AnalyseProgrammeInput = {
  programmeVersionId: string;
  officialStandardVersionId: string;
  ksbs: OfficialKsbRef[];
  blocks: SpineBlockRef[];
  providerMode: AnalysisProviderId;
  createdBy: string;
  /** Optional subset for tests / partial runs. */
  ksbCodes?: string[];
  concurrency?: number;
};
