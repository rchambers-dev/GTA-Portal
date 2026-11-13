import { createHash, randomBytes } from "node:crypto";

export type RoundStatus = "draft" | "open" | "closed";

export type FormState = "invalid" | "not_open" | "closed" | "submitted" | "ready";

export type StoredResponse = {
  roundId: string;
  tutorId: string;
  submittedOn: string;
};

const MIN_PUBLISHED = 3;

export function newReviewToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashReviewToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** The public form never stores or returns an apprentice. */
export function formGate(input: {
  found: boolean;
  status: RoundStatus;
  opensOn: string;
  closesOn: string;
  closedEarly: boolean;
  used: boolean;
  today: string;
}): FormState {
  if (!input.found) return "invalid";
  if (input.used) return "submitted";
  if (input.status === "closed" || input.closedEarly || input.today > input.closesOn) return "closed";
  if (input.status !== "open" || input.today < input.opensOn) return "not_open";
  return "ready";
}

export function storedResponse(input: { roundId: string; tutorId: string; today: string }): StoredResponse {
  return { roundId: input.roundId, tutorId: input.tutorId, submittedOn: input.today };
}

export type AnswerStat = {
  code: string;
  text: string;
  kind: "rating_1_5" | "text" | "yes_no";
  isConcern: boolean;
  average: number | null;
  previousAverage: number | null;
  change: number | null;
  texts: string[];
  yesCount: number | null;
  yesAnswered: number | null;
  yesPercent: number | null;
};

function yesPercent(values: boolean[]): number | null {
  if (!values.length) return null;
  return Math.round((values.filter(Boolean).length / values.length) * 100);
}

export function publishStats(input: {
  responseCount: number;
  previousCount: number;
  questions: { code: string; text: string; kind: "rating_1_5" | "text" | "yes_no"; isConcern: boolean }[];
  ratings: { code: string; values: number[] }[];
  previousRatings: { code: string; values: number[] }[];
  texts: { code: string; values: string[] }[];
  yeses?: { code: string; values: boolean[] }[];
  previousYeses?: { code: string; values: boolean[] }[];
}): { hidden: boolean; questions: AnswerStat[] } {
  const hidden = input.responseCount < MIN_PUBLISHED;
  const previousHidden = input.previousCount < MIN_PUBLISHED;
  const questions = input.questions.map((question) => {
    const values = input.ratings.find((row) => row.code === question.code)?.values ?? [];
    const previous = input.previousRatings.find((row) => row.code === question.code)?.values ?? [];
    const average = !hidden && values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
    const previousAverage = !previousHidden && previous.length ? round1(previous.reduce((sum, value) => sum + value, 0) / previous.length) : null;
    const written = input.texts.find((row) => row.code === question.code)?.values.filter((value) => value.trim()) ?? [];
    const yesValues = input.yeses?.find((row) => row.code === question.code)?.values ?? [];
    const previousYes = input.previousYeses?.find((row) => row.code === question.code)?.values ?? [];
    const currentYes = hidden ? null : yesPercent(yesValues);
    const earlierYes = previousHidden ? null : yesPercent(previousYes);
    return {
      ...question,
      average,
      previousAverage,
      change: question.kind === "yes_no"
        ? currentYes != null && earlierYes != null ? currentYes - earlierYes : null
        : average != null && previousAverage != null ? round1(average - previousAverage) : null,
      texts: hidden ? [] : written,
      yesCount: hidden ? null : yesValues.filter(Boolean).length,
      yesAnswered: hidden ? null : yesValues.length,
      yesPercent: currentYes,
    };
  });
  return { hidden, questions };
}

export function concernList(
  rows: { tutorName: string; roundLabel: string; text: string }[],
): { tutorName: string; roundLabel: string; text: string }[] {
  return rows
    .map((row) => ({ tutorName: row.tutorName, roundLabel: row.roundLabel, text: row.text.trim() }))
    .filter((row) => row.text);
}

export { inviteCsv } from "./csv";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
