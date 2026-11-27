import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath (DEV-229)", () => {
  it("keeps a same-origin relative path", () => {
    expect(safeNextPath("/reviews?from=tutor")).toBe("/reviews?from=tutor");
    expect(safeNextPath("/staff/dashboard")).toBe("/staff/dashboard");
  });

  it("rejects protocol-relative, backslash, scheme, and encoded variants", () => {
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("\\\\evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("%2F%2Fevil.example")).toBe("/");
    expect(safeNextPath("%5C%5Cevil.example")).toBe("/");
    expect(safeNextPath("%252F%252Fevil.example")).toBe("/");
    expect(safeNextPath("/%2Fevil.example")).toBe("/");
  });
});
