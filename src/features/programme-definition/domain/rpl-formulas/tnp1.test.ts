import { describe, expect, it } from "vitest";
import {
  calculateFixedCostTotal,
  calculateTnp1,
  createFixedCostLine,
  normalizeFixedCostLines,
  validateFixedCostLine,
} from "./tnp1";

describe("calculateFixedCostTotal", () => {
  it("sums only enabled lines", () => {
    const lines = [
      createFixedCostLine({ label: "A", amountPounds: 100, sequence: 0 }),
      {
        ...createFixedCostLine({ label: "B", amountPounds: 50, sequence: 1 }),
        enabled: false,
      },
      createFixedCostLine({ label: "C", amountPounds: 25, sequence: 2 }),
    ];
    expect(calculateFixedCostTotal(lines)).toBe(125);
  });
});

describe("createFixedCostLine", () => {
  it("allows a blank draft label for Programme Builder add-row", () => {
    const line = createFixedCostLine({
      label: "",
      amountPounds: 0,
      sequence: 0,
    });
    expect(line.label).toBe("");
    expect(line.amountPounds).toBe(0);
    expect(line.enabled).toBe(true);
    expect(line.id).toBeTruthy();
  });
});

describe("normalizeFixedCostLines", () => {
  it("keeps draft rows with blank labels so editors are not wiped", () => {
    const lines = normalizeFixedCostLines([
      { id: "a", label: "", amountPounds: 10, enabled: true, sequence: 0 },
      { id: "b", label: "EPA", amountPounds: 400, enabled: true, sequence: 1 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.label).toBe("");
    expect(lines[1]?.label).toBe("EPA");
  });
});

describe("validateFixedCostLine", () => {
  it("can require a label when asked", () => {
    const result = validateFixedCostLine(
      { label: "  ", amountPounds: 0 },
      { requireLabel: true },
    );
    expect(result.ok).toBe(false);
  });
});

describe("calculateTnp1", () => {
  it("derives TNP1 from remaining curriculum value without reducing fixed costs", () => {
    // Toy aligned with Phase 1 example scale:
    // band 13000, fixed 3376, programme value 120, remaining 117
    const lines = [
      createFixedCostLine({ label: "Fixed bundle", amountPounds: 3376 }),
    ];
    const result = calculateTnp1({
      fundingBandPounds: 13000,
      fixedCostLines: lines,
      programmeCurriculumValue: 120,
      remainingProgrammeValue: 117,
      recognisedProgrammeValue: 3,
    });

    expect(result.allocatable).toBe(true);
    expect(result.fixedCostTotal).toBe(3376);
    expect(result.variableCostPot).toBe(9624);
    expect(result.poundsPerCurriculumUnit).toBeCloseTo(80.2);
    expect(result.remainingVariableCost).toBeCloseTo(117 * 80.2);
    expect(result.recognisedVariableCost).toBeCloseTo(3 * 80.2);
    expect(result.tnp1).toBeCloseTo(3376 + 117 * 80.2);
    // Fixed unchanged when recognition increases
    expect(result.fixedCostTotal).toBe(3376);
  });

  it("blocks when funding band is missing", () => {
    const result = calculateTnp1({
      fundingBandPounds: null,
      fixedCostLines: [],
      programmeCurriculumValue: 10,
      remainingProgrammeValue: 10,
    });
    expect(result.allocatable).toBe(false);
    expect(result.tnp1).toBeNull();
  });

  it("blocks when fixed costs exceed the band", () => {
    const result = calculateTnp1({
      fundingBandPounds: 1000,
      fixedCostLines: [
        createFixedCostLine({ label: "Too much", amountPounds: 1500 }),
      ],
      programmeCurriculumValue: 10,
      remainingProgrammeValue: 10,
    });
    expect(result.allocatable).toBe(false);
    expect(result.variableCostPot).toBe(-500);
    expect(result.tnp1).toBeNull();
  });

  it("blocks when curriculum value is zero", () => {
    const result = calculateTnp1({
      fundingBandPounds: 1000,
      fixedCostLines: [],
      programmeCurriculumValue: 0,
      remainingProgrammeValue: 0,
    });
    expect(result.allocatable).toBe(false);
  });

  it("100% recognition leaves TNP1 equal to fixed only", () => {
    const result = calculateTnp1({
      fundingBandPounds: 10000,
      fixedCostLines: [
        createFixedCostLine({ label: "Fixed", amountPounds: 2000 }),
      ],
      programmeCurriculumValue: 50,
      remainingProgrammeValue: 0,
      recognisedProgrammeValue: 50,
    });
    expect(result.allocatable).toBe(true);
    expect(result.remainingVariableCost).toBe(0);
    expect(result.tnp1).toBe(2000);
  });
});
