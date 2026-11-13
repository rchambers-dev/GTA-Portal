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
  kind: "rating_1_5" | "text";
  isConcern: boolean;
  average: number | null;
  previousAverage: number | null;
  change: number | null;
  texts: string[];
};

export function publishStats(input: {
  responseCount: number;
  previousCount: number;
  questions: { code: string; text: string; kind: "rating_1_5" | "text"; isConcern: boolean }[];
  ratings: { code: string; values: number[] }[];
  previousRatings: { code: string; values: number[] }[];
  texts: { code: string; values: string[] }[];
}): { hidden: boolean; questions: AnswerStat[] } {
  const hidden = input.responseCount < MIN_PUBLISHED;
  const previousHidden = input.previousCount < MIN_PUBLISHED;
  const questions = input.questions.map((question) => {
    const values = input.ratings.find((row) => row.code === question.code)?.values ?? [];
    const previous = input.previousRatings.find((row) => row.code === question.code)?.values ?? [];
    const average = !hidden && values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
    const previousAverage = !previousHidden && previous.length ? round1(previous.reduce((sum, value) => sum + value, 0) / previous.length) : null;
    const written = input.texts.find((row) => row.code === question.code)?.values.filter((value) => value.trim()) ?? [];
    return {
      ...question,
      average,
      previousAverage,
      change: average != null && previousAverage != null ? round1(average - previousAverage) : null,
      texts: hidden ? [] : written,
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
