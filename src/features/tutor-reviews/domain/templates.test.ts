import { describe, expect, it } from "vitest";
import { diffQuestions, latestDefaultVersion, templateVersionLabel } from "./templates";
import { duplicateQuestion, insertQuestion } from "./questionnaire";
import type { QuestionnaireQuestion } from "./questionnaire";
import { excludeTestApprentices } from "@/features/administration/domain/test-apprentice";

const base: QuestionnaireQuestion = {
  code: "01",
  page: 1,
  position: 1,
  text: "My tutor clearly explains what I need to do before I start a task.",
  help: null,
  kind: "rating_1_5",
  isConcern: false,
};

describe("form template versions", () => {
  it("labels a version by the London date and does not reuse a label", () => {
    expect(templateVersionLabel(new Date("2026-11-13T12:00:00Z"), [])).toBe("v 13 Nov 2026");
    expect(templateVersionLabel(new Date("2026-11-13T18:00:00Z"), ["v 13 Nov 2026"])).toBe("v 13 Nov 2026 (2)");
  });

  it("describes question changes without rewriting the older version", () => {
    const changes = diffQuestions(
      [base],
      [{ ...base, text: "My tutor explains the task first." }, { ...base, code: "02", position: 2, text: "A new question.", kind: "text" }],
    );
    expect(changes.map((change) => change.detail)).toEqual([
      "Changed 01: wording is now “My tutor explains the task first.”.",
      "Added “A new question.”.",
    ]);
  });

  it("picks the newest version marked as the default", () => {
    expect(latestDefaultVersion([
      { id: "old", isDefault: true, createdAt: "2026-11-01T00:00:00Z" },
      { id: "new", isDefault: true, createdAt: "2026-11-13T00:00:00Z" },
      { id: "other", isDefault: false, createdAt: "2026-11-20T00:00:00Z" },
    ])).toBe("new");
  });

  it("inserts and duplicates a question without losing the others", () => {
    const inserted = insertQuestion([base], "01", { ...base, code: "02", text: "Second" });
    expect(inserted.map((question) => question.code)).toEqual(["01", "02"]);
    const copied = duplicateQuestion(inserted, "01");
    expect(copied).toHaveLength(3);
    expect(copied[1]?.text).toBe(base.text);
    expect(copied[1]?.code).not.toBe("01");
  });
});

describe("test apprentices", () => {
  it("drops test apprentices from lists and totals", () => {
    expect(excludeTestApprentices([
      { gta_id: "GTA-000001", is_test: false },
      { gta_id: "GTA-000002", is_test: true },
      { gta_id: "GTA-000003" },
    ]).map((row) => row.gta_id)).toEqual(["GTA-000001", "GTA-000003"]);
  });
});
