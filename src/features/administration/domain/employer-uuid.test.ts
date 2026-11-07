import { describe, expect, it } from "vitest";
import { employerUuidFromLegacyId } from "./employer-uuid";

describe("employerUuidFromLegacyId", () => {
  it("reuses a catalogue uuid and ignores blank or non-uuid text", () => {
    expect(employerUuidFromLegacyId("6b1f4c2a-7d3e-4a18-9c0b-1a2b3c4d5e6f")).toBe(
      "6b1f4c2a-7d3e-4a18-9c0b-1a2b3c4d5e6f",
    );
    expect(employerUuidFromLegacyId("")).toBeNull();
    expect(employerUuidFromLegacyId("garage-name")).toBeNull();
  });
});
