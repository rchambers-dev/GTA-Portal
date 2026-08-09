/**
 * CurriculumAnalysisEngine — recommendations only; never writes programme mappings.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAiConfig,
  isAiConfigured,
  resolveAiProvider,
  runAi,
  type AiProvider,
} from "@/lib/ai";
import {
  completeAnalysisRun,
  createAnalysisRun,
  failAnalysisRun,
  insertAnalysisResults,
  markAnalysisRunRunning,
} from "./analysis-run-repository";
import { loadOriginalLessonPlanEvidencePack } from "./evidence";
import {
  assessEvidenceSufficiency,
  normalizeEvidenceStrength,
  strengthAllowsPrimary,
  type EvidenceSufficiency,
} from "./evidence-sufficiency";
import { heuristicJudgeKsb } from "./heuristic";
import { applyConservativeHybrid } from "./ownership-guards";
import { buildKsbAnalysisMessages } from "./prompt";
import {
  hitsToEvidenceRefs,
  retrieveEvidenceForKsb,
  type RetrievalHit,
} from "./retriever";
import {
  deriveClassificationFromCoverageOwnership,
  parseModelKsbJudgementText,
  type ModelKsbJudgement,
} from "./schema";
import {
  CURRICULUM_ANALYSIS_EVAL_STAGE,
  CURRICULUM_ANALYSIS_FEATURE_KEY,
  CURRICULUM_ANALYSIS_PROMPT_VERSION,
  type AnalyseProgrammeInput,
  type CurriculumAnalysisResult,
  type CurriculumAnalysisRun,
  type OfficialKsbRef,
  type SpineBlockRef,
} from "./types";

function blockByNumber(blocks: SpineBlockRef[]): Map<number, SpineBlockRef> {
  return new Map(blocks.map((b) => [b.blockNumber, b]));
}

export function validateAndMaterialiseResult(input: {
  ksb: OfficialKsbRef;
  judgement: ModelKsbJudgement;
  hits: RetrievalHit[];
  blocks: SpineBlockRef[];
  providerMeta: Record<string, unknown>;
  sufficiency?: EvidenceSufficiency;
}): CurriculumAnalysisResult {
  const code = input.ksb.code.toUpperCase();
  if (input.judgement.ksbCode.toUpperCase() !== code) {
    throw new Error(
      `Model returned KSB ${input.judgement.ksbCode}, expected ${code}`,
    );
  }

  const byNum = blockByNumber(input.blocks);
  let classification = input.judgement.classification;
  let proposedBlock = input.judgement.proposedPrimaryBlockNumber;
  let confidence = input.judgement.confidence;
  const warnings = [...(input.judgement.warnings ?? [])];
  const sufficiency =
    input.sufficiency ??
    assessEvidenceSufficiency({ ksb: input.ksb, hits: input.hits });

  const strength =
    normalizeEvidenceStrength(
      input.judgement.evidenceStrength ?? sufficiency.coverageStrength,
    ) ?? "ABSENT";

  const derived = deriveClassificationFromCoverageOwnership(
    input.judgement.coverage,
    input.judgement.ownership,
    strength,
  );
  if (derived && derived !== classification) {
    warnings.push(
      `Materialise: classification set from coverage=${input.judgement.coverage} ownership=${input.judgement.ownership} strength=${strength}.`,
    );
    classification = derived;
  }

  // Invalid/missing Primary block first → ambiguous (coverage may still be true).
  if (classification === "primary_candidate") {
    if (proposedBlock == null || !byNum.has(proposedBlock)) {
      warnings.push("Invalid/missing Primary block — demoted to ambiguous.");
      classification = "ambiguous";
      proposedBlock = null;
    }
  }

  // False-gap guard when essentials establish coverage (FULL/NEAR_FULL).
  if (classification === "curriculum_gap" && strengthAllowsPrimary(strength)) {
    classification = "ambiguous";
    proposedBlock = null;
    confidence = confidence === "high" ? "medium" : confidence;
    warnings.push(
      `Materialise: false-gap guard (${strength}) → ambiguous.`,
    );
  }

  // Primary without FULL/NEAR_FULL → gap only with named essentials.
  if (
    classification === "primary_candidate" &&
    !strengthAllowsPrimary(strength)
  ) {
    const missingEssentials =
      input.judgement.missingEssentialComponents ??
      sufficiency.missingEssentialComponents;
    if (
      strength === "MATERIAL_PARTIAL" &&
      missingEssentials.length === 0
    ) {
      // retain Primary at medium — cannot name essential miss
      confidence = "medium";
      warnings.push(
        "Materialise: MATERIAL_PARTIAL without named essential — Primary retained medium.",
      );
    } else {
      classification =
        strength === "WEAK_ADJACENT" || strength === "ABSENT"
          ? "curriculum_gap"
          : "curriculum_gap";
      proposedBlock = null;
      confidence = "medium";
      warnings.push(
        `Materialise: Primary blocked — evidenceStrength=${strength}.`,
      );
    }
  }

  if (classification !== "primary_candidate") {
    proposedBlock = null;
  }

  const block = proposedBlock != null ? byNum.get(proposedBlock) : null;

  const reinforcements = (input.judgement.reinforcementBlockNumbers ?? [])
    .filter((n) => byNum.has(n) && n !== proposedBlock)
    .slice(0, 5)
    .map((n) => ({
      blockNumber: n,
      spineItemId: byNum.get(n)?.id,
      note: "Reinforcement candidate only — not persisted by AI-1",
    }));

  return {
    ksbCode: code,
    officialDescription: input.ksb.description,
    classification,
    confidence,
    confidenceScore: input.judgement.confidenceScore ?? null,
    proposedPrimarySpineItemId: block?.id ?? null,
    proposedPrimaryBlockNumber: block?.blockNumber ?? null,
    reinforcementCandidates: reinforcements,
    evidence: hitsToEvidenceRefs(input.hits),
    reasoningSummary: input.judgement.reasoningSummary,
    warnings: [
      ...warnings,
      ...(input.judgement.rejectedFalsePositives ?? []).map(
        (x) => `Rejected false positive: ${x}`,
      ),
    ],
    providerRawMeta: {
      ...input.providerMeta,
      coverage: input.judgement.coverage ?? null,
      ownership: input.judgement.ownership ?? null,
      evidenceStrength: input.judgement.evidenceStrength ?? sufficiency.coverageStrength,
      coverageConfidence: input.judgement.coverageConfidence ?? null,
      ownershipConfidence: input.judgement.ownershipConfidence ?? null,
      coveredComponents: input.judgement.coveredComponents ?? sufficiency.coveredComponents,
      missingComponents: input.judgement.missingComponents ?? sufficiency.missingComponents,
      futureTeachingMaterialsStage: "AI-1.3b",
    },
  };
}

async function judgeWithPortalAi(input: {
  ksb: OfficialKsbRef;
  blocks: SpineBlockRef[];
  hits: RetrievalHit[];
  sufficiency: EvidenceSufficiency;
  accountId: string;
  provider?: AiProvider;
}): Promise<ModelKsbJudgement> {
  const msgs = buildKsbAnalysisMessages(input);
  const result = await runAi(
    {
      feature: "programme.baseline_curriculum_analysis",
      messages: [
        { role: "system", content: msgs.system },
        { role: "user", content: msgs.user },
      ],
      accountId: input.accountId,
      workspace: "management",
      temperature: 0.1,
      maxTokens: 1100,
      jsonObject: true,
    },
    input.provider ?? resolveAiProvider(),
  );
  return parseModelKsbJudgementText(result.text);
}

export async function analyseProgrammeVersion(
  supabase: SupabaseClient,
  input: AnalyseProgrammeInput,
  opts?: { aiProvider?: AiProvider },
): Promise<CurriculumAnalysisRun> {
  const pack = loadOriginalLessonPlanEvidencePack();
  const cfg = getAiConfig();
  const providerMode = input.providerMode;

  if (providerMode === "portal_ai" && !isAiConfigured()) {
    throw new Error(
      "portal_ai mode requested but AI is not configured (AI_API_KEY / AI_PROVIDER).",
    );
  }
  if (providerMode === "stub") {
    throw new Error("stub provider cannot run curriculum analysis.");
  }

  const modelLabel =
    providerMode === "portal_ai"
      ? cfg.model
      : "heuristic-retriever-judge@1";

  const ksbs = input.ksbCodes?.length
    ? input.ksbs.filter((k) =>
        input.ksbCodes!.map((c) => c.toUpperCase()).includes(k.code.toUpperCase()),
      )
    : input.ksbs;

  if (!ksbs.length) throw new Error("No KSBs to analyse.");

  const run = await createAnalysisRun(supabase, {
    programmeVersionId: input.programmeVersionId,
    officialStandardVersionId: input.officialStandardVersionId,
    featureKey: CURRICULUM_ANALYSIS_FEATURE_KEY,
    provider: providerMode,
    model: modelLabel,
    promptVersion: CURRICULUM_ANALYSIS_PROMPT_VERSION,
    analysisMode: "full_baseline",
      sourceSnapshot: {
      evidenceStatusFilter: "current_approved",
      excludedEvidenceStatuses: ["proposed", "historical"],
      excludedPacks: ["AI Proposed Amendments"],
      evalStage: CURRICULUM_ANALYSIS_EVAL_STAGE,
      corpus: {
        sourceDocumentId: pack.sourceDocumentId,
        path: pack.path,
        contentHashSha256: pack.contentHashSha256,
        sessionCount: pack.sessions.length,
        version: pack.version,
      },
      goldenLabelsExcludedFromPrompt: true,
      futureTeachingMaterialsStage: "AI-1.3b",
    },
    createdBy: input.createdBy,
  });

  await markAnalysisRunRunning(supabase, run.id);

  const results: CurriculumAnalysisResult[] = [];
  const concurrency = Math.max(1, Math.min(input.concurrency ?? 2, 4));
  let cursor = 0;

  async function worker() {
    while (cursor < ksbs.length) {
      const idx = cursor++;
      const ksb = ksbs[idx]!;
      const hits = retrieveEvidenceForKsb(ksb, pack.sessions, 10);
      const sufficiency = assessEvidenceSufficiency({ ksb, hits });
      let judgement: ModelKsbJudgement;
      const heuristic = heuristicJudgeKsb({ ksb, hits, sufficiency });
      const providerMeta: Record<string, unknown> = {
        mode: providerMode,
        model: modelLabel,
        evalStage: CURRICULUM_ANALYSIS_EVAL_STAGE,
        heuristicClassification: heuristic.classification,
        heuristicPrimaryBlock: heuristic.proposedPrimaryBlockNumber,
        sufficiencyStrength: sufficiency.coverageStrength,
        sufficiencyCoverageRatio: sufficiency.coverageRatio,
      };

      if (providerMode === "portal_ai") {
        let lastErr: unknown;
        let llm: ModelKsbJudgement | undefined;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            llm = await judgeWithPortalAi({
              ksb,
              blocks: input.blocks,
              hits,
              sufficiency,
              accountId: input.createdBy,
              provider: opts?.aiProvider,
            });
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
          }
        }
        if (lastErr || !llm) throw lastErr ?? new Error("portal_ai judgement missing");
        judgement = applyConservativeHybrid({ llm, heuristic, hits, sufficiency });
        providerMeta.llmClassification = llm.classification;
        providerMeta.llmPrimaryBlock = llm.proposedPrimaryBlockNumber;
        providerMeta.hybridApplied = true;
      } else {
        judgement = applyConservativeHybrid({
          llm: heuristic,
          heuristic,
          hits,
          sufficiency,
        });
      }

      results.push(
        validateAndMaterialiseResult({
          ksb,
          judgement,
          hits,
          blocks: input.blocks,
          providerMeta,
          sufficiency,
        }),
      );
    }
  }

  try {
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    // Stable order for insert/readability
    results.sort((a, b) => a.ksbCode.localeCompare(b.ksbCode));
    await insertAnalysisResults(supabase, run.id, results);
    const stats = {
      ksbCount: results.length,
      primaryCandidates: results.filter((r) => r.classification === "primary_candidate")
        .length,
      gaps: results.filter((r) => r.classification === "curriculum_gap").length,
      distributed: results.filter((r) => r.classification === "distributed_skill")
        .length,
      ambiguous: results.filter((r) => r.classification === "ambiguous").length,
      corpusHash: pack.contentHashSha256,
    };
    const completed = await completeAnalysisRun(supabase, run.id, stats);
    completed.results = results;
    return completed;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    await failAnalysisRun(supabase, run.id, message);
    throw err instanceof Error ? err : new Error(message);
  }
}
