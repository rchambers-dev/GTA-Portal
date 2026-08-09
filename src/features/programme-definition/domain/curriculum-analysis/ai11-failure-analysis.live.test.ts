/**
 * AI-1.1 — failure taxonomy + retrieval-vs-judgement on frozen Portal-AI disagreements.
 * Evaluation-only. Does not call the model and does not change the golden baseline.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { loadOriginalLessonPlanEvidencePack } from "./evidence";
import { retrieveEvidenceForKsb } from "./retriever";
import {
  AUTOCARE_V1_GOLDEN_PRIMARIES,
  type EvalDisagreement,
} from "./golden-eval";

const PV = "231a8a32-d876-4312-a178-960d19dcf938";

const FAILURE_CLASSES = [
  "correct_coverage_wrong_primary_block",
  "chose_reinforcement_over_first_substantive_teaching",
  "later_specialist_consolidation_over_earlier_teaching",
  "lexical_false_friend",
  "insufficient_evidence",
  "genuine_distributed_skill",
  "genuine_ambiguity_near_tie",
  "curriculum_gap_incorrectly_forced_into_primary",
  "retrieval_failure",
  "evidence_ranking_failure",
  "model_judgement_failure",
  "golden_decision_potentially_evidence_sensitive",
] as const;

type FailureClass = (typeof FAILURE_CLASSES)[number];

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    // ok
  }
}

function classifyRow(input: {
  d: EvalDisagreement;
  goldenInTopN: boolean;
  goldenInAnySession: boolean;
  earliestGoldenWeek: number | null;
  earliestAiWeek: number | null;
  retrievalBlocks: number[];
  topBlocks: number[];
}): { classes: FailureClass[]; missType: "RETRIEVAL_MISS" | "JUDGEMENT_MISS" | "N_A"; notes: string } {
  const { d } = input;
  const classes = new Set<FailureClass>();
  let missType: "RETRIEVAL_MISS" | "JUDGEMENT_MISS" | "N_A" = "N_A";
  const notes: string[] = [];

  if (d.goldenClassification === "distributed_skill") {
    classes.add("genuine_distributed_skill");
    classes.add("model_judgement_failure");
    notes.push("Golden distributed_skill forced into Primary.");
    if (d.aiClassification === "primary_candidate") {
      classes.add("curriculum_gap_incorrectly_forced_into_primary");
    }
    return { classes: [...classes], missType: "JUDGEMENT_MISS", notes: notes.join(" ") };
  }

  if (d.goldenClassification === "curriculum_gap") {
    classes.add("curriculum_gap_incorrectly_forced_into_primary");
    classes.add("model_judgement_failure");
    if (d.confidence === "high") {
      notes.push("Over-confident false Primary on golden gap.");
    }
    // Gaps: retrieval "miss" N/A for correct block; still check if weak evidence drove FP
    if (input.topBlocks.length && d.aiPrimary != null) {
      classes.add("insufficient_evidence");
      notes.push("Partial/adjacent evidence treated as ownership.");
    }
    return { classes: [...classes], missType: "N_A", notes: notes.join(" ") };
  }

  // Golden Primary cases
  if (!input.goldenInAnySession) {
    // No session mapped to golden block at all in corpus — unusual
    classes.add("retrieval_failure");
    missType = "RETRIEVAL_MISS";
    notes.push("No corpus session maps to golden Primary block.");
  } else if (!input.goldenInTopN) {
    classes.add("retrieval_failure");
    classes.add("evidence_ranking_failure");
    missType = "RETRIEVAL_MISS";
    notes.push("Golden Primary block absent from top-N retrieval candidates.");
  } else {
    missType = "JUDGEMENT_MISS";
    classes.add("model_judgement_failure");
    classes.add("correct_coverage_wrong_primary_block");
    notes.push("Golden Primary block was in retrieved set but not selected.");
  }

  if (
    d.aiClassification === "curriculum_gap" &&
    d.goldenClassification === "primary_candidate"
  ) {
    classes.add("insufficient_evidence");
    notes.push("Model forced gap despite golden Primary coverage.");
    if (missType === "RETRIEVAL_MISS") {
      notes.push("Likely driven by retrieval miss.");
    }
  }

  if (
    d.goldenPrimary != null &&
    d.aiPrimary != null &&
    d.aiPrimary > d.goldenPrimary
  ) {
    classes.add("chose_reinforcement_over_first_substantive_teaching");
    classes.add("later_specialist_consolidation_over_earlier_teaching");
    notes.push(
      `Later block B${d.aiPrimary} preferred over earlier golden B${d.goldenPrimary}.`,
    );
  }

  if (
    input.earliestAiWeek != null &&
    input.earliestGoldenWeek != null &&
    input.earliestAiWeek > input.earliestGoldenWeek + 10
  ) {
    classes.add("chose_reinforcement_over_first_substantive_teaching");
    notes.push(
      `AI week ${input.earliestAiWeek} later than golden week ${input.earliestGoldenWeek}.`,
    );
  }

  // Near-tie / ambiguity when both blocks in top candidates
  if (
    d.goldenPrimary != null &&
    d.aiPrimary != null &&
    input.topBlocks.includes(d.goldenPrimary) &&
    input.topBlocks.includes(d.aiPrimary) &&
    d.aiClassification === "primary_candidate"
  ) {
    classes.add("genuine_ambiguity_near_tie");
    notes.push("Both golden and AI blocks retrieved — close call should often be ambiguous.");
  }

  // Lexical false friend patterns (general topic adjacency)
  const ffPairs: Array<[number, number, string]> = [
    [1, 3, "foundation vs later H&S/communication adjacency"],
    [2, 8, "inspection block vs later specialist"],
    [2, 9, "inspection/steering adjacency vs later specialist"],
    [2, 4, "B2 vs B4 lexical adjacency"],
    [3, 4, "B3 service vs B4 electrical/service adjacency"],
    [5, 9, "B5 vs late specialist"],
    [6, 9, "B6 vs consolidation/specialist"],
    [6, 4, "B6 climate vs B4 false friend"],
    [1, 5, "foundation vs B5"],
    [1, 2, "foundation vs B2"],
    [1, 7, "foundation vs B7"],
    [5, 2, "B5 EV vs B2 inspection false friend"],
  ];
  for (const [g, a, label] of ffPairs) {
    if (d.goldenPrimary === g && d.aiPrimary === a) {
      classes.add("lexical_false_friend");
      notes.push(`Lexical/adjacency pattern: ${label}.`);
    }
  }

  // Evidence-sensitive goldens (human content-verified or conditional)
  const evidenceSensitive = new Set([
    "K6",
    "K25",
    "K32",
    "S21",
    "S16",
    "S18",
    "K8",
    "S9",
  ]);
  if (evidenceSensitive.has(d.ksbCode.toUpperCase())) {
    classes.add("golden_decision_potentially_evidence_sensitive");
    notes.push("Golden label was human/content-verified or evidence-sensitive.");
  }

  return { classes: [...classes], missType, notes: notes.join(" ") };
}

describe("AI-1.1 failure analysis", () => {
  it("classifies 29 Portal-AI disagreements with retrieval vs judgement split", async () => {
    loadEnvLocal();
const portalPath = resolve(
      process.env.AI11_FAILURE_EVAL_PATH ||
        "tests/artifacts/autocare-v1/sow-only/ai-evaluations/ai-1/ai1-golden-eval-portal_ai.json",
    );
    const portal = JSON.parse(readFileSync(portalPath, "utf8")) as {
      evaluation: { disagreements: EvalDisagreement[] };
      promptVersion?: string;
    };
    const disagreements = portal.evaluation.disagreements;
    // AI-1 frozen set was 29; later runs may differ.

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: ver, error: vErr } = await sb
      .from("gta_programme_versions")
      .select("standard_version_id")
      .eq("id", PV)
      .single();
    if (vErr) throw new Error(vErr.message);
    const { data: ksbs, error: kErr } = await sb
      .from("se_ksbs")
      .select("ksb_code, ksb_type, description")
      .eq("standard_version_id", ver.standard_version_id);
    if (kErr) throw new Error(kErr.message);
    const byCode = new Map(
      (ksbs ?? []).map((k) => [String(k.ksb_code).toUpperCase(), k]),
    );

    const pack = loadOriginalLessonPlanEvidencePack();
    const goldenBlockByCode = new Map(
      AUTOCARE_V1_GOLDEN_PRIMARIES.map((p) => [
        p.ksbCode.toUpperCase(),
        p.blockNumber,
      ]),
    );

    const rows = [];
    const classCounts: Record<string, number> = Object.fromEntries(
      FAILURE_CLASSES.map((c) => [c, 0]),
    );
    let retrievalMiss = 0;
    let judgementMiss = 0;
    let naMiss = 0;

    for (const d of disagreements) {
      const k = byCode.get(d.ksbCode.toUpperCase());
      const ksb = {
        code: d.ksbCode.toUpperCase(),
        type: String(k?.ksb_type || "knowledge"),
        description: String(k?.description || ""),
      };
      const hits = retrieveEvidenceForKsb(ksb, pack.sessions, 10);
      const retrievalBlocks = [
        ...new Set(hits.map((h) => h.session.blockNumber)),
      ];
      const topBlocks = retrievalBlocks;
      const goldenBlock =
        d.goldenPrimary ?? goldenBlockByCode.get(d.ksbCode.toUpperCase()) ?? null;
      const goldenInTopN =
        goldenBlock != null && retrievalBlocks.includes(goldenBlock);
      const goldenSessions = pack.sessions.filter(
        (s) => s.blockNumber === goldenBlock,
      );
      const aiSessions = pack.sessions.filter(
        (s) => s.blockNumber === d.aiPrimary,
      );
      const earliestGoldenWeek = goldenSessions.length
        ? Math.min(...goldenSessions.map((s) => s.week))
        : null;
      const earliestAiWeek = aiSessions.length
        ? Math.min(...aiSessions.map((s) => s.week))
        : null;

      const classified = classifyRow({
        d,
        goldenInTopN,
        goldenInAnySession: goldenSessions.length > 0 || goldenBlock == null,
        earliestGoldenWeek,
        earliestAiWeek,
        retrievalBlocks,
        topBlocks,
      });

      for (const c of classified.classes) {
        classCounts[c] = (classCounts[c] ?? 0) + 1;
      }
      if (classified.missType === "RETRIEVAL_MISS") retrievalMiss += 1;
      else if (classified.missType === "JUDGEMENT_MISS") judgementMiss += 1;
      else naMiss += 1;

      rows.push({
        ksbCode: d.ksbCode,
        officialDescription: ksb.description,
        goldenClassification: d.goldenClassification,
        aiClassification: d.aiClassification,
        goldenPrimary: d.goldenPrimary,
        aiPrimary: d.aiPrimary,
        confidence: d.confidence,
        evalReason: d.reason,
        missType: classified.missType,
        failureClasses: classified.classes,
        notes: classified.notes,
        retrieval: {
          topN: hits.map((h) => ({
            week: h.session.week,
            block: h.session.blockNumber,
            topic: h.session.topic,
            score: Number(h.score.toFixed(2)),
            rejected: h.rejected,
            reasons: h.reasons,
          })),
          blocksInTopN: retrievalBlocks,
          goldenBlockInTopN: goldenInTopN,
          goldenBlockSessionCount: goldenSessions.length,
        },
      });
    }

    const artifact = {
      at: new Date().toISOString(),
      sourceEval:
        "tests/artifacts/autocare-v1/sow-only/ai-evaluations/ai-1/ai1-golden-eval-portal_ai.json",
      ai1BenchmarkPromptVersion: portal.promptVersion ?? "baseline-curriculum-analysis@1.1",
      disagreementCount: disagreements.length,
      retrievalVsJudgement: {
        RETRIEVAL_MISS: retrievalMiss,
        JUDGEMENT_MISS: judgementMiss,
        N_A_gap_or_non_primary: naMiss,
        note: "RETRIEVAL_MISS = golden Primary block not in top-N candidates. JUDGEMENT_MISS = golden Primary block present but model selected another. N_A for golden gaps/distributed where there is no correct Primary block.",
      },
      failureClassCounts: classCounts,
      rows,
      baselineFrozen: {
        approvedPrimaries: 45,
        reviewedGaps: 18,
        distributedSkillReviews: 1,
        unresolved: 0,
        structuredOtjHours: 611.5,
      },
    };

    const outName =
      process.env.AI11_FAILURE_OUT || ".tmp-ai11-failure-analysis.json";
    const out = resolve(outName);
    writeFileSync(out, JSON.stringify(artifact, null, 2));
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      wrote: out,
      disagreementCount: disagreements.length,
      retrievalVsJudgement: artifact.retrievalVsJudgement,
      failureClassCounts: classCounts,
    }, null, 2));

    expect(retrievalMiss + judgementMiss + naMiss).toBe(disagreements.length);
  }, 120_000);
});
