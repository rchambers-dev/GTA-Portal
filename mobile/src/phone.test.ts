import { describe, expect, it } from "vitest";
import { normalisePhone, phoneToStore } from "./phone";

describe("UK phone normalisation", () => {
  it.each([
    ["07700 900123", "+447700900123"],
    ["07700900123", "+447700900123"],
    ["+44 7700 900123", "+447700900123"],
    ["+44 (0) 7700 900123", "+447700900123"],
    ["0044 7700 900123", "+447700900123"],
    ["447700900123", "+447700900123"],
    ["(01302) 893277", "+441302893277"],
    ["01302 000000", "+441302000000"],
    ["020 7946 0958", "+442079460958"],
    ["01302 893277 ext 12", "+441302893277"],
  ])("normalises %s to %s", (input, expected) => {
    expect(normalisePhone(input)).toEqual({ e164: expected, display: expected });
    expect(phoneToStore(input)).toBe(expected);
  });

  it("keeps an already international non-UK number", () => {
    expect(normalisePhone("+1 202 555 0143")).toEqual({
      e164: "+12025550143",
      display: "+12025550143",
    });
  });

  it("keeps a cleaned number when it is not a UK or E.164 number", () => {
    expect(normalisePhone("123 456 789")).toEqual({
      e164: null,
      display: "123456789",
    });
  });

  it.each([null, undefined, "", "   ", "n/a", "call the office", "12345"])(
    "drops %s",
    (input) => {
      expect(normalisePhone(input)).toEqual({ e164: null, display: null });
      expect(phoneToStore(input)).toBeNull();
    },
  );
});
