import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { formatApprenticeName } from "@/features/administration/domain/apprentice-record";
import type { ReviewQuestionKind } from "./catalogue";
import { blankPublicForm, publicFormFromPayload, questionnaireFromParts, type PublicForm, type Questionnaire } from "./questionnaire";
import { excludeTestApprentices } from "@/features/administration/domain/test-apprentice";
import { emailPlan, type EmailAttemptStatus, type EmailPlan } from "./email";
import { concernList, publishStats, type AnswerStat, type RoundStatus } from "./rules";

export type TutorReviewRound = {
  id: string;
  label: string;
  opensOn: string;
  closesOn: string;
  status: RoundStatus;
  closedEarly: boolean;
  title: string;
  intro: string;
  inviteCount: number;
  responseCount: number;
  questionnaire: Questionnaire;
  emailPlan: EmailPlan;
  templateVersionId: string | null;
  snapshotted: boolean;
};

export type TrackerRow = {
  roundId: string;
  apprenticeId: string;
  name: string;
  email: string | null;
  tutorId: string | null;
  tutorName: string;
  invited: boolean;
  submitted: boolean;
};

export type ReportCard = {
  tutorId: string;
  tutorName: string;
  roundId: string;
  roundLabel: string;
  previousLabel: string | null;
  invited: number;
  submitted: number;
  responseCount: number;
  hidden: boolean;
  questions: AnswerStat[];
};

export type ConcernItem = { tutorName: string; roundLabel: string; text: string };

export type EmailAttemptRow = {
  id: string;
  roundId: string;
  apprenticeId: string;
  email: string;
  status: EmailAttemptStatus;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type TutorReviewsPage = {
  loadError: string | null;
  rounds: TutorReviewRound[];
  tracker: TrackerRow[];
  reports: ReportCard[];
  concerns: ConcernItem[];
  attempts: EmailAttemptRow[];
  emailQueueReady: boolean;
  templates: { id: string; label: string; isDefault: boolean; createdAt: string; questionnaire: Questionnaire }[];
  templatesReady: boolean;
};

export type { PublicForm, Questionnaire };

const MISSING = "Tutor reviews are not available until the database migration is applied.";

function missingTable(message: string | undefined): boolean {
  return /tutor_review_|does not exist|schema cache/i.test(message || "");
}

export async function loadTutorReviewsPage(): Promise<TutorReviewsPage> {
  const empty: TutorReviewsPage = { loadError: null, rounds: [], tracker: [], reports: [], concerns: [], attempts: [], emailQueueReady: false, templates: [], templatesReady: false };
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : MISSING;
    return { ...empty, loadError: /supabase|tutor_review_|does not exist|schema cache/i.test(message) ? MISSING : message };
  }
  const roundColumns = "id, label, opens_on, closes_on, status, closed_early_at, title, intro, rating_help, scale, page_headings";
  const richRounds = await supabase.from("tutor_review_rounds").select(`${roundColumns}, template_version_id, snapshotted_at`).order("opens_on");
  const roundsResult = richRounds.error && /template_version_id|snapshotted_at/i.test(richRounds.error.message)
    ? await supabase.from("tutor_review_rounds").select(roundColumns).order("opens_on")
    : richRounds;
  if (roundsResult.error) {
    return { ...empty, loadError: missingTable(roundsResult.error.message) ? MISSING : roundsResult.error.message };
  }
  const roundRows = (roundsResult.data ?? []) as {
    id: string;
    label: string;
    opens_on: string;
    closes_on: string;
    status: RoundStatus;
    closed_early_at: string | null;
    title: string;
    intro: string;
    rating_help: string;
    scale: unknown;
    page_headings: unknown;
    template_version_id?: string | null;
    snapshotted_at?: string | null;
  }[];
  const rounds = roundRows.map((row) => ({
    id: row.id,
    label: row.label,
    opensOn: row.opens_on,
    closesOn: row.closes_on,
    status: row.status,
    closedEarly: Boolean(row.closed_early_at),
    title: row.title,
    intro: row.intro,
  }));

  const [questionsResult, invitesResult, peopleResult, tutorsResult, profilesResult, responsesResult, answersResult] = await Promise.all([
    supabase.from("tutor_review_questions").select("id, round_id, page, position, code, text, help, kind, is_concern").order("position"),
    supabase.from("tutor_review_invites").select("round_id, apprentice_id, tutor_id, used_at"),
    supabase.from("apprentices").select("gta_id, first_name, middle_names, last_name, email"),
    supabase.from("apprentice_tutors").select("apprentice_id, tutor_id, start_date").is("end_date", null),
    supabase.from("profiles").select("id, display_name"),
    supabase.from("tutor_review_responses").select("id, round_id, tutor_id, submitted_on"),
    supabase.from("tutor_review_answers").select("response_id, question_id, rating, text_answer"),
  ]);
  for (const result of [questionsResult, invitesResult, peopleResult, tutorsResult, profilesResult, responsesResult, answersResult]) {
    if (result.error) return { ...empty, loadError: result.error.message };
  }

  const names = new Map(((profilesResult.data ?? []) as { id: string; display_name: string | null }[]).map((row) => [row.id, row.display_name?.trim() || "Tutor"]));
  const currentTutor = new Map<string, { tutorId: string; start: string }>();
  for (const row of (tutorsResult.data ?? []) as { apprentice_id: string; tutor_id: string; start_date: string }[]) {
    const current = currentTutor.get(row.apprentice_id);
    if (!current || row.start_date > current.start) currentTutor.set(row.apprentice_id, { tutorId: row.tutor_id, start: row.start_date });
  }
  const invites = (invitesResult.data ?? []) as { round_id: string; apprentice_id: string; tutor_id: string; used_at: string | null }[];
  const people = excludeTestApprentices((peopleResult.data ?? []) as { gta_id: string; first_name: string; middle_names: string | null; last_name: string; email: string | null; is_test?: boolean | null }[]);
  const testFlag = await supabase.from("apprentices").select("gta_id, is_test").eq("is_test", true);
  const testIds = testFlag.error ? new Set<string>() : new Set(((testFlag.data ?? []) as { gta_id: string }[]).map((row) => row.gta_id));
  const tracker: TrackerRow[] = [];
  for (const round of rounds) {
    for (const person of people) {
      if (testIds.has(person.gta_id)) continue;
      const invite = invites.find((row) => row.round_id === round.id && row.apprentice_id === person.gta_id);
      const tutorId = invite?.tutor_id ?? currentTutor.get(person.gta_id)?.tutorId ?? null;
      if (!invite && !tutorId) continue;
      tracker.push({
        roundId: round.id,
        apprenticeId: person.gta_id,
        name: formatApprenticeName({ firstName: person.first_name, middleNames: person.middle_names, lastName: person.last_name }),
        email: person.email,
        tutorId,
        tutorName: tutorId ? names.get(tutorId) || "Tutor" : "No tutor",
        invited: Boolean(invite),
        submitted: Boolean(invite?.used_at),
      });
    }
  }

  const questions = (questionsResult.data ?? []) as { id: string; round_id: string; page: number; code: string; text: string; help: string | null; kind: ReviewQuestionKind; is_concern: boolean; position: number }[];
  const responses = (responsesResult.data ?? []) as { id: string; round_id: string; tutor_id: string }[];
  const answers = (answersResult.data ?? []) as { response_id: string; question_id: string; rating: number | null; text_answer: string | null }[];
  const yesResult = await supabase.from("tutor_review_answers").select("response_id, question_id, yes_answer");
  const yesAnswers = yesResult.error ? [] : (yesResult.data ?? []) as { response_id: string; question_id: string; yes_answer: boolean | null }[];
  const reports: ReportCard[] = [];
  const concernRows: { tutorName: string; roundLabel: string; text: string }[] = [];
  const ordered = [...rounds].sort((a, b) => a.opensOn.localeCompare(b.opensOn));
  for (const round of ordered) {
    const previous = ordered.filter((item) => item.opensOn < round.opensOn).at(-1) ?? null;
    const tutorIds = new Set<string>([
      ...invites.filter((row) => row.round_id === round.id).map((row) => row.tutor_id),
      ...responses.filter((row) => row.round_id === round.id).map((row) => row.tutor_id),
    ]);
    for (const tutorId of tutorIds) {
      const roundResponses = responses.filter((row) => row.round_id === round.id && row.tutor_id === tutorId);
      const previousResponses = previous ? responses.filter((row) => row.round_id === previous.id && row.tutor_id === tutorId) : [];
      const roundQuestions = questions.filter((question) => question.round_id === round.id).sort((a, b) => a.position - b.position);
      const previousQuestions = previous ? questions.filter((question) => question.round_id === previous.id) : [];
      const ratingsFor = (rows: { id: string }[], sourceQuestions: typeof questions) =>
        roundQuestions.filter((question) => question.kind === "rating_1_5").map((question) => ({
          code: question.code,
          values: rows.flatMap((response) => {
            const match = sourceQuestions.find((item) => item.code === question.code);
            return answers.filter((answer) => answer.response_id === response.id && answer.question_id === match?.id && answer.rating != null).map((answer) => answer.rating as number);
          }),
        }));
      const texts = roundQuestions.filter((question) => question.kind === "text").map((question) => ({
        code: question.code,
        values: roundResponses.flatMap((response) => answers.filter((answer) => answer.response_id === response.id && answer.question_id === question.id && answer.text_answer).map((answer) => answer.text_answer as string)),
      }));
      const yesFor = (rows: { id: string }[], sourceQuestions: typeof questions) =>
        roundQuestions.filter((question) => question.kind === "yes_no").map((question) => ({
          code: question.code,
          values: rows.flatMap((response) => {
            const match = sourceQuestions.find((item) => item.code === question.code);
            return yesAnswers.filter((answer) => answer.response_id === response.id && answer.question_id === match?.id && answer.yes_answer != null).map((answer) => Boolean(answer.yes_answer));
          }),
        }));
      const published = publishStats({
        responseCount: roundResponses.length,
        previousCount: previousResponses.length,
        questions: roundQuestions.map((question) => ({ code: question.code, text: question.text, kind: question.kind, isConcern: question.is_concern })),
        ratings: ratingsFor(roundResponses, roundQuestions),
        previousRatings: ratingsFor(previousResponses, previousQuestions),
        texts,
        yeses: yesFor(roundResponses, roundQuestions),
        previousYeses: yesFor(previousResponses, previousQuestions),
      });
      const invited = tracker.filter((row) => row.tutorId === tutorId && invites.some((invite) => invite.round_id === round.id && invite.apprentice_id === row.apprenticeId)).length;
      reports.push({
        tutorId,
        tutorName: names.get(tutorId) || "Tutor",
        roundId: round.id,
        roundLabel: round.label,
        previousLabel: previous?.label ?? null,
        invited,
        submitted: tracker.filter((row) => row.tutorId === tutorId && row.submitted && invites.some((invite) => invite.round_id === round.id && invite.apprentice_id === row.apprenticeId)).length,
        responseCount: roundResponses.length,
        hidden: published.hidden,
        questions: published.questions,
      });
      for (const question of roundQuestions.filter((item) => item.is_concern)) {
        for (const value of texts.find((row) => row.code === question.code)?.values ?? []) {
          concernRows.push({ tutorName: names.get(tutorId) || "Tutor", roundLabel: round.label, text: value });
        }
      }
    }
  }

  const attemptsResult = await supabase.from("tutor_review_email_attempts").select("id, round_id, apprentice_id, email, status, error, attempt_no, created_at, sent_at").order("created_at", { ascending: false });
  let emailQueueReady = true;
  let attemptRows: EmailAttemptRow[] = [];
  if (attemptsResult.error) {
    if (!missingTable(attemptsResult.error.message)) return { ...empty, loadError: attemptsResult.error.message };
    emailQueueReady = false;
  } else {
    attemptRows = ((attemptsResult.data ?? []) as { id: string; round_id: string; apprentice_id: string; email: string; status: EmailAttemptStatus; error: string | null; created_at: string; sent_at: string | null }[]).map((row) => ({
      id: row.id,
      roundId: row.round_id,
      apprenticeId: row.apprentice_id,
      email: row.email,
      status: row.status,
      error: row.error,
      createdAt: row.created_at,
      sentAt: row.sent_at,
    }));
  }
  const latestStatus = new Map<string, EmailAttemptStatus>();
  for (const attempt of attemptRows) {
    const key = `${attempt.roundId}:${attempt.apprenticeId}`;
    if (!latestStatus.has(key)) latestStatus.set(key, attempt.status);
  }

  const fullRounds = rounds.map((round) => {
    const source = roundRows.find((row) => row.id === round.id);
    return {
      ...round,
      inviteCount: invites.filter((row) => row.round_id === round.id).length,
      responseCount: responses.filter((row) => row.round_id === round.id).length,
      questionnaire: questionnaireFromParts({
        title: source?.title ?? round.title,
        intro: source?.intro ?? round.intro,
        ratingHelp: source?.rating_help ?? null,
        scale: source?.scale,
        pageHeadings: source?.page_headings,
        questions: questions.filter((question) => question.round_id === round.id).map((question) => ({
          code: question.code,
          page: question.page,
          position: question.position,
          text: question.text,
          help: question.help,
          kind: question.kind,
          isConcern: question.is_concern,
        })),
      }),
      templateVersionId: source?.template_version_id ?? null,
      snapshotted: Boolean(source?.snapshotted_at),
      emailPlan: emailPlan(people.flatMap((person) => {
        if (testIds.has(person.gta_id)) return [];
        const tutorId = currentTutor.get(person.gta_id)?.tutorId;
        if (!tutorId) return [];
        const invite = invites.find((row) => row.round_id === round.id && row.apprentice_id === person.gta_id);
        return [{
          email: person.email,
          submitted: Boolean(invite?.used_at),
          latestStatus: latestStatus.get(`${round.id}:${person.gta_id}`) ?? null,
        }];
      })),
    };
  });

  const templateResult = await supabase.from("tutor_review_template_versions").select("id, label, is_default, created_at, title, intro, rating_help, scale, page_headings").order("created_at");
  const templateQuestions = templateResult.error ? { data: [], error: templateResult.error } : await supabase.from("tutor_review_template_questions").select("version_id, page, position, code, text, help, kind, is_concern").order("position");
  const templatesReady = !templateResult.error && !templateQuestions.error;
  const templateRows = templatesReady ? (templateResult.data ?? []) as {
    id: string; label: string; is_default: boolean; created_at: string; title: string; intro: string; rating_help: string; scale: unknown; page_headings: unknown;
  }[] : [];
  const templateQuestionRows = (templateQuestions.data ?? []) as { version_id: string; page: number; position: number; code: string; text: string; help: string | null; kind: string; is_concern: boolean }[];
  const templates = templateRows.map((version) => ({
    id: version.id,
    label: version.label,
    isDefault: version.is_default,
    createdAt: version.created_at,
    questionnaire: questionnaireFromParts({
      title: version.title,
      intro: version.intro,
      ratingHelp: version.rating_help,
      scale: version.scale,
      pageHeadings: version.page_headings,
      questions: templateQuestionRows.filter((question) => question.version_id === version.id).map((question) => ({
        code: question.code,
        page: question.page,
        position: question.position,
        text: question.text,
        help: question.help,
        kind: question.kind,
        isConcern: question.is_concern,
      })),
    }),
  }));

  return { loadError: null, rounds: fullRounds, tracker, reports, concerns: concernList(concernRows), attempts: attemptRows, emailQueueReady, templates, templatesReady };
}

export async function readPublicForm(token: string): Promise<PublicForm> {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return blankPublicForm("unavailable");
  }
  const result = await supabase.rpc("get_tutor_review_form", { p_token: token });
  if (result.error) return blankPublicForm("unavailable");
  return publicFormFromPayload(result.data);
}

export async function readStaffPreview(roundId: string): Promise<PublicForm | null> {
  if (!/^[0-9a-f-]{36}$/i.test(roundId)) return null;
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return blankPublicForm("unavailable");
  }
  const [roundResult, questionsResult] = await Promise.all([
    supabase.from("tutor_review_rounds").select("title, intro, rating_help, scale, page_headings").eq("id", roundId).maybeSingle(),
    supabase.from("tutor_review_questions").select("code, page, position, text, help, kind, is_concern").eq("round_id", roundId).order("position"),
  ]);
  if (roundResult.error || questionsResult.error) return blankPublicForm("unavailable");
  const round = roundResult.data as { title: string; intro: string; rating_help: string; scale: unknown; page_headings: unknown } | null;
  if (!round) return null;
  const questions = (questionsResult.data ?? []) as { code: string; page: number; position: number; text: string; help: string | null; kind: string; is_concern: boolean }[];
  return {
    state: "ready",
    ...questionnaireFromParts({
      title: round.title,
      intro: round.intro,
      ratingHelp: round.rating_help,
      scale: round.scale,
      pageHeadings: round.page_headings,
      questions: questions.map((question) => ({ ...question, isConcern: question.is_concern })),
    }),
  };
}
