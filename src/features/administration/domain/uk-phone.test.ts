import { describe, expect, it } from "vitest";
import { normalisePhone, validateContactPhone } from "./uk-phone";

describe("learner phone numbers", () => {
  it.each([
    ["07700 900123", "+447700900123"],
    ["+44 (0) 7700 900123", "+447700900123"],
    ["0044 7700 900123", "+447700900123"],
    ["(01302) 893277", "+441302893277"],
    ["01302 893277 ext 12", "+441302893277"],
    ["020 7946 0958", "+442079460958"],
    ["+1 202 555 0143", "+12025550143"],
  ])("normalises %s to %s", (input, expected) => {
    expect(validateContactPhone(input)).toEqual({ ok: true, phone: expected });
    expect(normalisePhone(input).e164).toBe(expected);
  });

  it("keeps a blank phone empty", () => {
    expect(validateContactPhone("  ")).toEqual({ ok: true, phone: null });
    expect(validateContactPhone(null)).toEqual({ ok: true, phone: null });
  });

  it("rejects text and numbers that are too short to be a UK phone", () => {
    expect(validateContactPhone("n/a").ok).toBe(false);
    expect(validateContactPhone("12345").ok).toBe(false);
  });
});
