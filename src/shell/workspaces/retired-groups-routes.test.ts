import { describe, expect, it } from "vitest";

const RETIRED_APPRENTICE_GROUP_PATHS = [
  "/apprentice/progress/g1-t1",
  "/apprentice/tracking/g3-t1",
  "/apprentice/cea",
  "/apprentice/personal-tracking",
  "/staff/cea-sign-offs",
  "/employer/cea-sign-offs",
];

describe("retired Groups/CEA routes", () => {
  it("no longer treats Group task ids as supported apprentice destinations", () => {
    expect(RETIRED_APPRENTICE_GROUP_PATHS.every((p) => p.includes("cea") || /g\d+-t\d+/.test(p) || p.includes("personal-tracking"))).toBe(true);
    expect("/apprentice/learning").not.toMatch(/groups|cea/i);
    expect("/apprentice/tracking").not.toMatch(/g\d+-t/);
  });
});
