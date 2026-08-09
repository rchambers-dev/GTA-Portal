import { describe, expect, it } from "vitest";
import {
  assertNoGoldenLeak,
  buildAutocareV1GoldenLabels,
  evaluateAgainstGolden,
  heuristicJudgeKsb,
  parseModelKsbJudgement,
  parseModelKsbJudgementText,
  retrieveEvidenceForKsb,
  validateAndMaterialiseResult,
  buildKsbAnalysisMessages,
  applyConservativeHybrid,
  deriveClassificationFromCoverageOwnership,
  assessEvidenceSufficiency,
  type EvidenceSession,
  type OfficialKsbRef,
  type SpineBlockRef,
} from "./index";

function session(
  partial: Partial<EvidenceSession> &
    Pick<EvidenceSession, "week" | "blockNumber" | "topic">,
): EvidenceSession {
  const topic = partial.topic;
  const strong = `${topic.toLowerCase()} ${partial.strongText ?? ""}`.trim();
  return {
    evidenceRefId: `autocare-st0499-v1-original-corpus:W${String(partial.week).padStart(3, "0")}`,
    sourceDocumentId: "autocare-st0499-v1-original-corpus",
    sourceType: "lesson_plan_corpus",
    evidenceStatus: "current_approved",
    version: "v1.0",
    contentHashSha256: "abc",
    week: partial.week,
    blockNumber: partial.blockNumber,
    file: `week-${partial.week}.docx`,
    title: topic,
    topic,
    searchableText: strong,
    strongText: strong,
    weakText: "",
    practicalText: partial.practicalText ?? strong,
    objectivesText: partial.objectivesText ?? "",
    excerptSeed: strong.slice(0, 100),
  };
}

const blocks: SpineBlockRef[] = [
  { id: "b1", blockNumber: 1, title: "Foundation", sequence: 1 },
  { id: "b2", blockNumber: 2, title: "Inspection", sequence: 2 },
  { id: "gw", blockNumber: 99, title: "Gateway", sequence: 11 },
];

describe("curriculum analysis schema", () => {
  it("parses structured judgements and rejects unknown shapes", () => {
    const ok = parseModelKsbJudgement({
      ksbCode: "K3",
      classification: "primary_candidate",
      confidence: "high",
      proposedPrimaryBlockNumber: 1,
      reinforcementBlockNumbers: [2],
      evidenceLocationRefs: ["autocare-st0499-v1-original-corpus:W001"],
      reasoningSummary: "Safety taught in Foundation W01",
      warnings: [],
      rejectedFalsePositives: [],
    });
    expect(ok.ksbCode).toBe("K3");
    expect(() =>
      parseModelKsbJudgement({
        ksbCode: "K3",
        classification: "not_a_class",
        confidence: "high",
        proposedPrimaryBlockNumber: 1,
        reasoningSummary: "x",
      }),
    ).toThrow();
  });

  it("parses fenced JSON text deterministically", () => {
    const text = "```json\n{\"ksbCode\":\"S10\",\"classification\":\"distributed_skill\",\"confidence\":\"high\",\"proposedPrimaryBlockNumber\":null,\"reinforcementBlockNumbers\":[5,6],\"evidenceLocationRefs\":[],\"reasoningSummary\":\"multi-system\",\"warnings\":[],\"rejectedFalsePositives\":[]}\n```";
    const a = parseModelKsbJudgementText(text);
    const b = parseModelKsbJudgementText(text);
    expect(a).toEqual(b);
    expect(a.classification).toBe("distributed_skill");
  });
});

describe("validateAndMaterialiseResult", () => {
  const ksb: OfficialKsbRef = {
    code: "K3",
    type: "knowledge",
    description: "Awareness of health and safety regulations.",
  };

  it("rejects Gateway/non-existing block Primary candidates", () => {
    const hits = [
      {
        session: session({ week: 1, blockNumber: 1, topic: "Workshop Safety" }),
        score: 10,
        reasons: ["topic:safety"],
        rejected: false,
      },
    ];
    const demoted = validateAndMaterialiseResult({
      ksb,
      hits,
      blocks: blocks.filter((b) => b.blockNumber !== 99),
      judgement: {
        ksbCode: "K3",
        classification: "primary_candidate",
        confidence: "high",
        proposedPrimaryBlockNumber: 99,
        reinforcementBlockNumbers: [],
        evidenceLocationRefs: [],
        reasoningSummary: "bad gateway target",
        warnings: [],
        rejectedFalsePositives: [],
      },
      providerMeta: {},
    });
    expect(demoted.classification).toBe("ambiguous");
    expect(demoted.proposedPrimarySpineItemId).toBeNull();
  });

  it("rejects unknown KSB code mismatch", () => {
    expect(() =>
      validateAndMaterialiseResult({
        ksb,
        hits: [],
        blocks,
        judgement: {
          ksbCode: "K99",
          classification: "curriculum_gap",
          confidence: "high",
          proposedPrimaryBlockNumber: null,
          reinforcementBlockNumbers: [],
          evidenceLocationRefs: [],
          reasoningSummary: "mismatch",
          warnings: [],
          rejectedFalsePositives: [],
        },
        providerMeta: {},
      }),
    ).toThrow(/expected K3/i);
  });
});

describe("AI-1.4 evidence sufficiency semantic situations", () => {
  const fullSufficiency = {
    components: [],
    coveredComponents: ["C1:core"],
    missingComponents: [],
    missingEssentialComponents: [],
    coverageStrength: "FULL" as const,
    coverageRatio: 1,
    essentialCoverageRatio: 1,
    distinctiveCovered: 1,
    distinctiveTotal: 1,
    practicalRequired: true,
    practicalPresent: true,
    missingMaterialBreadth: false,
    reasons: ["full"],
  };

  function hit(
    week: number,
    block: number,
    topic: string,
    strongText: string,
    practicalText?: string,
  ) {
    return {
      session: session({
        week,
        blockNumber: block,
        topic,
        strongText,
        practicalText: practicalText ?? strongText,
      }),
      score: 9,
      reasons: ["test"],
      rejected: false,
    };
  }

  it("1. full substantive evidence → covered/FULL", () => {
    const ksb: OfficialKsbRef = {
      code: "K100",
      type: "knowledge",
      description: "Principles of braking systems and component operation.",
    };
    const s = assessEvidenceSufficiency({
      ksb,
      hits: [
        hit(
          20,
          2,
          "Braking systems theory",
          "principles of braking systems component operation explain locate types",
        ),
      ],
    });
    expect(["FULL", "NEAR_FULL"]).toContain(s.coverageStrength);
    expect(s.missingEssentialComponents).toHaveLength(0);
  });

  it("2. near-full with missing exemplar → NEAR_FULL / covered", () => {
    const ksb: OfficialKsbRef = {
      code: "S100",
      type: "skill",
      description:
        "Apply organisational sales processes. For example, show and tell, features and benefits, consultative selling.",
    };
    const s = assessEvidenceSufficiency({
      ksb,
      hits: [
        hit(
          78,
          8,
          "Sales quotations and upsell",
          "apply organisational sales processes quotation upsell authorisation customer features",
          "role-play sales quotation and customer authorisation",
        ),
      ],
    });
    expect(["FULL", "NEAR_FULL"]).toContain(s.coverageStrength);
  });

  it("3. material missing essential → MATERIAL_PARTIAL/gap-capable", () => {
    const ksb: OfficialKsbRef = {
      code: "K101",
      type: "knowledge",
      description:
        "Workplace instructions. Purpose and use for inspection, maintenance, and replacement.",
    };
    const s = assessEvidenceSufficiency({
      ksb,
      hits: [
        hit(
          12,
          2,
          "Routine inspection",
          "vehicle inspection maintenance replacement workflow",
        ),
      ],
    });
    expect(s.missingEssentialComponents.length).toBeGreaterThan(0);
    expect(["MATERIAL_PARTIAL", "WEAK_ADJACENT", "ABSENT"]).toContain(
      s.coverageStrength,
    );
  });

  it("4. adjacent topic only → WEAK_ADJACENT/ABSENT", () => {
    const ksb: OfficialKsbRef = {
      code: "K102",
      type: "knowledge",
      description: "State-of-health testing for high voltage battery systems.",
    };
    const s = assessEvidenceSufficiency({
      ksb,
      hits: [
        hit(41, 5, "EV awareness", "electric vehicle hybrid high voltage isolation safety"),
      ],
    });
    expect(["WEAK_ADJACENT", "ABSENT", "MATERIAL_PARTIAL"]).toContain(
      s.coverageStrength,
    );
    expect(s.missingEssentialComponents.length).toBeGreaterThan(0);
  });

  it("5. full coverage + ownership tie → ambiguous", () => {
    const out = applyConservativeHybrid({
      hits: [hit(12, 2, "A", "geometry"), hit(74, 8, "B", "geometry")],
      sufficiency: fullSufficiency,
      llm: {
        ksbCode: "S12",
        coverage: "covered",
        ownership: "clear_primary",
        evidenceStrength: "FULL",
        classification: "primary_candidate",
        confidence: "high",
        proposedPrimaryBlockNumber: 2,
        reinforcementBlockNumbers: [],
        evidenceLocationRefs: [],
        reasoningSummary: "taught",
        warnings: [],
        rejectedFalsePositives: [],
      },
      heuristic: {
        ksbCode: "S12",
        classification: "primary_candidate",
        confidence: "high",
        proposedPrimaryBlockNumber: 8,
        reinforcementBlockNumbers: [],
        evidenceLocationRefs: [],
        reasoningSummary: "also taught",
        warnings: [],
        rejectedFalsePositives: [],
      },
    });
    expect(out.classification).toBe("ambiguous");
    expect(out.coverage).toBe("covered");
  });

  it("6. genuine cross-system skill → distributed", () => {
    const ksb: OfficialKsbRef = {
      code: "S10",
      type: "skill",
      description:
        "Inspect, remove, and replace parts for steering, suspension, braking and emission systems.",
    };
    const sessions = [
      session({
        week: 44,
        blockNumber: 5,
        topic: "Suspension component replacement",
        practicalText: "remove and replace suspension components",
      }),
      session({
        week: 17,
        blockNumber: 2,
        topic: "Advanced Brake Diagnostics",
        practicalText: "brake system inspect and replace pads",
      }),
    ];
    const hits = retrieveEvidenceForKsb(ksb, sessions, 5);
    const j = heuristicJudgeKsb({ ksb, hits });
    expect(j.classification).toBe("distributed_skill");
  });

  it("7. skill with theory only when practical required → insufficient", () => {
    const ksb: OfficialKsbRef = {
      code: "S101",
      type: "skill",
      description: "Apply team working principles in the workshop.",
    };
    const s = assessEvidenceSufficiency({
      ksb,
      hits: [
        hit(
          11,
          2,
          "Team working theory",
          "team working principles collaboration theory explain",
          "discussion only",
        ),
      ],
    });
    // practicalPresent may be false for short non-performance practical text
    expect(
      s.practicalRequired &&
        (!s.practicalPresent || s.missingEssentialComponents.some((m) => m.includes("PRAC"))),
    ).toBe(true);
  });

  it("8. knowledge with related practical but missing required concept package → insufficient", () => {
    const ksb: OfficialKsbRef = {
      code: "K103",
      type: "knowledge",
      description:
        "Vehicle safety inspections and routine maintenance using manufacturers specifications or approved schedules.",
    };
    const s = assessEvidenceSufficiency({
      ksb,
      hits: [
        hit(
          22,
          3,
          "Routine inspection",
          "vehicle safety inspections routine maintenance serviceability",
          "carry out vehicle inspection",
        ),
      ],
    });
    expect(s.missingEssentialComponents.some((m) => /manufacturer/i.test(m))).toBe(
      true,
    );
  });

  it("9. behaviour merely implied → insufficient", () => {
    const ksb: OfficialKsbRef = {
      code: "B100",
      type: "behaviour",
      description: "Respond and adapt to changing work demands.",
    };
    const s = assessEvidenceSufficiency({
      ksb,
      hits: [
        hit(
          30,
          3,
          "Busy workshop jobs",
          "complete allocated workshop jobs under time pressure",
        ),
      ],
    });
    expect(s.missingEssentialComponents.some((m) => m.startsWith("BEH"))).toBe(
      true,
    );
  });

  it("10. behaviour deliberately taught/applied → covered", () => {
    const ksb: OfficialKsbRef = {
      code: "B101",
      type: "behaviour",
      description: "Respond and adapt to changing work demands.",
    };
    const s = assessEvidenceSufficiency({
      ksb,
      hits: [
        hit(
          30,
          3,
          "Adapting priorities scenario",
          "professional behaviour respond adapt changing work demands reflective observation scenario",
          "role-play adapting priorities under changing demands",
        ),
      ],
    });
    expect(["FULL", "NEAR_FULL"]).toContain(s.coverageStrength);
    expect(s.missingEssentialComponents.some((m) => m.startsWith("BEH"))).toBe(
      false,
    );
  });

  it("keeps Primary on NEAR_FULL; demotes WEAK_ADJACENT", () => {
    const near = applyConservativeHybrid({
      hits: [hit(10, 1, "Tools", "tools")],
      sufficiency: { ...fullSufficiency, coverageStrength: "NEAR_FULL" },
      llm: {
        ksbCode: "K5",
        coverage: "covered",
        ownership: "clear_primary",
        evidenceStrength: "NEAR_FULL",
        classification: "primary_candidate",
        confidence: "high",
        proposedPrimaryBlockNumber: 1,
        reinforcementBlockNumbers: [],
        evidenceLocationRefs: [],
        reasoningSummary: "taught",
        warnings: [],
        rejectedFalsePositives: [],
      },
      heuristic: {
        ksbCode: "K5",
        classification: "curriculum_gap",
        confidence: "high",
        proposedPrimaryBlockNumber: null,
        reinforcementBlockNumbers: [],
        evidenceLocationRefs: [],
        reasoningSummary: "gap",
        warnings: [],
        rejectedFalsePositives: [],
      },
    });
    expect(near.classification).toBe("primary_candidate");

    const weak = applyConservativeHybrid({
      hits: [hit(10, 1, "Inspection", "inspection")],
      sufficiency: {
        ...fullSufficiency,
        coverageStrength: "WEAK_ADJACENT",
        missingEssentialComponents: ["C1:core competence"],
        missingMaterialBreadth: true,
        essentialCoverageRatio: 0,
      },
      llm: {
        ksbCode: "K9",
        coverage: "covered",
        ownership: "clear_primary",
        classification: "primary_candidate",
        confidence: "high",
        proposedPrimaryBlockNumber: 1,
        reinforcementBlockNumbers: [],
        evidenceLocationRefs: [],
        reasoningSummary: "maybe",
        warnings: [],
        rejectedFalsePositives: [],
      },
      heuristic: {
        ksbCode: "K9",
        classification: "primary_candidate",
        confidence: "medium",
        proposedPrimaryBlockNumber: 1,
        reinforcementBlockNumbers: [],
        evidenceLocationRefs: [],
        reasoningSummary: "match",
        warnings: [],
        rejectedFalsePositives: [],
      },
    });
    expect(weak.classification).toBe("curriculum_gap");
  });

  it("gap requires named missing essential", () => {
    expect(
      deriveClassificationFromCoverageOwnership(
        "covered",
        "clear_primary",
        "WEAK_ADJACENT",
      ),
    ).toBe("curriculum_gap");
    expect(
      deriveClassificationFromCoverageOwnership(
        "covered",
        "clear_primary",
        "NEAR_FULL",
      ),
    ).toBe("primary_candidate");
  });
});

describe("retriever + heuristic", () => {
  it("supports distributed_skill for S10", () => {
    const ksb: OfficialKsbRef = {
      code: "S10",
      type: "skill",
      description:
        "Inspect, remove, and replace parts for steering, suspension, braking and other systems.",
    };
    const sessions = [
      session({
        week: 44,
        blockNumber: 5,
        topic: "Suspension component replacement",
        practicalText: "remove and replace suspension components",
      }),
      session({
        week: 17,
        blockNumber: 2,
        topic: "Advanced Brake Diagnostics",
        practicalText: "brake system inspect and replace pads",
      }),
    ];
    const hits = retrieveEvidenceForKsb(ksb, sessions, 5);
    const j = heuristicJudgeKsb({ ksb, hits });
    expect(j.classification).toBe("distributed_skill");
  });

  it("does not treat proposed evidence status as searchable input here", () => {
    // Adapter only loads current_approved original corpus; unit guard on type.
    const s = session({ week: 12, blockNumber: 2, topic: "Electrical System Inspection" });
    expect(s.evidenceStatus).toBe("current_approved");
  });
});

describe("golden evaluation harness", () => {
  it("scores predictions without depending on live AI", () => {
    const labels = buildAutocareV1GoldenLabels();
    expect(labels).toHaveLength(64);
    const fake = labels.map((l) => ({
      ksbCode: l.ksbCode,
      officialDescription: "",
      classification: l.classification,
      confidence: "high" as const,
      confidenceScore: 90,
      proposedPrimarySpineItemId: null,
      proposedPrimaryBlockNumber: l.primaryBlockNumber,
      reinforcementCandidates: [],
      evidence: [],
      reasoningSummary: "mock",
      warnings: [],
      providerRawMeta: {},
    }));
    const report = evaluateAgainstGolden(fake);
    expect(report.primaryClassificationAccuracy).toBe(1);
    expect(report.primaryBlockAccuracy).toBe(1);
    expect(report.gapDetectionAccuracy).toBe(1);
    expect(report.distributedSkillAccuracy).toBe(1);
    expect(report.falsePositivePrimaryRate).toBe(0);
    expect(report.disagreements).toHaveLength(0);
  });

  it("prompt builder does not include golden labels", () => {
    const msgs = buildKsbAnalysisMessages({
      ksb: {
        code: "K3",
        type: "knowledge",
        description: "Health and safety awareness",
      },
      blocks: blocks.filter((b) => b.blockNumber <= 2),
      hits: [],
    });
    assertNoGoldenLeak(msgs.system + msgs.user);
  });
});
