"use client";

import { useMemo, useState, useTransition } from "react";
import { questionHelp, type PublicForm, type ReviewPage } from "../domain/questionnaire";
import { submitTutorReviewAction } from "./actions";
import styles from "./tutor-reviews.module.css";

const MESSAGES: Record<string, string> = {
  invalid: "This link is not valid.",
  not_open: "This review is not open yet.",
  closed: "This review is closed.",
  submitted: "This review has already been submitted.",
  unavailable: "This form is not available.",
};

export function TutorReviewForm({ token, form, preview = false, embedded = false }: { token?: string; form: PublicForm; preview?: boolean; embedded?: boolean }) {
  const [state, setState] = useState(form.state);
  const [page, setPage] = useState<ReviewPage>(1);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [yeses, setYeses] = useState<Record<string, boolean>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const questions = useMemo(() => form.questions.filter((question) => question.page === page).sort((a, b) => a.position - b.position), [form.questions, page]);
  const heading = form.pageHeadings[page];
  const showScale = questions.some((question) => question.kind === "rating_1_5");

  if (state !== "ready") {
    return (
      <main className={embedded ? `${styles.form} ${styles.formEmbedded}` : styles.form}>
        <div className={`${styles.formInner} ${styles.card}`}>
          <h1>{form.title}</h1>
          <p className={styles.lead}>{MESSAGES[state] ?? MESSAGES.unavailable}</p>
        </div>
      </main>
    );
  }

  return (
    <main className={embedded ? `${styles.form} ${styles.formEmbedded}` : styles.form}>
      <form
        className={`${styles.formInner} ${styles.card}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (preview) return;
          if (page < 3) {
            setPage((page + 1) as ReviewPage);
            return;
          }
          const answers = [
            ...Object.entries(ratings).map(([code, rating]) => ({ code, rating })),
            ...Object.entries(yeses).map(([code, yes]) => ({ code, yes })),
            ...Object.entries(texts).filter(([, text]) => text.trim()).map(([code, text]) => ({ code, text })),
          ];
          startTransition(async () => {
            const result = await submitTutorReviewAction(token ?? "", answers);
            setState(result.state === "submitted" ? "submitted" : result.state);
          });
        }}
      >
        {preview ? <p className={styles.previewBanner}>Preview</p> : null}
        {preview ? <p className={styles.help}>Nothing you enter here is saved.</p> : null}
        <h1>{form.title}</h1>
        <p className={styles.lead}>{form.intro}</p>
        <p className={styles.progress}>Page {page} of 3</p>
        {heading ? <h2>{heading}</h2> : null}
        {showScale ? (
          <>
            <p className={styles.help}>{form.ratingHelp}</p>
            <div className={styles.scale} aria-hidden="true">
              {form.scale.map((item) => <span key={item.value} className={styles.pill}>{item.value} {item.label}</span>)}
            </div>
          </>
        ) : null}
        {questions.map((question) => {
          const help = questionHelp(question, form.ratingHelp);
          return (
            <fieldset key={question.code} className={styles.statement}>
              <legend>{question.text}</legend>
              {help ? <p className={styles.help}>{help}</p> : null}
              {question.kind === "yes_no" ? (
                <div className={styles.yesNo}>
                  {([true, false] as const).map((value) => (
                    <label key={String(value)} className={styles.choice}>
                      <input
                        type="radio"
                        name={question.code}
                        checked={yeses[question.code] === value}
                        onChange={() => setYeses((current) => ({ ...current, [question.code]: value }))}
                        onClick={() => {
                          if (yeses[question.code] !== value) return;
                          setYeses((current) => {
                            const next = { ...current };
                            delete next[question.code];
                            return next;
                          });
                        }}
                      />
                      {value ? "Yes" : "No"}
                    </label>
                  ))}
                </div>
              ) : question.kind === "rating_1_5" ? (
                <div className={styles.scale}>
                  {form.scale.map((item) => (
                    <label key={item.value} className={styles.choice}>
                      <input
                        type="radio"
                        name={question.code}
                        value={item.value}
                        checked={ratings[question.code] === item.value}
                        onChange={() => setRatings((current) => ({ ...current, [question.code]: item.value }))}
                        onClick={() => {
                          if (ratings[question.code] !== item.value) return;
                          setRatings((current) => {
                            const next = { ...current };
                            delete next[question.code];
                            return next;
                          });
                        }}
                      />
                      {item.value} {item.label}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  className={styles.textarea}
                  value={texts[question.code] ?? ""}
                  onChange={(event) => setTexts((current) => ({ ...current, [question.code]: event.target.value }))}
                />
              )}
            </fieldset>
          );
        })}
        <div className={styles.pager}>
          <button type="button" className={styles.secondary} disabled={page === 1 || pending} onClick={() => setPage((page - 1) as ReviewPage)}>
            Back
          </button>
          {page < 3 ? (
            <button type="button" className={styles.primary} onClick={() => setPage((page + 1) as ReviewPage)}>
              Next
            </button>
          ) : (
            <button type="submit" className={styles.primary} disabled={pending || preview}>
              {pending ? "Submitting" : "Submit review"}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
