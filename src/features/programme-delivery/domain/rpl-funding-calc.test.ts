import { describe, expect, it } from "vitest";
import {
  adjustBlockOtj,
  aplFactorFromKsb,
  buildApprenticeFundingPlan,
  clampRplPct,
  sessionsForHours,
} from "./rpl-funding-calc";
import { runWeightedKsbCapV1 } from "@/features/programme-definition/domain/rpl-formulas";

describe("rpl-funding-calc", () => {
  it("clamps RPL to 10% steps", () => {
    expect(clampRplPct(17)).toBe(20);
    expect(clampRplPct(14)).toBe(10);
    expect(clampRplPct(200)).toBe(100);
  });

  it("weights skills highest in the APL factor", () => {
    const skillsHeavy = aplFactorFromKsb({
      knowledgePct: 0,
      skillsPct: 100,
      behavioursPct: 0,
    });
    const knowledgeHeavy = aplFactorFromKsb({
      knowledgePct: 100,
      skillsPct: 0,
      behavioursPct: 0,
    });
    expect(skillsHeavy).toBeCloseTo(0.5);
    expect(knowledgeHeavy).toBeCloseTo(0.3);
    expect(skillsHeavy).toBeGreaterThan(knowledgeHeavy);
  });

  it("caps deduction at 30% of block OTJ", () => {
    const full = adjustBlockOtj(60, {
      knowledgePct: 100,
      skillsPct: 100,
      behavioursPct: 100,
    });
    expect(full.deductionHours).toBe(18);
    expect(full.adjustedOtjHours).toBe(42);
    expect(sessionsForHours(full.adjustedOtjHours)).toBe(7);
  });

  it("builds a funding plan from cohort start without changing delivery end", () => {
    const plan = buildApprenticeFundingPlan({
      cohortStartDate: "2024-09-02",
      deliveryExpectedEndDate: "2027-03-02",
      rplByBlock: {
        2: { knowledgePct: 0, skillsPct: 100, behavioursPct: 0 },
      },
    });
    expect(plan.deliveryExpectedEndDate).toBe("2027-03-02");
    expect(plan.adjustedOtjHours).toBeLessThan(plan.plannedOtjHours);
    expect(plan.fundingExpectedFinishDate).toBeTruthy();
    const block2 = plan.blocks.find((b) => b.blockId === 2);
    expect(block2?.sessions).toBeLessThan(
      sessionsForHours(block2?.plannedOtjHours ?? 0) || 99,
    );
  });
});

/**
 * Golden: delivery adapters must match canonical runWeightedKsbCapV1
 * after 10% steppers (pre-refactor hard-coded values preserved).
 */
describe("rpl-funding-calc ↔ runWeightedKsbCapV1 golden parity", () => {
  const cases: Array<{
    label: string;
    otj: number;
    k: number;
    s: number;
    b: number;
    factor: number;
    deduction: number;
    adjusted: number;
  }> = [
    {
      label: "zero RPL",
      otj: 60,
      k: 0,
      s: 0,
      b: 0,
      factor: 0,
      deduction: 0,
      adjusted: 60,
    },
    {
      label: "full recognition capped",
      otj: 60,
      k: 100,
      s: 100,
      b: 100,
      factor: 1,
      deduction: 18,
      adjusted: 42,
    },
    {
      label: "skills-only under high OTJ",
      otj: 100,
      k: 0,
      s: 100,
      b: 0,
      factor: 0.5,
      deduction: 30,
      adjusted: 70,
    },
    {
      label: "mixed under cap (10% steps already)",
      otj: 80,
      k: 20,
      s: 40,
      b: 10,
      factor: 0.28,
      deduction: 22.4,
      adjusted: 57.6,
    },
    {
      label: "non-step input rounds to 10% then weights",
      otj: 100,
      k: 17, // → 20
      s: 14, // → 10
      b: 5, // → 10
      // factor = (0.3*20 + 0.5*10 + 0.2*10)/100 = 0.13
      factor: 0.13,
      deduction: 13,
      adjusted: 87,
    },
  ];

  for (const c of cases) {
    it(c.label, () => {
      const input = {
        knowledgePct: c.k,
        skillsPct: c.s,
        behavioursPct: c.b,
      };
      const adapted = adjustBlockOtj(c.otj, input);
      expect(adapted.aplFactor).toBeCloseTo(c.factor);
      expect(adapted.deductionHours).toBe(c.deduction);
      expect(adapted.adjustedOtjHours).toBe(c.adjusted);

      const canonical = runWeightedKsbCapV1({
        blockOtjHours: c.otj,
        priorKPercent: clampRplPct(c.k),
        priorSPercent: clampRplPct(c.s),
        priorBPercent: clampRplPct(c.b),
        params: {
          includeAplK: true,
          includeAplS: true,
          includeAplB: true,
          aplWeightK: 0.3,
          aplWeightS: 0.5,
          aplWeightB: 0.2,
          aplMaxFraction: 0.3,
        },
      });
      expect(adapted.aplFactor).toBeCloseTo(canonical.aplFactor);
      expect(adapted.deductionHours).toBe(
        Math.round(canonical.deductionHours * 10) / 10,
      );
      expect(adapted.adjustedOtjHours).toBe(
        Math.round(canonical.adjustedOtjHours * 10) / 10,
      );
    });
  }
});
