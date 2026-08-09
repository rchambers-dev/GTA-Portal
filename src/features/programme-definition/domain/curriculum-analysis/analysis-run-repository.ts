/**
 * Persistence for AI-1 analysis runs/results.
 * Never writes gta_spine_item_ksbs programme mappings.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnalysisProviderId,
  AnalysisMode,
  CurriculumAnalysisResult,
  CurriculumAnalysisRun,
} from "./types";

function mapRun(row: Record<string, unknown>): CurriculumAnalysisRun {
  return {
    id: String(row.id),
    programmeVersionId: String(row.programme_version_id),
    officialStandardVersionId: String(row.official_standard_version_id),
    featureKey: String(row.feature_key),
    provider: row.provider as AnalysisProviderId,
    model: String(row.model),
    promptVersion: String(row.prompt_version),
    analysisMode: row.analysis_mode as AnalysisMode,
    copiedFromRunId: (row.copied_from_run_id as string) ?? null,
    sourceSnapshot: (row.source_snapshot as Record<string, unknown>) ?? {},
    status: row.status as CurriculumAnalysisRun["status"],
    errorSummary: (row.error_summary as string) ?? null,
    stats: (row.stats as Record<string, unknown>) ?? {},
    createdBy: String(row.created_by ?? "system"),
    createdAt: String(row.created_at),
    startedAt: (row.started_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
  };
}

function mapResult(row: Record<string, unknown>): CurriculumAnalysisResult {
  return {
    id: String(row.id),
    analysisRunId: String(row.analysis_run_id),
    ksbCode: String(row.ksb_code).toUpperCase(),
    officialDescription: "",
    classification: row.classification as CurriculumAnalysisResult["classification"],
    confidence: row.confidence as CurriculumAnalysisResult["confidence"],
    confidenceScore:
      row.confidence_score == null ? null : Number(row.confidence_score),
    proposedPrimarySpineItemId:
      (row.proposed_primary_spine_item_id as string) ?? null,
    proposedPrimaryBlockNumber:
      row.proposed_primary_block_number == null
        ? null
        : Number(row.proposed_primary_block_number),
    reinforcementCandidates:
      (row.reinforcement_candidates as CurriculumAnalysisResult["reinforcementCandidates"]) ??
      [],
    evidence: (row.evidence as CurriculumAnalysisResult["evidence"]) ?? [],
    reasoningSummary: String(row.reasoning_summary ?? ""),
    warnings: (row.warnings as string[]) ?? [],
    providerRawMeta: (row.provider_raw_meta as Record<string, unknown>) ?? {},
  };
}

export async function createAnalysisRun(
  supabase: SupabaseClient,
  input: {
    programmeVersionId: string;
    officialStandardVersionId: string;
    featureKey: string;
    provider: AnalysisProviderId;
    model: string;
    promptVersion: string;
    analysisMode?: AnalysisMode;
    sourceSnapshot: Record<string, unknown>;
    createdBy: string;
  },
): Promise<CurriculumAnalysisRun> {
  const { data, error } = await supabase
    .from("gta_curriculum_analysis_runs")
    .insert({
      programme_version_id: input.programmeVersionId,
      official_standard_version_id: input.officialStandardVersionId,
      feature_key: input.featureKey,
      provider: input.provider,
      model: input.model,
      prompt_version: input.promptVersion,
      analysis_mode: input.analysisMode ?? "full_baseline",
      source_snapshot: input.sourceSnapshot,
      status: "queued",
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRun(data as Record<string, unknown>);
}

export async function markAnalysisRunRunning(
  supabase: SupabaseClient,
  runId: string,
): Promise<void> {
  const { error } = await supabase
    .from("gta_curriculum_analysis_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw new Error(error.message);
}

export async function completeAnalysisRun(
  supabase: SupabaseClient,
  runId: string,
  stats: Record<string, unknown>,
): Promise<CurriculumAnalysisRun> {
  const { data, error } = await supabase
    .from("gta_curriculum_analysis_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      stats,
      error_summary: null,
    })
    .eq("id", runId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRun(data as Record<string, unknown>);
}

export async function failAnalysisRun(
  supabase: SupabaseClient,
  runId: string,
  errorSummary: string,
): Promise<void> {
  const { error } = await supabase
    .from("gta_curriculum_analysis_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_summary: errorSummary.slice(0, 2000),
    })
    .eq("id", runId);
  if (error) throw new Error(error.message);
}

export async function insertAnalysisResults(
  supabase: SupabaseClient,
  runId: string,
  results: CurriculumAnalysisResult[],
): Promise<void> {
  if (!results.length) return;
  const rows = results.map((r) => ({
    analysis_run_id: runId,
    ksb_code: r.ksbCode.toUpperCase(),
    classification: r.classification,
    confidence: r.confidence,
    confidence_score: r.confidenceScore,
    proposed_primary_spine_item_id: r.proposedPrimarySpineItemId,
    proposed_primary_block_number: r.proposedPrimaryBlockNumber,
    reinforcement_candidates: r.reinforcementCandidates,
    evidence: r.evidence,
    reasoning_summary: r.reasoningSummary,
    warnings: r.warnings,
    provider_raw_meta: r.providerRawMeta,
  }));

  const { error } = await supabase
    .from("gta_curriculum_analysis_results")
    .insert(rows);
  if (error) throw new Error(error.message);
}

export async function listAnalysisRuns(
  supabase: SupabaseClient,
  programmeVersionId: string,
  limit = 10,
): Promise<CurriculumAnalysisRun[]> {
  const { data, error } = await supabase
    .from("gta_curriculum_analysis_runs")
    .select("*")
    .eq("programme_version_id", programmeVersionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRun(r as Record<string, unknown>));
}

export async function getAnalysisRunWithResults(
  supabase: SupabaseClient,
  runId: string,
): Promise<CurriculumAnalysisRun | null> {
  const { data: run, error } = await supabase
    .from("gta_curriculum_analysis_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!run) return null;

  const { data: results, error: rErr } = await supabase
    .from("gta_curriculum_analysis_results")
    .select("*")
    .eq("analysis_run_id", runId)
    .order("ksb_code");
  if (rErr) throw new Error(rErr.message);

  const mapped = mapRun(run as Record<string, unknown>);
  mapped.results = (results ?? []).map((r) =>
    mapResult(r as Record<string, unknown>),
  );
  return mapped;
}
