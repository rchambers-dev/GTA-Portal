import { describe, expect, it } from "vitest";
import { checkSummary, contactEventTitle } from "./applicant-record";

describe("applicant record text", () => {
  it("says not yet when a check has not been recorded", () => {
    expect(checkSummary({ code: "id", label: "ID verified", done: false, actualOn: null })).toBe("Not yet");
    expect(checkSummary({ code: "maths", label: "Maths", done: false, actualOn: "2026-11-19", result: "fail" })).toBe("Failed 19 Nov 2026");
    expect(checkSummary({ code: "id", label: "ID verified", done: true, actualOn: "2026-11-19" })).toBe("19 Nov 2026");
  });

  it("uses the saved contact note as the timeline title", () => {
    expect(contactEventTitle({ type: "Call", notes: "Spoke to the applicant." })).toBe("Call: Spoke to the applicant.");
    expect(contactEventTitle(null)).toBe("Contact");
  });
});
