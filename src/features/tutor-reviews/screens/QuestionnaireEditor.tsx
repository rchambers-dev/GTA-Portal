"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TutorReviewForm } from "./TutorReviewForm";
import {
  duplicateQuestion,
  insertQuestion,
  moveQuestion,
  nextQuestionCode,
  renumberQuestions,
  validateQuestionnaire,
  type Questionnaire,
  type QuestionnaireQuestion,
  type ReviewPage,
} from "../domain/questionnaire";
import { diffQuestions, type QuestionDiff } from "../domain/templates";
import { saveTemplateVersionAction, setRoundTemplateAction, setTemplateDefaultAction } from "./actions";
import styles from "./tutor-reviews.module.css";

const PAGES: ReviewPage[] = [1, 2, 3];

type VersionRow = {
  id: string;
  label: string;
  isDefault: boolean;
  createdAt: string;
  questionnaire: Questionnaire;
};

export function QuestionnaireEditor({
  roundId,
  snapshotted,
  templateVersionId,
  versions,
  templatesReady,
}: {
  roundId: string;
  snapshotted: boolean;
  templateVersionId: string | null;
  versions: VersionRow[];
  templatesReady: boolean;
}) {
  const router = useRouter();
  const selected = versions.find((version) => version.id === templateVersionId) ?? versions.find((version) => version.isDefault) ?? versions.at(-1) ?? null;
  const [draft, setDraft] = useState<Questionnaire | null>(selected?.questionnaire ?? null);
  const [saved, setSaved] = useState(JSON.stringify(selected?.questionnaire ?? null));
  const [deleted, setDeleted] = useState<QuestionnaireQuestion | null>(null);
  const [dragCode, setDragCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const unsaved = JSON.stringify(draft) !== saved;
  const history = useMemo(() => versions.map((version, index) => ({
    ...version,
    changes: index === 0 ? [] : diffQuestions(versions[index - 1].questionnaire.questions, version.questionnaire.questions),
  })), [versions]);

  if (!templatesReady) {
    return <p className={styles.muted}>Form templates are not available until the database migration is applied.</p>;
  }
  if (!draft || !selected) {
    return <p className={styles.muted}>No form template has been saved yet.</p>;
  }

  function updateQuestion(code: string, patch: Partial<QuestionnaireQuestion>) {
    setDraft((current) => current && ({
      ...current,
      questions: current.questions.map((question) => question.code === code ? { ...question, ...patch } : question),
    }));
  }

  function addAt(afterCode: string | null, page: ReviewPage) {
    setDraft((current) => {
      if (!current) return current;
      const question: QuestionnaireQuestion = {
        code: nextQuestionCode(current.questions.map((item) => item.code)),
        page,
        position: current.questions.length + 1,
        text: "",
        help: null,
        kind: "rating_1_5",
        isConcern: false,
      };
      return { ...current, questions: insertQuestion(current.questions, afterCode, question) };
    });
  }

  const validation = validateQuestionnaire(draft);

  return (
    <div className={styles.builder}>
      <div>
        {snapshotted ? <p className={styles.error}>This round already has a saved copy of {selected.label} from when invites were generated. A new version applies to rounds that have not sent invites.</p> : (
          <label className={styles.field}>
            Template for this round
            <select value={selected.id} onChange={(event) => {
              const versionId = event.target.value;
              startTransition(async () => {
                const result = await setRoundTemplateAction(roundId, versionId);
                if (!result.ok) setError(result.error);
                else router.refresh();
              });
            }}>
              {versions.map((version) => <option key={version.id} value={version.id}>{version.label}{version.isDefault ? " · default" : ""}</option>)}
            </select>
          </label>
        )}
        <p className={unsaved ? styles.unsaved : styles.muted}>{unsaved ? "Unsaved changes" : `Editing ${selected.label}`}</p>
        {deleted ? (
          <p className={styles.muted}>
            Question removed.
            <button type="button" className={styles.secondary} onClick={() => {
              setDraft((current) => current && ({ ...current, questions: renumberQuestions([...current.questions, deleted]) }));
              setDeleted(null);
            }}>Undo</button>
          </p>
        ) : null}
        <label className={styles.field}>Title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label className={styles.field}>Introduction<textarea value={draft.intro} onChange={(event) => setDraft({ ...draft, intro: event.target.value })} /></label>
        <label className={styles.field}>Rating help<textarea value={draft.ratingHelp} onChange={(event) => setDraft({ ...draft, ratingHelp: event.target.value })} /></label>
        <div className={styles.scaleEdit}>
          {draft.scale.map((point) => (
            <label key={point.value} className={styles.field}>{point.value}
              <input value={point.label} onChange={(event) => setDraft({ ...draft, scale: draft.scale.map((item) => item.value === point.value ? { ...item, label: event.target.value } : item) })} />
            </label>
          ))}
        </div>
        {!validation.ok ? <p className={styles.error}>{validation.error}</p> : null}
        {PAGES.map((page) => (
          <div key={page} className={styles.pageBlock}>
            <h3>Page {page}</h3>
            <label className={styles.field}>Page heading
              <input value={draft.pageHeadings[page] ?? ""} placeholder="No heading" onChange={(event) => setDraft({ ...draft, pageHeadings: { ...draft.pageHeadings, [page]: event.target.value } })} />
            </label>
            <button type="button" className={styles.secondary} onClick={() => addAt(null, page)}>Add question at the start of page {page}</button>
            {draft.questions.filter((question) => question.page === page).sort((a, b) => a.position - b.position).map((question) => (
              <article
                key={question.code}
                className={styles.questionCard}
                draggable
                onDragStart={() => setDragCode(question.code)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!dragCode || dragCode === question.code) return;
                  setDraft((current) => {
                    if (!current) return current;
                    const moved = current.questions.map((item) => item.code === dragCode ? { ...item, page, position: question.position - 0.5 } : item);
                    return { ...current, questions: renumberQuestions(moved) };
                  });
                  setDragCode(null);
                }}
              >
                <label className={styles.field}>Question
                  <textarea value={question.text} onChange={(event) => updateQuestion(question.code, { text: event.target.value })} />
                </label>
                {!question.text.trim() ? <p className={styles.error}>Write the question in plain words.</p> : null}
                <label className={styles.field}>Help
                  <textarea value={question.help ?? ""} onChange={(event) => updateQuestion(question.code, { help: event.target.value })} />
                </label>
                <div className={styles.actions}>
                  <label className={styles.fieldInline}>Type
                    <select value={question.kind} onChange={(event) => updateQuestion(question.code, { kind: event.target.value === "text" ? "text" : "rating_1_5" })}>
                      <option value="rating_1_5">Rating 1–5</option>
                      <option value="text">Written</option>
                    </select>
                  </label>
                  <label className={styles.fieldInline}>
                    <input type="checkbox" checked={question.isConcern} onChange={(event) => updateQuestion(question.code, { isConcern: event.target.checked })} />
                    Concern
                  </label>
                  <button type="button" className={styles.secondary} onClick={() => setDraft((current) => current && ({ ...current, questions: moveQuestion(current.questions, question.code, -1) }))}>Up</button>
                  <button type="button" className={styles.secondary} onClick={() => setDraft((current) => current && ({ ...current, questions: moveQuestion(current.questions, question.code, 1) }))}>Down</button>
                  <button type="button" className={styles.secondary} onClick={() => setDraft((current) => current && ({ ...current, questions: duplicateQuestion(current.questions, question.code) }))}>Duplicate</button>
                  <button type="button" className={styles.secondary} onClick={() => {
                    setDeleted(question);
                    setDraft((current) => current && ({ ...current, questions: current.questions.filter((item) => item.code !== question.code) }));
                  }}>Delete</button>
                </div>
                <button type="button" className={styles.secondary} onClick={() => addAt(question.code, page)}>Add question below</button>
              </article>
            ))}
          </div>
        ))}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={pending || !validation.ok} onClick={() => {
            if (!validation.ok) return;
            setError(null);
            startTransition(async () => {
              const result = await saveTemplateVersionAction({ roundId: snapshotted ? null : roundId, questionnaire: validation.value });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setSaved(JSON.stringify(validation.value));
              setNotice(`Saved ${result.label}. The previous version was left unchanged.`);
              router.refresh();
            });
          }}>Save as a new version</button>
        </div>
        {notice ? <p className={styles.muted}>{notice}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.pageBlock}>
          <h3>Version history</h3>
          {history.map((version) => (
            <article key={version.id} className={styles.questionCard}>
              <strong>{version.label}</strong>
              {version.isDefault ? <span className={styles.pill}>Default</span> : (
                <button type="button" className={styles.secondary} disabled={pending} onClick={() => startTransition(async () => {
                  const result = await setTemplateDefaultAction(version.id);
                  if (!result.ok) setError(result.error);
                  else router.refresh();
                })}>Set as default</button>
              )}
              {version.changes.length ? version.changes.map((change: QuestionDiff) => <p key={change.detail} className={styles.muted}>{change.detail}</p>) : <p className={styles.muted}>First version.</p>}
            </article>
          ))}
        </div>
      </div>
      <aside className={styles.phoneFrame} aria-label="Phone preview">
        <TutorReviewForm embedded preview form={{ state: "ready", ...draft }} />
      </aside>
    </div>
  );
}
