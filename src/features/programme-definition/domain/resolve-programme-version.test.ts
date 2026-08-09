import { describe, expect, it } from "vitest";
import { resolveProgrammeVersionToOpen } from "./programme-definition-store";

const row = (id: string) => ({
  programmeVersionId: id,
  programmeId: `prog-${id}`,
  programmeTitle: "Autocare",
  internalVersion: "1",
  status: "draft",
  standardVersionId: "sv",
  updatedAt: "2026-01-01T00:00:00.000Z",
  primaryCount: 0,
  spineItemCount: 12,
  structuredOtjHours: 611.5,
});

describe("resolveProgrammeVersionToOpen", () => {
  it("returns null when empty (no inventing)", () => {
    expect(resolveProgrammeVersionToOpen([])).toBeNull();
  });

  it("returns the only version when exactly one exists", () => {
    expect(resolveProgrammeVersionToOpen([row("a")])?.programmeVersionId).toBe(
      "a",
    );
  });

  it("does not silently pick newest when multiple exist without preferred", () => {
    expect(
      resolveProgrammeVersionToOpen([row("newer"), row("older")]),
    ).toBeNull();
  });

  it("opens preferred when it is in the multi-version list", () => {
    expect(
      resolveProgrammeVersionToOpen(
        [row("newer"), row("older")],
        "older",
      )?.programmeVersionId,
    ).toBe("older");
  });

  it("returns null when preferred is not in the multi-version list", () => {
    expect(
      resolveProgrammeVersionToOpen([row("a"), row("b")], "missing"),
    ).toBeNull();
  });
});
