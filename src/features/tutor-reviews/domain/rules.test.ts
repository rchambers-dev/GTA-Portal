import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TUTOR_REVIEW_QUESTIONS } from "./catalogue";
import { concernList, formGate, hashReviewToken, inviteCsv, publishStats, storedResponse } from "./rules";

const open = {
  found: true,
  status: "open" as const,
  opensOn: "2026-12-01",
  closesOn: "2026-12-19",
  closedEarly: false,
  used: false,
  today: "2026-12-08",
};

describe("tutor review access", () => {
  it("accepts one unused token only while the round is open", () => {
    expect(formGate(open)).toBe("ready");
    expect(formGate({ ...open, used: true })).toBe("submitted");
    expect(formGate({ ...open, used: true, status: "closed" })).toBe("submitted");
  });

  it("rejects a closed round, an early close, and a date outside the window", () => {
    expect(formGate({ ...open, status: "closed" })).toBe("closed");
    expect(formGate({ ...open, closedEarly: true })).toBe("closed");
    expect(formGate({ ...open, today: "2026-12-20" })).toBe("closed");
    expect(formGate({ ...open, status: "draft" })).toBe("not_open");
    expect(formGate({ ...open, today: "2026-11-30" })).toBe("not_open");
    expect(formGate({ ...open, found: false })).toBe("invalid");
  });

  it("stores a response with no apprentice or invite", () => {
    const row = storedResponse({ roundId: "round", tutorId: "tutor", today: "2026-12-08" });
    expect(Object.keys(row).sort()).toEqual(["roundId", "submittedOn", "tutorId"]);
    expect(row.submittedOn).toBe("2026-12-08");
    expect(hashReviewToken("same")).toBe(hashReviewToken("same"));
    expect(hashReviewToken("same")).not.toBe("same");
  });
});

describe("tutor review report", () => {
  const questions = TUTOR_REVIEW_QUESTIONS.filter((question) => question.code === "01" || question.code === "help" || question.isConcern);

  it("hides averages and comments when a tutor has fewer than 3 responses", () => {
    const hidden = publishStats({
      responseCount: 2,
      previousCount: 5,
      questions,
      ratings: [{ code: "01", values: [5, 4] }],
      previousRatings: [{ code: "01", values: [3, 3, 3, 3, 3] }],
      texts: [{ code: "help", values: ["Keeps it practical"] }],
    });
    expect(hidden.hidden).toBe(true);
    expect(hidden.questions.find((question) => question.code === "01")?.average).toBeNull();
    expect(hidden.questions.find((question) => question.code === "help")?.texts).toEqual([]);
  });

  it("shows the average and the change once both rounds have at least 3 responses", () => {
    const shown = publishStats({
      responseCount: 3,
      previousCount: 3,
      questions,
      ratings: [{ code: "01", values: [5, 4, 3] }],
      previousRatings: [{ code: "01", values: [2, 2, 2] }],
      texts: [
        { code: "help", values: ["Clear examples"] },
        { code: "concern", values: ["Talks over people"] },
      ],
    });
    const rating = shown.questions.find((question) => question.code === "01");
    expect(rating?.average).toBe(4);
    expect(rating?.previousAverage).toBe(2);
    expect(rating?.change).toBe(2);
    expect(shown.questions.find((question) => question.code === "help")?.texts).toEqual(["Clear examples"]);
    expect(shown.questions.find((question) => question.isConcern)?.texts).toEqual(["Talks over people"]);
  });

  it("exports invite links as name, email, and link", () => {
    expect(inviteCsv([{ name: "Ada Lovelace", email: "No email", link: "https://example.test/tutor-review/abc" }])).toBe(
      "name,email,link\nAda Lovelace,No email,https://example.test/tutor-review/abc",
    );
  });

  it("lists a concern by tutor and round only", () => {
    const rows = concernList([
      { tutorName: "Alex Tutor", roundLabel: "December 2026", text: "  Talks over people  " },
      { tutorName: "Alex Tutor", roundLabel: "December 2026", text: "   " },
    ]);
    expect(rows).toEqual([{ tutorName: "Alex Tutor", roundLabel: "December 2026", text: "Talks over people" }]);
    expect(Object.keys(rows[0]).sort()).toEqual(["roundLabel", "text", "tutorName"]);
  });

  it("keeps the migration copy anonymous and worded like the form", () => {
    const sql = readFileSync(new URL("../../../../supabase/migrations/20261113160000_tutor_reviews.sql", import.meta.url), "utf8");
    for (const question of TUTOR_REVIEW_QUESTIONS) expect(sql).toContain(question.text);
    const responses = sql.match(/create table public\.tutor_review_responses \([\s\S]*?\);/)?.[0] ?? "";
    expect(responses).not.toMatch(/apprentice_id|invite_id|created_at/);
    expect(responses).toMatch(/submitted_on date/);
    expect(sql).toContain("'December 2026', '2026-12-01', '2026-12-19', 'draft'");
    expect(sql).toContain("'June 2027', '2027-06-07', '2027-06-25', 'draft'");
  });

  it("keeps the concern question and the three pages", () => {
    expect(TUTOR_REVIEW_QUESTIONS.filter((question) => question.kind === "rating_1_5")).toHaveLength(16);
    expect(TUTOR_REVIEW_QUESTIONS.filter((question) => question.isConcern).map((question) => question.text)).toEqual([
      "Is there anything your tutor does in class that concerns you?",
    ]);
    expect(new Set(TUTOR_REVIEW_QUESTIONS.map((question) => question.page))).toEqual(new Set([1, 2, 3]));
  });
});
