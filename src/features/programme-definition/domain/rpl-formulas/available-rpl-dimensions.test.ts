import { describe, expect, it } from "vitest";
import {
  availableRplDimensions,
  officialRplDimensions,
  isProgrammeRplDimensionEnabled,
} from "./available-rpl-dimensions";

describe("officialRplDimensions", () => {
  it("returns K/S/B when all types are present", () => {
    expect(
      officialRplDimensions([
        { type: "knowledge" },
        { type: "skill" },
        { type: "behaviour" },
      ]),
    ).toEqual(["knowledge", "skill", "behaviour"]);
  });

  it("omits behaviours when absent from the official pack", () => {
    expect(
      officialRplDimensions([
        { type: "knowledge" },
        { type: "skill" },
        { type: "knowledge" },
      ]),
    ).toEqual(["knowledge", "skill"]);
  });

  it("returns empty when official pack has no KSBs", () => {
    expect(officialRplDimensions([])).toEqual([]);
  });
});

describe("availableRplDimensions", () => {
  const fullOfficial = [
    { type: "knowledge" as const },
    { type: "skill" as const },
    { type: "behaviour" as const },
  ];

  it("defaults to all official dimensions when programme flags are omitted", () => {
    expect(availableRplDimensions(fullOfficial)).toEqual([
      "knowledge",
      "skill",
      "behaviour",
    ]);
  });

  it("intersects official presence with programme RPL eligibility", () => {
    expect(
      availableRplDimensions(fullOfficial, {
        includeRplKnowledge: true,
        includeRplSkills: true,
        includeRplBehaviours: false,
      }),
    ).toEqual(["knowledge", "skill"]);
  });

  it("cannot enable a dimension missing from the official pack", () => {
    expect(
      availableRplDimensions(
        [{ type: "knowledge" }, { type: "skill" }],
        {
          includeRplKnowledge: true,
          includeRplSkills: true,
          includeRplBehaviours: true,
        },
      ),
    ).toEqual(["knowledge", "skill"]);
  });
});

describe("isProgrammeRplDimensionEnabled", () => {
  it("treats missing flags as enabled", () => {
    expect(isProgrammeRplDimensionEnabled(undefined, "behaviour")).toBe(true);
    expect(isProgrammeRplDimensionEnabled({}, "knowledge")).toBe(true);
  });

  it("honours explicit false", () => {
    expect(
      isProgrammeRplDimensionEnabled(
        { includeRplBehaviours: false },
        "behaviour",
      ),
    ).toBe(false);
  });
});
