import { PAGE_HEADINGS, RATING_HELP, RATING_SCALE, TUTOR_REVIEW_INTRO, TUTOR_REVIEW_TITLE, type ReviewQuestionKind } from "./catalogue";

export type ReviewPage = 1 | 2 | 3;

export type ScalePoint = { value: number; label: string };

export type QuestionnaireQuestion = {
  code: string;
  page: ReviewPage;
  position: number;
  text: string;
  help: string | null;
  kind: ReviewQuestionKind;
  isConcern: boolean;
};

export type PageHeadings = Record<ReviewPage, string | null>;

export type Questionnaire = {
  title: string;
  intro: string;
  ratingHelp: string;
  scale: ScalePoint[];
  pageHeadings: PageHeadings;
  questions: QuestionnaireQuestion[];
};

export const QUESTIONNAIRE_LOCK_REASON = "Questions are locked because this round already has invites or responses.";

export function questionnaireLock(input: { inviteCount: number; responseCount: number }): { locked: boolean; reason: string | null } {
  if (input.inviteCount > 0 || input.responseCount > 0) {
    return { locked: true, reason: QUESTIONNAIRE_LOCK_REASON };
  }
  return { locked: false, reason: null };
}

export function defaultPageHeadings(): PageHeadings {
  return { 1: PAGE_HEADINGS[1], 2: PAGE_HEADINGS[2], 3: PAGE_HEADINGS[3] };
}

export function readPageHeadings(value: unknown): PageHeadings {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const heading = (page: ReviewPage) => {
    const text = source[String(page)];
    if (typeof text !== "string") return null;
    const trimmed = text.trim();
    return trimmed || null;
  };
  return { 1: heading(1), 2: heading(2), 3: heading(3) };
}

export function readScale(value: unknown): ScalePoint[] {
  if (!Array.isArray(value) || value.length !== 5) {
    return RATING_SCALE.map((item) => ({ value: item.value, label: item.label }));
  }
  return value.map((item, index) => {
    const row = item && typeof item === "object" ? (item as { value?: unknown; label?: unknown }) : {};
    const label = typeof row.label === "string" ? row.label.trim() : "";
    return { value: index + 1, label: label || RATING_SCALE[index].label };
  });
}

export function asReviewPage(value: unknown): ReviewPage {
  const page = Number(value);
  if (page === 2 || page === 3) return page;
  return 1;
}

export function questionnaireFromParts(input: {
  title: string | null;
  intro: string | null;
  ratingHelp: string | null;
  scale: unknown;
  pageHeadings: unknown;
  questions: { code: string; page: number; position: number; text: string; help: string | null; kind: string; isConcern: boolean }[];
}): Questionnaire {
  return {
    title: input.title?.trim() || TUTOR_REVIEW_TITLE,
    intro: input.intro?.trim() || TUTOR_REVIEW_INTRO,
    ratingHelp: input.ratingHelp?.trim() || RATING_HELP,
    scale: readScale(input.scale),
    pageHeadings: readPageHeadings(input.pageHeadings),
    questions: [...input.questions]
      .sort((a, b) => a.position - b.position)
      .map((question, index) => ({
        code: question.code,
        page: asReviewPage(question.page),
        position: index + 1,
        text: question.text,
        help: question.help?.trim() || null,
        kind: question.kind === "text" ? "text" : question.kind === "yes_no" ? "yes_no" : "rating_1_5",
        isConcern: question.isConcern,
      })),
  };
}

export function copyQuestionnaire(source: Questionnaire): Questionnaire {
  return {
    title: source.title,
    intro: source.intro,
    ratingHelp: source.ratingHelp,
    scale: source.scale.map((item) => ({ ...item })),
    pageHeadings: { ...source.pageHeadings },
    questions: source.questions.map((question) => ({ ...question })),
  };
}

export function nextQuestionCode(codes: string[]): string {
  let number = codes.length + 1;
  let code = `q${String(number).padStart(2, "0")}`;
  while (codes.includes(code)) {
    number += 1;
    code = `q${String(number).padStart(2, "0")}`;
  }
  return code;
}

export function renumberQuestions(questions: QuestionnaireQuestion[]): QuestionnaireQuestion[] {
  return [...questions]
    .sort((a, b) => a.page - b.page || a.position - b.position || a.code.localeCompare(b.code))
    .map((question, index) => ({ ...question, position: index + 1 }));
}

export function insertQuestion(questions: QuestionnaireQuestion[], afterCode: string | null, question: QuestionnaireQuestion): QuestionnaireQuestion[] {
  const ordered = renumberQuestions(questions);
  const index = afterCode ? ordered.findIndex((item) => item.code === afterCode) : -1;
  const next = [...ordered];
  next.splice(index + 1, 0, question);
  return renumberQuestions(next);
}

export function duplicateQuestion(questions: QuestionnaireQuestion[], code: string): QuestionnaireQuestion[] {
  const source = questions.find((question) => question.code === code);
  if (!source) return questions;
  const copy: QuestionnaireQuestion = {
    ...source,
    code: nextQuestionCode(questions.map((question) => question.code)),
    text: source.text,
  };
  return insertQuestion(questions, code, copy);
}

export function moveQuestion(questions: QuestionnaireQuestion[], code: string, direction: -1 | 1): QuestionnaireQuestion[] {
  const current = questions.find((question) => question.code === code);
  if (!current) return questions;
  const siblings = questions.filter((question) => question.page === current.page).sort((a, b) => a.position - b.position);
  const index = siblings.findIndex((question) => question.code === code);
  const neighbor = siblings[index + direction];
  if (!neighbor) return questions;
  return questions.map((question) => {
    if (question.code === code) return { ...question, position: neighbor.position };
    if (question.code === neighbor.code) return { ...question, position: current.position };
    return question;
  });
}

export function validateQuestionnaire(input: Questionnaire): { ok: true; value: Questionnaire } | { ok: false; error: string } {
  const title = input.title.trim();
  const intro = input.intro.trim();
  const ratingHelp = input.ratingHelp.trim();
  if (!title) return { ok: false, error: "Add a title." };
  if (!intro) return { ok: false, error: "Add an introduction." };
  if (!ratingHelp) return { ok: false, error: "Add the rating help text." };
  if (input.scale.length !== 5 || input.scale.some((item) => !item.label.trim())) {
    return { ok: false, error: "Each point on the rating scale needs a label." };
  }
  if (!input.questions.length) return { ok: false, error: "Add at least one question." };
  if (input.questions.some((question) => !question.text.trim())) return { ok: false, error: "Each question needs some text." };
  const codes = input.questions.map((question) => question.code);
  if (new Set(codes).size !== codes.length) return { ok: false, error: "Each question needs its own code." };
  const questions = [...input.questions]
    .sort((a, b) => a.position - b.position || a.code.localeCompare(b.code))
    .map((question, index) => ({
      ...question,
      position: index + 1,
      text: question.text.trim(),
      help: question.help?.trim() || null,
      page: asReviewPage(question.page),
      kind: question.kind === "text" ? "text" as const : question.kind === "yes_no" ? "yes_no" as const : "rating_1_5" as const,
      isConcern: Boolean(question.isConcern),
    }));
  return {
    ok: true,
    value: {
      title,
      intro,
      ratingHelp,
      scale: input.scale.map((item, index) => ({ value: index + 1, label: item.label.trim() })),
      pageHeadings: readPageHeadings(input.pageHeadings),
      questions,
    },
  };
}

export type PublicForm = {
  state: "invalid" | "not_open" | "closed" | "submitted" | "ready" | "unavailable";
  title: string;
  intro: string;
  ratingHelp: string;
  scale: ScalePoint[];
  pageHeadings: PageHeadings;
  questions: QuestionnaireQuestion[];
};

export function blankPublicForm(state: PublicForm["state"]): PublicForm {
  return {
    state,
    title: TUTOR_REVIEW_TITLE,
    intro: "",
    ratingHelp: RATING_HELP,
    scale: RATING_SCALE.map((item) => ({ value: item.value, label: item.label })),
    pageHeadings: defaultPageHeadings(),
    questions: [],
  };
}

export function publicFormFromPayload(payload: unknown): PublicForm {
  const row = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const state = row.state;
  const known = state === "invalid" || state === "not_open" || state === "closed" || state === "submitted" || state === "ready" ? state : "invalid";
  const questions = Array.isArray(row.questions) ? row.questions : [];
  const form = questionnaireFromParts({
    title: typeof row.title === "string" ? row.title : null,
    intro: typeof row.intro === "string" ? row.intro : null,
    ratingHelp: typeof row.ratingHelp === "string" ? row.ratingHelp : null,
    scale: row.scale,
    pageHeadings: row.pageHeadings,
    questions: questions.map((item) => {
      const question = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        code: String(question.code ?? ""),
        page: Number(question.page),
        position: Number(question.position),
        text: String(question.text ?? ""),
        help: typeof question.help === "string" ? question.help : null,
        kind: String(question.kind ?? ""),
        isConcern: Boolean(question.isConcern),
      };
    }),
  });
  return { state: known, ...form };
}

export function questionHelp(question: QuestionnaireQuestion, ratingHelp: string): string | null {
  if (!question.help) return null;
  if (question.kind === "rating_1_5" && question.help === ratingHelp) return null;
  return question.help;
}
