"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { taskById } from "../domain/autocare-tasks";
import {
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  statusLabel,
  statusTone,
  subscribeTaskStore,
  upsertTaskSubmission,
  type TaskSubmissionStatus,
} from "../domain/task-submission-store";
import {
  isApprenticeEditableField,
  TaskFieldInput,
} from "@/features/programme-delivery/components/TaskFieldInput";
import {
  parseDifficultyFeedback,
  serializeDifficultyFeedback,
} from "@/features/programme-delivery/domain/task-schema";
import styles from "./programme-delivery.module.css";

type Props = { taskId: string };

type SaveState = "idle" | "saving" | "saved";

function isEditableStatus(status: TaskSubmissionStatus): boolean {
  return (
    status === "not_started" ||
    status === "in_progress" ||
    status === "returned" ||
    status === "awaiting_mentor"
  );
}

function difficultyMeta(fields: Record<string, string>) {
  const parsed = parseDifficultyFeedback(fields.difficulty);
  return {
    difficulty: parsed.rating || null,
    difficultyComment: parsed.why || fields.difficultyComment || "",
  };
}

/**
 * Apprentice fills a practical / reflection in-portal, or uploads PDFs as fallback.
 * Answers autosave — no manual Save needed.
 */
export function ApprenticeTaskFillScreen({ taskId }: Props) {
  const task = taskById(taskId);
  useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );

  const submission = getTaskSubmission(taskId);
  const locked = !isEditableStatus(submission.status);

  const [method, setMethod] = useState<"portal_form" | "pdf_upload">(
    submission.method === "pdf_upload" ? "pdf_upload" : "portal_form",
  );
  const [fields, setFields] = useState<Record<string, string>>(
    () => submission.fields,
  );
  const [pdfNames, setPdfNames] = useState<string[]>(
    () => submission.uploadedPdfNames,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allFields = useMemo(
    () => task?.sections.flatMap((s) => s.fields) ?? [],
    [task],
  );

  useEffect(() => {
    if (locked || !dirty) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveState("saving");
      const current = getTaskSubmission(taskId);
      if (
        !isEditableStatus(current.status) &&
        current.status !== "awaiting_mentor"
      ) {
        setSaveState("idle");
        setDirty(false);
        return;
      }
      const nextStatus =
        current.status === "not_started" || current.status === "returned"
          ? "in_progress"
          : current.status;
      upsertTaskSubmission(taskId, {
        method,
        status: nextStatus,
        fields,
        uploadedPdfNames: method === "pdf_upload" ? pdfNames : [],
        ...difficultyMeta(fields),
      });
      setSaveState("saved");
      setDirty(false);
    }, 450);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [dirty, fields, method, pdfNames, taskId, locked]);

  // Flush any pending draft if the tab closes mid-type
  useEffect(() => {
    function flush() {
      if (!dirty || locked) return;
      upsertTaskSubmission(taskId, {
        method,
        status:
          getTaskSubmission(taskId).status === "not_started"
            ? "in_progress"
            : getTaskSubmission(taskId).status,
        fields,
        uploadedPdfNames: method === "pdf_upload" ? pdfNames : [],
        ...difficultyMeta(fields),
      });
    }
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [dirty, locked, taskId, method, fields, pdfNames]);

  if (!task) {
    return (
      <ApprenticePageShell title="Task not found" description="">
        <Link href="/apprentice/tracking" className={styles.back}>
          ← Back to college tasks
        </Link>
      </ApprenticePageShell>
    );
  }

  function markDirty() {
    setDirty(true);
  }

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    markDirty();
  }

  function changeMethod(next: "portal_form" | "pdf_upload") {
    setMethod(next);
    markDirty();
  }

  function submitForSignOff() {
    if (method === "portal_form") {
      if (!parseDifficultyFeedback(fields.difficulty).rating) {
        setMessage(
          "Please rate how easy or hard this task was before submitting.",
        );
        return;
      }
    } else if (pdfNames.length === 0) {
      setMessage(
        "Add at least one PDF for this task, or switch to portal form.",
      );
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    const needsMentor = allFields.some((f) => f.signOffRole === "mentor");
    const apprenticeSigned = fields.apprenticeSign === "signed";

    upsertTaskSubmission(taskId, {
      method,
      fields,
      uploadedPdfNames: method === "pdf_upload" ? pdfNames : [],
      ...difficultyMeta(fields),
      apprenticeSignedAt: apprenticeSigned
        ? new Date().toISOString()
        : submission.apprenticeSignedAt,
      status: needsMentor ? "awaiting_mentor" : "awaiting_trainer",
    });
    setDirty(false);
    setSaveState("saved");
    setMessage(
      needsMentor
        ? "Submitted — waiting for workplace mentor, then your trainer."
        : "Submitted — waiting for trainer sign-off.",
    );
  }

  function onPickFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const names = [...fileList].map((f) => f.name);
    setPdfNames((prev) => [...prev, ...names]);
    setMethod("pdf_upload");
    markDirty();
  }

  const saveHint =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "All changes saved"
        : "Answers save automatically";

  return (
    <ApprenticePageShell
      title={task.title}
      actions={
        <>
          <ApprenticeStatusChip tone="neutral" size="lg">
            ~{task.estimatedMinutes} min
          </ApprenticeStatusChip>
          <ApprenticeStatusChip tone={statusTone(submission.status)} size="lg">
            {statusLabel(submission.status)}
          </ApprenticeStatusChip>
        </>
      }
    >
      <div className={styles.root}>
        <Link href="/apprentice/tracking" className={styles.back}>
          ← Back to college tasks
        </Link>

        <div className={styles.purpose}>
          <p className={styles.purposeLabel}>Scenario</p>
          <p className={styles.purposeBody}>{task.scenario}</p>
          <p className={styles.purposeLabel}>What you need to do</p>
          <ul className={styles.objectives}>
            {task.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
          {task.materials && task.materials.length > 0 ? (
            <>
              <p className={styles.purposeLabel}>
                Materials you need at the workstation
              </p>
              <ul className={styles.objectives}>
                {task.materials.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </>
          ) : null}
          {task.instructions && task.instructions.length > 0 ? (
            <>
              <p className={styles.purposeLabel}>Practical task instructions</p>
              <ol className={styles.objectives}>
                {task.instructions.map((step, i) => (
                  <li key={`${i}-${step}`}>{step}</li>
                ))}
              </ol>
            </>
          ) : null}
          {(task.weeks || task.dutiesCovered || task.ksbsCovered) && (
            <p className={styles.purposeNote}>
              {[task.weeks, task.dutiesCovered ? `Duties ${task.dutiesCovered}` : null, task.ksbsCovered ? `KSBs ${task.ksbsCovered}` : null, task.assessmentType]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <p className={styles.purposeNote}>
            Preferred: portal form. Upload PDFs only if you could not get on
            that day — upload every PDF needed for this task.
          </p>
        </div>

        <div className={styles.methodBar}>
          <span className={styles.fieldHint}>Submission method:</span>
          <button
            type="button"
            className={
              method === "portal_form" ? styles.methodActive : styles.methodBtn
            }
            disabled={locked}
            onClick={() => changeMethod("portal_form")}
          >
            Portal form
          </button>
          <button
            type="button"
            className={
              method === "pdf_upload"
                ? styles.methodFallbackActive
                : styles.methodFallback
            }
            disabled={locked}
            onClick={() => changeMethod("pdf_upload")}
          >
            PDF upload (fallback)
          </button>
        </div>

        {method === "pdf_upload" ? (
          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Upload PDF(s) for this task</h2>
            <p className={styles.fieldHint}>
              If college day had multiple PDFs, upload each to its own task —
              not one combined dump. Source file: {task.sourcePdf}
            </p>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={locked}
              onChange={(e) => onPickFiles(e.target.files)}
            />
            {pdfNames.length > 0 ? (
              <ul className={styles.uploadList}>
                {pdfNames.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
            <div className={styles.difficultySplit}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="diff-upload">
                  How easy or hard was this learning?
                </label>
                <select
                  id="diff-upload"
                  className={styles.select}
                  disabled={locked}
                  value={parseDifficultyFeedback(fields.difficulty).rating}
                  onChange={(e) => {
                    const prev = parseDifficultyFeedback(fields.difficulty);
                    setField(
                      "difficulty",
                      serializeDifficultyFeedback({
                        rating: e.target.value,
                        why: prev.why,
                      }),
                    );
                  }}
                >
                  <option value="">Choose…</option>
                  <option value="1 — Too easy">1 — Too easy</option>
                  <option value="2 — Easy">2 — Easy</option>
                  <option value="3 — About right">3 — About right</option>
                  <option value="4 — Hard">4 — Hard</option>
                  <option value="5 — Too hard">5 — Too hard</option>
                </select>
              </div>
              <div className={styles.difficultyWhy}>
                <label className={styles.fieldLabel} htmlFor="diff-upload-why">
                  Why?
                </label>
                <textarea
                  id="diff-upload-why"
                  className={styles.textarea}
                  disabled={locked}
                  rows={4}
                  placeholder="Briefly say why you chose that rating"
                  value={parseDifficultyFeedback(fields.difficulty).why}
                  onChange={(e) => {
                    const prev = parseDifficultyFeedback(fields.difficulty);
                    setField(
                      "difficulty",
                      serializeDifficultyFeedback({
                        rating: prev.rating,
                        why: e.target.value,
                      }),
                    );
                  }}
                />
              </div>
            </div>
          </section>
        ) : (
          <div className={styles.formStack}>
            {task.sections.map((section) => (
              <section key={section.id} className={styles.sectionCard}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                {section.fields.map((field) => (
                  <TaskFieldInput
                    key={field.key}
                    field={field}
                    value={fields[field.key] ?? ""}
                    disabled={locked}
                    staffLocked={!isApprenticeEditableField(field)}
                    onChange={(next) => {
                      if (!isApprenticeEditableField(field)) return;
                      setField(field.key, next);
                    }}
                  />
                ))}
              </section>
            ))}
          </div>
        )}

        {message ? <p className={styles.purposeBody}>{message}</p> : null}

        {!locked ? (
          <div
            className={styles.autosaveBar}
            data-state={saveState === "saving" ? "saving" : "saved"}
            aria-live="polite"
          >
            <p className={styles.autosaveText}>{saveHint}</p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={submitForSignOff}
            >
              Submit for sign-off
            </button>
          </div>
        ) : null}
      </div>
    </ApprenticePageShell>
  );
}
