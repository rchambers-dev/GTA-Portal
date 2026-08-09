import { describe, expect, it } from "vitest";
import { runWeightedKsbCapV1 } from "./weighted-ksb-cap-v1";

/** Frozen Autocare-style params used by legacy delivery adapters. */
const AUTOCAR_PARAMS = {
  includeAplK: true,
  includeAplS: true,
  includeAplB: true,
  aplWeightK: 0.3,
  aplWeightS: 0.5,
  aplWeightB: 0.2,
  aplMaxFraction: 0.3,
} as const;

/**
 * Golden vectors for weighted_ksb_cap_v1.
 * Captured from the pre-consolidation legacy formula so delivery adapters
 * and the canonical runner stay bit-identical for historical inputs.
 */
describe("runWeightedKsbCapV1 golden (legacy Autocare)", () => {
  it("zero RPL leaves hours unchanged", () => {
    const r = runWeightedKsbCapV1({
      blockOtjHours: 60,
      priorKPercent: 0,
      priorSPercent: 0,
      priorBPercent: 0,
      params: AUTOCAR_PARAMS,
    });
    expect(r.aplFactor).toBe(0);
    expect(r.deductionHours).toBe(0);
    expect(r.adjustedOtjHours).toBe(60);
  });

  it("skills-only weight is 0.5", () => {
    const r = runWeightedKsbCapV1({
      blockOtjHours: 100,
      priorKPercent: 0,
      priorSPercent: 100,
      priorBPercent: 0,
      params: AUTOCAR_PARAMS,
    });
    expect(r.aplFactor).toBeCloseTo(0.5);
    expect(r.deductionHours).toBeCloseTo(30); // capped
    expect(r.adjustedOtjHours).toBeCloseTo(70);
  });

  it("knowledge-only weight is 0.3 (uncapped at 30%)", () => {
    const r = runWeightedKsbCapV1({
      blockOtjHours: 100,
      priorKPercent: 100,
      priorSPercent: 0,
      priorBPercent: 0,
      params: AUTOCAR_PARAMS,
    });
    expect(r.aplFactor).toBeCloseTo(0.3);
    expect(r.deductionHours).toBeCloseTo(30);
    expect(r.adjustedOtjHours).toBeCloseTo(70);
  });

  it("caps full recognition at 30% of block OTJ", () => {
    const r = runWeightedKsbCapV1({
      blockOtjHours: 60,
      priorKPercent: 100,
      priorSPercent: 100,
      priorBPercent: 100,
      params: AUTOCAR_PARAMS,
    });
    expect(r.aplFactor).toBeCloseTo(1);
    expect(r.deductionHours).toBeCloseTo(18);
    expect(r.adjustedOtjHours).toBeCloseTo(42);
  });

  it("mixed K/S/B under the cap", () => {
    // factor = (0.3*20 + 0.5*40 + 0.2*10)/100 = 0.28
    const r = runWeightedKsbCapV1({
      blockOtjHours: 80,
      priorKPercent: 20,
      priorSPercent: 40,
      priorBPercent: 10,
      params: AUTOCAR_PARAMS,
    });
    expect(r.aplFactor).toBeCloseTo(0.28);
    expect(r.deductionHours).toBeCloseTo(22.4);
    expect(r.adjustedOtjHours).toBeCloseTo(57.6);
  });

  it("omits disabled letters from the weighted sum", () => {
    const r = runWeightedKsbCapV1({
      blockOtjHours: 100,
      priorKPercent: 100,
      priorSPercent: 100,
      priorBPercent: 100,
      params: {
        ...AUTOCAR_PARAMS,
        includeAplK: false,
        includeAplS: true,
        includeAplB: false,
      },
    });
    expect(r.aplFactor).toBeCloseTo(0.5);
    expect(r.deductionHours).toBeCloseTo(30);
  });
});
