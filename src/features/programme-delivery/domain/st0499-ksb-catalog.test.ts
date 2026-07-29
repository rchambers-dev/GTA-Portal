/**
 * Smoke tests for ST0499 versioned KSB catalogue + v1.2 → v1.3 skill renumber.
 */
import { describe, expect, it } from "vitest";
import {
  ST0499_KSB_CATALOG,
  diffSt0499KsbVersions,
  latestSt0499KsbVersion,
  st0499KsbForApprenticeshipVersion,
} from "./st0499-ksb-catalog";

describe("ST0499 KSB catalogue", () => {
  it("includes legacy, v1.2 and current v1.3 packs", () => {
    expect(ST0499_KSB_CATALOG.versions.map((v) => v.occupationVersion)).toEqual([
      "1.1",
      "1.2",
      "1.3",
    ]);
  });

  it("maps apprenticeship v1.3 to the approved occupation pack", () => {
    const pack = st0499KsbForApprenticeshipVersion("v1.3");
    expect(pack?.occupationVersion).toBe("1.3");
    expect(pack?.status).toBe("approved");
    expect(pack?.counts).toEqual({
      knowledge: 34,
      skills: 25,
      behaviours: 5,
    });
    expect(latestSt0499KsbVersion().occupationVersion).toBe("1.3");
  });

  it("shows the v1.2 → v1.3 duplicate tyre skill removal", () => {
    const diff = diffSt0499KsbVersions("1.2", "1.3");
    expect(diff).not.toBeNull();
    expect(diff!.removed.map((r) => r.code)).toEqual(["S9"]);
    expect(diff!.removed[0]?.statement.toLowerCase()).toContain(
      "remove and replace vehicle tyre",
    );
    expect(diff!.removed[0]?.statement.toLowerCase()).not.toContain(
      "repair and replace",
    );
    // Former S10 (repair) becomes S9; systems inspection shifts S11 → S10, etc.
    expect(
      diff!.renumbered.some((r) => r.fromCode === "S10" && r.toCode === "S9"),
    ).toBe(true);
    expect(
      diff!.renumbered.some((r) => r.fromCode === "S11" && r.toCode === "S10"),
    ).toBe(true);
    expect(diff!.added).toHaveLength(0);
  });

  it("shows the legacy short list is a different shape entirely", () => {
    const legacy = st0499KsbForApprenticeshipVersion("1.1");
    expect(legacy?.counts).toEqual({
      knowledge: 11,
      skills: 13,
      behaviours: 5,
    });
  });
});
