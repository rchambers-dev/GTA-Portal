import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daysUntil, roundKpis, tutorResponseRates } from "./dashboard";

describe("tutor review dashboard figures", () => {
  it("leaves test apprentices out of the round totals", () => {
    const figures = roundKpis({
      people: [
        { tutorName: "Ada", invited: true, submitted: true, email: "a@example.com" },
        { tutorName: "Ada", invited: true, submitted: false, email: null },
        { tutorName: "Ada", invited: true, submitted: true, email: "test@example.com", isTest: true },
      ],
      failedEmails: 2,
      concerns: 1,
    });
    expect(figures).toEqual({ invited: 2, submitted: 1, responseRate: 50, noEmail: 1, failedEmails: 2, concerns: 1 });
  });

  it("rates each tutor from real invites only", () => {
    expect(tutorResponseRates([
      { tutorName: "Ada", invited: true, submitted: true, email: "a@example.com" },
      { tutorName: "Grace", invited: true, submitted: false, email: "g@example.com" },
      { tutorName: "Ada", invited: true, submitted: true, email: "t@example.com", isTest: true },
    ])).toEqual([
      { tutorName: "Ada", invited: 1, submitted: 1, rate: 100 },
      { tutorName: "Grace", invited: 1, submitted: 0, rate: 0 },
    ]);
  });

  it("describes the days until a round opens or closes", () => {
    expect(daysUntil("2026-11-13", "2026-12-01", "2026-12-19")).toBe("Opens in 18 days");
    expect(daysUntil("2026-12-19", "2026-12-01", "2026-12-19")).toBe("Closes today");
    expect(daysUntil("2026-12-20", "2026-12-01", "2026-12-19")).toBe("Closed");
  });

  it("keeps test responses out of the dashboard views", () => {
    const sql = readFileSync(new URL("../../../../supabase/migrations/20261113210000_tutor_review_website_form.sql", import.meta.url), "utf8");
    expect(sql).toContain("tutor_review_round_kpis");
    expect(sql).toContain("tutor_review_tutor_response_rates");
    expect(sql).toContain("tutor_review_tutor_scores");
    expect(sql).toContain("is_test is not true");
    expect(sql).toContain("v 13 Nov 2026 (2)");
    expect(sql).not.toContain("example.com");
  });
});
