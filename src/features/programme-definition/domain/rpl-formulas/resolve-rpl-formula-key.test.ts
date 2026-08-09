import { describe, expect, it } from "vitest";
import {
  defaultBlockKsbValueProgrammeParams,
  resolveRplFormulaKey,
} from "./index";

describe("resolveRplFormulaKey", () => {
  it("keeps explicit block_ksb_value_v1", () => {
    expect(resolveRplFormulaKey("block_ksb_value_v1")).toBe(
      "block_ksb_value_v1",
    );
  });

  it("keeps explicit weighted_ksb_cap_v1", () => {
    expect(resolveRplFormulaKey("weighted_ksb_cap_v1")).toBe(
      "weighted_ksb_cap_v1",
    );
  });

  it("defaults missing/null/empty to block_ksb_value_v1", () => {
    expect(resolveRplFormulaKey(null)).toBe("block_ksb_value_v1");
    expect(resolveRplFormulaKey(undefined)).toBe("block_ksb_value_v1");
    expect(resolveRplFormulaKey("")).toBe("block_ksb_value_v1");
  });

  it("throws on unknown/corrupt keys (never silent legacy)", () => {
    expect(() => resolveRplFormulaKey("not_a_real_formula")).toThrow(
      /Unknown RPL formula key/,
    );
    expect(() => resolveRplFormulaKey(42)).toThrow(/Unknown RPL formula key/);
  });

  it("new programme defaults still use block_ksb_value_v1", () => {
    expect(defaultBlockKsbValueProgrammeParams().formulaKey).toBe(
      "block_ksb_value_v1",
    );
  });
});
