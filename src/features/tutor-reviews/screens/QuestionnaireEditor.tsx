"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  copyQuestionnaire,
  moveQuestion,
  nextQuestionCode,
  questionnaireLock,
  type Questionnaire,
  type QuestionnaireQuestion,
  type ReviewPage,
} from "../domain/questionnaire";
import { saveTutorReviewQuestionnaireAction } from "./actions";
import styles from "./tutor-reviews.module.css";

const PAGES: ReviewPage[] = [1, 2, 3];

export function QuestionnaireEditor({
  roundId,
  label,
  inviteCount,
  responseCount,
  questionnaire,
  sources,
}: {
  roundId: string;
  label: string;
  inviteCount: number;
  responseCount: number;
  questionnaire: Questionnaire;
  sources: { id: string; label: string; questionnaire: Questionnaire }[];
}) {
  const router = useRouter();
  const lock = questionnaireLock({ inviteCount, responseCount });
  const [draft, setDraft] = useState(questionnaire);
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const disabled = lock.locked || pending;

  function updateQuestion(code: string, patch: Partial<QuestionnaireQuestion>) {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question) => (question.code === code ? { ...question, ...patch } : question)),
    }));
  }

  return (
    <section className={styles.card}>
      <div className={styles.sectionHead}>
        <div>
          <h2>Questionnaire · {label}</h2>
          <p className={styles.muted}>Edit the title, introduction, rating scale, page headings, and questions. This stays open until the round has an invite or a response.</p>
        </div>
        <a className={styles.secondary} href={`/tutor-review/preview/${roundId}`} target="_blank" rel="noreferrer">Preview</a>
      </div>
      {lock.locked ? <p className={styles.error}>{lock.reason}</p> : null}
      <label className={styles.field}>
        Title
        <input value={draft.title} disabled={disabled} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
      </label>
      <label className={styles.field}>
        Introduction
        <textarea value={draft.intro} disabled={disabled} onChange={(event) => setDraft((current) => ({ ...current, intro: event.target.value }))} />
      </label>
      <label className={styles.field}>
        Rating help
        <textarea value={draft.ratingHelp} disabled={disabled} onChange={(event) => setDraft((current) => ({ ...current, ratingHelp: event.target.value }))} />
      </label>
      <div className={styles.scaleEdit}>
        {draft.scale.map((point) => (
          <label key={point.value} className={styles.field}>
            {point.value}
            <input
              value={point.label}
              disabled={disabled}
              onChange={(event) => setDraft((current) => ({
                ...current,
                scale: current.scale.map((item) => item.value === point.value ? { ...item, label: event.target.value } : item),
              }))}
            />
          </label>
        ))}
      </div>
      {PAGES.map((page) => (
        <div key={page} className={styles.pageBlock}>
          <h3>Page {page}</h3>
          <label className={styles.field}>
            Page heading
            <input
              value={draft.pageHeadings[page] ?? ""}
              placeholder="No heading"
              disabled={disabled}
              onChange={(event) => setDraft((current) => ({
                ...current,
                pageHeadings: { ...current.pageHeadings, [page]: event.target.value },
              }))}
            />
          </label>
          {draft.questions.filter((question) => question.page === page).sort((a, b) => a.position - b.position).map((question) => (
            <article key={question.code} className={styles.editorQuestion}>
              <label className={styles.field}>
                Question
                <textarea value={question.text} disabled={disabled} onChange={(event) => updateQuestion(question.code, { text: event.target.value })} />
              </label>
              <label className={styles.field}>
                Help
                <textarea value={question.help ?? ""} disabled={disabled} onChange={(event) => updateQuestion(question.code, { help: event.target.value })} />
              </label>
              <div className={styles.actions}>
                <label className={styles.fieldInline}>
                  Page
                  <select value={question.page} disabled={disabled} onChange={(event) => updateQuestion(question.code, { page: Number(event.target.value) as ReviewPage })}>
                    {PAGES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label className={styles.fieldInline}>
                  Type
                  <select
                    value={question.kind}
                    disabled={disabled}
                    onChange={(event) => updateQuestion(question.code, { kind: event.target.value === "text" ? "text" : "rating_1_5" })}
                  >
                    <option value="rating_1_5">Rating 1–5</option>
                    <option value="text">Written</option>
                  </select>
                </label>
                <label className={styles.fieldInline}>
                  <input
                    type="checkbox"
                    checked={question.isConcern}
                    disabled={disabled}
                    onChange={(event) => updateQuestion(question.code, { isConcern: event.target.checked })}
                  />
                  Concern
                </label>
                <button type="button" className={styles.secondary} disabled={disabled} onClick={() => setDraft((current) => ({ ...current, questions: moveQuestion(current.questions, question.code, -1) }))}>Up</button>
                <button type="button" className={styles.secondary} disabled={disabled} onClick={() => setDraft((current) => ({ ...current, questions: moveQuestion(current.questions, question.code, 1) }))}>Down</button>
                <button type="button" className={styles.secondary} disabled={disabled} onClick={() => setDraft((current) => ({ ...current, questions: current.questions.filter((item) => item.code !== question.code) }))}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      ))}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          disabled={disabled}
          onClick={() => setDraft((current) => ({
            ...current,
            questions: [...current.questions, {
              code: nextQuestionCode(current.questions.map((question) => question.code)),
              page: 1,
              position: current.questions.length + 1,
              text: "",
              help: null,
              kind: "rating_1_5",
              isConcern: false,
            }],
          }))}
        >
          Add question
        </button>
        <label className={styles.fieldInline}>
          Copy from
          <select value={sourceId} disabled={disabled || !sources.length} onChange={(event) => setSourceId(event.target.value)}>
            {sources.length ? sources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>) : <option value="">No earlier round</option>}
          </select>
        </label>
        <button
          type="button"
          className={styles.secondary}
          disabled={disabled || !sources.some((source) => source.id === sourceId)}
          onClick={() => {
            const source = sources.find((item) => item.id === sourceId);
            if (!source) return;
            setDraft(copyQuestionnaire(source.questionnaire));
            setNotice(`Copied questions from ${source.label}. Save to keep them on this round.`);
          }}
        >
          Copy questions from a previous round
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={disabled}
          onClick={() => {
            setError(null);
            setNotice(null);
            startTransition(async () => {
              const result = await saveTutorReviewQuestionnaireAction(roundId, draft);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setNotice("Questionnaire saved.");
              router.refresh();
            });
          }}
        >
          Save questionnaire
        </button>
      </div>
      {notice ? <p className={styles.muted}>{notice}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  );
}
