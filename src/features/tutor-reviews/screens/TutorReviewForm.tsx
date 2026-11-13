"use client";

import { useMemo, useState, useTransition } from "react";
import { questionHelp, type PublicForm, type ReviewPage } from "../domain/questionnaire";
import { canSubmitReview } from "../domain/slider";
import { submitTutorReviewAction } from "./actions";
import { RatingSlider } from "./RatingSlider";
import styles from "./website-form.module.css";

const MESSAGES: Record<string, string> = {
  invalid: "This link is not valid.",
  not_open: "This review is not open yet.",
  closed: "This review is closed.",
  submitted: "This review has already been submitted.",
  unavailable: "This form is not available.",
};

const DISCLAIMER = "No personal details are asked for in this review. Your answers are confidential and stored without your name.";

export function TutorReviewForm({ token, form, preview = false, embedded = false }: { token?: string; form: PublicForm; preview?: boolean; embedded?: boolean }) {
  const [state, setState] = useState(form.state);
  const [page, setPage] = useState<ReviewPage>(1);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [yeses, setYeses] = useState<Record<string, boolean>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const questions = useMemo(() => form.questions.filter((question) => question.page === page && question.code !== "concern_note").sort((a, b) => a.position - b.position), [form.questions, page]);
  const concernNote = form.questions.find((question) => question.code === "concern_note");
  const heading = form.pageHeadings[page];

  function submit() {
    if (preview || !canSubmitReview(page, true)) return;
    const answers = [
      ...Object.entries(ratings).map(([code, rating]) => ({ code, rating })),
      ...Object.entries(yeses).map(([code, yes]) => ({ code, yes })),
      ...Object.entries(texts).filter(([, text]) => text.trim()).map(([code, text]) => ({ code, text })),
    ];
    startTransition(async () => {
      const result = await submitTutorReviewAction(token ?? "", answers);
      setState(result.state === "submitted" ? "submitted" : result.state);
    });
  }

  return (
    <div className={embedded ? undefined : styles.page}>
      {embedded ? null : (
        <>
          <header className={styles.header}>
            <div className={styles.headerInner}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.logo} src="/brand/doncaster-gta.png" alt="Doncaster, Rotherham and District Group Training Association" />
              <p className={styles.wordmark}>
                Group Training Association
                <span>Tutor review</span>
              </p>
            </div>
          </header>
          <div className={styles.accent} />
        </>
      )}
      <div className={embedded ? undefined : styles.wrap}>
        <p className={styles.disclaimer}>{DISCLAIMER}</p>
        <div className={styles.card}>
          {state !== "ready" ? (
            <>
              <h1>{form.title}</h1>
              <p className={styles.lead}>{MESSAGES[state] ?? MESSAGES.unavailable}</p>
            </>
          ) : (
            <form
              onSubmit={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "TEXTAREA") event.preventDefault();
              }}
            >
              {preview ? <p className={styles.closes}>Preview. Nothing you enter here is saved.</p> : null}
              {form.roundLabel ? <p className={styles.roundLine}>{form.roundLabel}</p> : null}
              {form.closesOn ? <p className={styles.closes}>Closes {closesLabel(form.closesOn)}</p> : null}
              <p className={styles.progressLabel}>Page {page} of 3</p>
              <div className={styles.bar} aria-hidden="true"><span style={{ width: `${(page / 3) * 100}%` }} /></div>
              <h1>{form.title}</h1>
              <p className={styles.lead}>{form.intro}</p>
              {heading ? <h2>{heading}</h2> : null}
              {questions.map((question) => {
                const help = questionHelp(question, form.ratingHelp);
                const showConcernNote = question.code === "concern" && question.kind === "yes_no" && yeses[question.code] === true;
                return (
                  <fieldset key={question.code} className={styles.statement}>
                    <legend>{question.text}</legend>
                    {help && question.kind !== "yes_no" ? <p className={styles.help}>{help}</p> : null}
                    {question.kind === "yes_no" ? (
                      <div className={styles.yesNo}>
                        <button type="button" className={yeses[question.code] === true ? `${styles.yes} ${styles.yesOn}` : styles.yes} aria-pressed={yeses[question.code] === true} onClick={() => setYeses((current) => toggleYes(current, question.code, true))}>Yes</button>
                        <button type="button" className={yeses[question.code] === false ? `${styles.no} ${styles.noOn}` : styles.no} aria-pressed={yeses[question.code] === false} onClick={() => setYeses((current) => toggleYes(current, question.code, false))}>No</button>
                      </div>
                    ) : null}
                    {question.kind === "rating_1_5" ? (
                      <RatingSlider name={question.text} value={ratings[question.code] ?? null} onChange={(next) => setRatings((current) => setRating(current, question.code, next))} />
                    ) : null}
                    {question.kind === "text" ? (
                      <textarea className={styles.textarea} value={texts[question.code] ?? ""} onChange={(event) => setTexts((current) => ({ ...current, [question.code]: event.target.value }))} />
                    ) : null}
                    {showConcernNote ? (
                      <>
                        <p className={styles.help}>{concernNote?.help || question.help}</p>
                        <textarea className={styles.textarea} value={texts[concernNote?.code ?? "concern_note"] ?? ""} onChange={(event) => setTexts((current) => ({ ...current, [concernNote?.code ?? "concern_note"]: event.target.value }))} />
                      </>
                    ) : null}
                  </fieldset>
                );
              })}
              <div className={styles.pager}>
                <button type="button" className={styles.secondary} disabled={page === 1 || pending} onClick={() => setPage((page - 1) as ReviewPage)}>Back</button>
                {page < 3 ? (
                  <button type="button" className={styles.primary} onClick={() => setPage((page + 1) as ReviewPage)}>Next</button>
                ) : (
                  <button type="button" className={styles.primary} disabled={pending || preview} onClick={submit}>{pending ? "Submitting" : "Submit review"}</button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function toggleYes(current: Record<string, boolean>, code: string, value: boolean) {
  if (current[code] === value) {
    const next = { ...current };
    delete next[code];
    return next;
  }
  return { ...current, [code]: value };
}

function setRating(current: Record<string, number>, code: string, value: number | null) {
  const next = { ...current };
  if (value == null) delete next[code];
  else next[code] = value;
  return next;
}

function closesLabel(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12)));
}
