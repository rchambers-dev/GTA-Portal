import { describe, expect, it } from "vitest";
import {
  adjustBlockOtj,
  aplFactorFromKsb,
  buildApprenticeFundingPlan,
  clampRplPct,
  sessionsForHours,
} from "./rpl-funding-calc";

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
