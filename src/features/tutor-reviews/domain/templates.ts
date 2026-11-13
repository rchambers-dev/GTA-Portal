import type { Questionnaire, QuestionnaireQuestion } from "./questionnaire";

export type TemplateVersion = {
  id: string;
  label: string;
  isDefault: boolean;
  createdAt: string;
  questionnaire: Questionnaire;
};

export type QuestionDiff = { code: string; detail: string };

export function templateVersionLabel(date: Date, existing: string[]): string {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
  const base = `v ${formatted}`;
  if (!existing.includes(base)) return base;
  let number = 2;
  while (existing.includes(`${base} (${number})`)) number += 1;
  return `${base} (${number})`;
}

export function diffQuestions(before: QuestionnaireQuestion[], after: QuestionnaireQuestion[]): QuestionDiff[] {
  const previous = new Map(before.map((question) => [question.code, question]));
  const next = new Map(after.map((question) => [question.code, question]));
  const changes: QuestionDiff[] = [];
  for (const question of after) {
    const older = previous.get(question.code);
    if (!older) {
      changes.push({ code: question.code, detail: `Added “${question.text || "Untitled question"}”.` });
      continue;
    }
    const notes: string[] = [];
    if (older.text !== question.text) notes.push(`wording is now “${question.text}”`);
    if (older.kind !== question.kind) notes.push(question.kind === "text" ? "it is now a written question" : "it is now a rating from 1 to 5");
    if (older.page !== question.page) notes.push(`it moved to page ${question.page}`);
    if (older.isConcern !== question.isConcern) notes.push(question.isConcern ? "it is now marked as a concern" : "it is no longer marked as a concern");
    if (older.help !== question.help) notes.push("the help text changed");
    if (notes.length) changes.push({ code: question.code, detail: `Changed ${question.code}: ${notes.join("; ")}.` });
  }
  for (const question of before) {
    if (!next.has(question.code)) changes.push({ code: question.code, detail: `Removed “${question.text}”.` });
  }
  return changes;
}

export function latestDefaultVersion(versions: { id: string; isDefault: boolean; createdAt: string }[]): string | null {
  return versions
    .filter((version) => version.isDefault)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id ?? null;
}
