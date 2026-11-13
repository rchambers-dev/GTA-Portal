import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assignedTutorIds, assignedTutorName, daysUntil, roundKpis, tutorIsCounted, tutorResponseRates } from "./dashboard";

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

  it("counts apprentices with no email even when they have not been invited", () => {
    const figures = roundKpis({
      people: [
        { tutorName: "—", invited: false, submitted: false, email: null },
        { tutorName: "Ada", invited: true, submitted: false, email: "a@example.com" },
        { tutorName: "—", invited: false, submitted: false, email: null, isTest: true },
      ],
      failedEmails: 0,
      concerns: 0,
    });
    expect(figures.noEmail).toBe(1);
    expect(figures.invited).toBe(1);
  });

  it("counts invited and active tutors on an open assignment, and leaves disabled or archived tutors out", () => {
    const profiles = [
      { id: "anne", portalStatus: "active", archivedAt: null },
      { id: "dan", portalStatus: "invited", archivedAt: null },
      { id: "old", portalStatus: "disabled", archivedAt: null },
      { id: "gone", portalStatus: "active", archivedAt: "2026-01-01" },
    ];
    expect(tutorIsCounted(profiles[0])).toBe(true);
    expect(tutorIsCounted(profiles[1])).toBe(true);
    expect(tutorIsCounted(profiles[2])).toBe(false);
    expect(tutorIsCounted(profiles[3])).toBe(false);
    const ids = assignedTutorIds(
      [{ tutorId: "anne" }, { tutorId: "dan" }, { tutorId: "old" }, { tutorId: "gone" }],
      profiles,
    );
    expect([...ids].sort()).toEqual(["anne", "dan"]);
    const tutors = [
      { id: "anne", name: "Anne-Marie Sanderson" },
      { id: "dan", name: "Dan Hanmer" },
    ];
    expect(assignedTutorName("dan", tutors)).toBe("Dan Hanmer");
    expect(assignedTutorName("old", tutors)).toBe("—");
    expect(assignedTutorName(null, tutors)).toBe("—");
  });

  it("shows an active tutor at 0% before anyone is invited", () => {
    expect(tutorResponseRates([], ["Anne-Marie Sanderson"])).toEqual([
      { tutorName: "Anne-Marie Sanderson", invited: 0, submitted: 0, rate: 0 },
    ]);
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

  it("counts every open tutor assignment in the dashboard views", () => {
    const sql = readFileSync(new URL("../../../../supabase/migrations/20261113220000_tutor_review_assigned_tutors.sql", import.meta.url), "utf8");
    expect(sql).toContain("tutor_review_tutor_response_rates");
    expect(sql).toContain("tutor_review_tutor_scores");
    expect(sql).toContain("end_date is null");
    expect(sql).toContain("archived_at is null");
    expect(sql).toContain("portal_status is distinct from 'disabled'");
    expect(sql).toContain("is_test is not true");
    expect(sql).not.toContain("portal_status = 'active'");
  });
});
