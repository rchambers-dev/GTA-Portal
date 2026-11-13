import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  QUESTIONNAIRE_LOCK_REASON,
  copyQuestionnaire,
  moveQuestion,
  publicFormFromPayload,
  questionnaireLock,
  validateQuestionnaire,
  type QuestionnaireQuestion,
} from "./questionnaire";

const questions: QuestionnaireQuestion[] = [
  { code: "01", page: 1, position: 1, text: "First", help: null, kind: "rating_1_5", isConcern: false },
  { code: "02", page: 1, position: 2, text: "Second", help: null, kind: "rating_1_5", isConcern: false },
  { code: "help", page: 3, position: 3, text: "What does your tutor do that helps you learn?", help: null, kind: "text", isConcern: false },
];

const scale = [
  { value: 1, label: "Never" },
  { value: 2, label: "Rarely" },
  { value: 3, label: "Sometimes" },
  { value: 4, label: "Often" },
  { value: 5, label: "Always" },
];

describe("tutor review questionnaire lock", () => {
  it("stays editable until the round has an invite or a response", () => {
    expect(questionnaireLock({ inviteCount: 0, responseCount: 0 })).toEqual({ locked: false, reason: null });
    expect(questionnaireLock({ inviteCount: 1, responseCount: 0 })).toEqual({ locked: true, reason: QUESTIONNAIRE_LOCK_REASON });
    expect(questionnaireLock({ inviteCount: 0, responseCount: 4 })).toEqual({ locked: true, reason: QUESTIONNAIRE_LOCK_REASON });
  });

  it("uses that reason in the database lock", () => {
    const sql = readFileSync(new URL("../../../../supabase/migrations/20261113160000_tutor_reviews.sql", import.meta.url), "utf8");
    expect(sql).toContain(QUESTIONNAIRE_LOCK_REASON);
    expect(sql.match(/Questions are locked because this round already has invites or responses\./g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("reorders questions on one page and copies the questionnaire without an apprentice", () => {
    const moved = moveQuestion(questions, "02", -1);
    expect(moved.find((question) => question.code === "02")?.position).toBe(1);
    expect(moved.find((question) => question.code === "01")?.position).toBe(2);
    expect(moved.find((question) => question.code === "help")?.page).toBe(3);
    const copied = copyQuestionnaire({
      title: "Apprentice tutor review",
      intro: "Think about your sessions with this tutor over the last four weeks.",
      ratingHelp: "Select one rating per statement. Leave blank if you have not experienced it.",
      scale,
      pageHeadings: { 1: null, 2: "Your teaching experience", 3: "Your feedback" },
      questions,
    });
    expect(Object.keys(copied).sort()).toEqual(["intro", "pageHeadings", "questions", "ratingHelp", "scale", "title"]);
    expect(copied.questions).not.toBe(questions);
  });

  it("rejects an empty question and keeps a saved form free of an apprentice", () => {
    const invalid = validateQuestionnaire({
      title: "Apprentice tutor review",
      intro: "Think about your sessions with this tutor over the last four weeks.",
      ratingHelp: "Select one rating per statement. Leave blank if you have not experienced it.",
      scale,
      pageHeadings: { 1: null, 2: "Your teaching experience", 3: "Your feedback" },
      questions: [{ ...questions[0], text: "  " }],
    });
    expect(invalid.ok).toBe(false);
    const form = publicFormFromPayload({
      state: "ready",
      title: "Apprentice tutor review",
      intro: "Think about your sessions with this tutor over the last four weeks.",
      ratingHelp: "Select one rating per statement. Leave blank if you have not experienced it.",
      scale,
      pageHeadings: { 2: "Your teaching experience", 3: "Your feedback" },
      questions,
    });
    expect(form.state).toBe("ready");
    expect(form.pageHeadings[2]).toBe("Your teaching experience");
    expect("apprenticeId" in form).toBe(false);
  });
});
