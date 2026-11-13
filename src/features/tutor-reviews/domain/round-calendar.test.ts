import { describe, expect, it } from "vitest";
import { decemberRound, juneRound, roundsToCreate, upcomingRoundWindows } from "./round-calendar";

describe("recurring tutor review rounds", () => {
  it("opens June on the first Monday on or after 7 June and closes the Friday three weeks later", () => {
    expect(juneRound(2027)).toEqual({ label: "June 2027", opensOn: "2027-06-07", closesOn: "2027-06-25" });
    expect(juneRound(2028)).toEqual({ label: "June 2028", opensOn: "2028-06-12", closesOn: "2028-06-30" });
  });

  it("opens December on the first Monday and finishes on a Friday before Christmas", () => {
    expect(decemberRound(2026)).toEqual({ label: "December 2026", opensOn: "2026-12-07", closesOn: "2026-12-18" });
    expect(decemberRound(2027)).toEqual({ label: "December 2027", opensOn: "2027-12-06", closesOn: "2027-12-24" });
  });

  it("keeps the next two upcoming rounds and does not repeat an existing label", () => {
    expect(upcomingRoundWindows("2026-11-13").map((window) => window.label)).toEqual(["December 2026", "June 2027"]);
    expect(upcomingRoundWindows("2026-12-20").map((window) => window.label)).toEqual(["June 2027", "December 2027"]);
    expect(upcomingRoundWindows("2027-06-26").map((window) => window.label)).toEqual(["December 2027", "June 2028"]);
    expect(roundsToCreate("2026-12-20", ["June 2027"]).map((window) => window.label)).toEqual(["December 2027"]);
    expect(roundsToCreate("2026-11-13", ["December 2026", "June 2027"])).toEqual([]);
  });
});
