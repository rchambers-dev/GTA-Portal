import { CURRICULUM_ANALYSIS_PROMPT_VERSION } from "./types";
import type { OfficialKsbRef, SpineBlockRef } from "./types";
import type { RetrievalHit } from "./retriever";
import type { EvidenceSufficiency } from "./evidence-sufficiency";

export function buildKsbAnalysisMessages(input: {
  ksb: OfficialKsbRef;
  blocks: SpineBlockRef[];
  hits: RetrievalHit[];
  sufficiency?: EvidenceSufficiency;
}): { system: string; user: string; promptVersion: string } {
  const blockList = input.blocks
    .map((b) => `B${b.blockNumber}: ${b.title} [${b.id}]`)
    .join("\n");

  const chronological = [...input.hits].sort(
    (a, b) => a.session.week - b.session.week || b.score - a.score,
  );

  const evidence = chronological
    .map((h, i) => {
      const s = h.session;
      return [
        `CANDIDATE ${i + 1} score=${h.score.toFixed(2)} rejected=${h.rejected} chronologicalOrder=${i + 1}`,
        `ref=${s.evidenceRefId} week=${s.week} blockNumber=${s.blockNumber}`,
        `topic=${s.topic}`,
        `strongEvidence=${s.strongText.slice(0, 700)}`,
        `practical=${s.practicalText.slice(0, 400)}`,
      ].join("\n");
    })
    .join("\n\n");

  const sufficiencyBlock = input.sufficiency
    ? [
        "DETERMINISTIC BREADTH CHECK (advisory):",
        `evidenceStrengthHint=${input.sufficiency.coverageStrength}`,
        `essentialCoverageRatio=${input.sufficiency.essentialCoverageRatio.toFixed(2)}`,
        `coveredComponents=${JSON.stringify(input.sufficiency.coveredComponents)}`,
        `missingEssentialComponents=${JSON.stringify(input.sufficiency.missingEssentialComponents)}`,
        `missingComponents(all)=${JSON.stringify(input.sufficiency.missingComponents)}`,
        `practicalRequired=${input.sufficiency.practicalRequired}`,
        `practicalPresent=${input.sufficiency.practicalPresent}`,
        `notes=${input.sufficiency.reasons.join(" | ")}`,
        "",
      ].join("\n")
    : "";

  const system = [
    "You are the GTA Portal embedded curriculum-analysis engine.",
    "Analyse ONE official apprenticeship KSB against CURRENT APPROVED original curriculum evidence only.",
    "Never invent teaching. Never use evaluation labels or golden answers.",
    "",
    "Answer THREE questions in order:",
    "A) IS IT TAUGHT? — substantive curriculum presence of the core competence.",
    "B) IS THE BREADTH SUFFICIENT? — FULL | NEAR_FULL | MATERIAL_PARTIAL | WEAK_ADJACENT | ABSENT",
    "C) WHO OWNS IT? — only after coverage is established: clear_primary | ambiguous_primary | distributed | none",
    "Do NOT let ownership uncertainty in C flip A/B into GAP.",
    "",
    "MATERIALITY:",
    "- Decompose official wording into ESSENTIAL competence vs SUPPORTING/EXEMPLAR detail.",
    "- Missing illustrative examples must NOT destroy otherwise substantive coverage.",
    "- Missing essential action/concept/system/compliance CAN force MATERIAL_PARTIAL.",
    "- Do not merely count components; judge semantic core competence.",
    "",
    "evidenceStrength:",
    "- FULL: essential breadth clearly taught",
    "- NEAR_FULL: core competence taught; only exemplars/detail incomplete → still covered",
    "- MATERIAL_PARTIAL: relevant teaching exists but a named ESSENTIAL is absent → usually curriculum_gap",
    "- WEAK_ADJACENT: related topic only → curriculum_gap",
    "- ABSENT: no substantive evidence → curriculum_gap",
    "",
    "GAP RULE: if relevant evidence exists, emit curriculum_gap only with missingEssentialComponents naming what essential is absent.",
    "If you cannot name a missing essential, do not confidently emit GAP.",
    "",
    "PRIMARY RULE: require positive substantive evidence of the core competence (not adjacency).",
    "NEAR_FULL + clear owner → primary_candidate (usually medium confidence).",
    "FULL + unclear owner → ambiguous (coverage established).",
    "FULL/NEAR_FULL + multi-system no single owner → distributed_skill.",
    "",
    "TYPE RULES:",
    "- SKILL: performance verbs need practical/application evidence.",
    "- KNOWLEDGE: require concept/system teaching, not only a related practical.",
    "- BEHAVIOUR: require deliberate behaviour teaching/scenario — not mere implication.",
    "",
    "AMBIGUOUS means ownership uncertain AFTER coverage is established — not a dumping ground for unsure coverage.",
    "Chronology is a signal for ownership, not a veto of coverage.",
    "False friends: security≠cyber; wheel≠geometry; service≠customer service; EV≠SoH; inspection≠manufacturer schedule/data; TPMS≠tyre strip/balance; generic workplace≠workplace instructions; generic role≠limits of autonomy/reporting; parts/quotations≠fluids+filtration.",
    "Return JSON only.",
    `prompt_version=${CURRICULUM_ANALYSIS_PROMPT_VERSION}`,
  ].join("\n");

  const user = [
    `KSB ${input.ksb.code} (${input.ksb.type})`,
    `OFFICIAL REQUIREMENT: ${input.ksb.description}`,
    "",
    "SPINE BLOCKS (Primary may only be one of these block numbers):",
    blockList,
    "",
    sufficiencyBlock,
    "CANDIDATE EVIDENCE (earliest week first):",
    evidence || "(no candidate evidence retrieved)",
    "",
    "Reason: core competence → essential vs exemplar → evidenceStrength → coverage → ownership.",
    "",
    "Respond with JSON:",
    JSON.stringify(
      {
        ksbCode: input.ksb.code,
        evidenceStrength: "FULL|NEAR_FULL|MATERIAL_PARTIAL|WEAK_ADJACENT|ABSENT",
        coveredComponents: ["essential: ..."],
        missingComponents: ["exemplar: ..."],
        missingEssentialComponents: [],
        coverage: "covered|partial|absent",
        ownership: "clear_primary|ambiguous_primary|distributed|none",
        coverageConfidence: "high|medium|low",
        ownershipConfidence: "high|medium|low",
        classification: "primary_candidate|curriculum_gap|distributed_skill|ambiguous",
        confidence: "high|medium|low",
        confidenceScore: 0,
        proposedPrimaryBlockNumber: null,
        reinforcementBlockNumbers: [],
        evidenceLocationRefs: ["autocare-st0499-v1-original-corpus:W012"],
        reasoningSummary:
          "A taught?: ...; B strength/essentials?: ...; C ownership?: ...",
        warnings: [],
        rejectedFalsePositives: [],
      },
      null,
      2,
    ),
  ].join("\n");

  return {
    system,
    user,
    promptVersion: CURRICULUM_ANALYSIS_PROMPT_VERSION,
  };
}
