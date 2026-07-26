"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "@/features/learner-portal/components/LearnerPageShell";
import { taskById } from "../domain/autocare-tasks";
import type { TaskFieldDef } from "../domain/task-schema";
import {
  parseActionRows,
  parseJsonList,
  parsePartsRows,
  parseRatingRows,
} from "../domain/task-schema";
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
import styles from "./programme-delivery.module.css";

type Props = { taskId: string };

type SaveState = "idle" | "saving" | "saved";

function fieldRole(field: TaskFieldDef): "apprentice" | "mentor" | "trainer" | "assessor" {
  return field.filledBy ?? field.signOffRole ?? "apprentice";
}

function isLearnerEditableField(field: TaskFieldDef): boolean {
  return fieldRole(field) === "apprentice";
}

function staffRoleHint(field: TaskFieldDef): string {
  const role = fieldRole(field);
  if (role === "mentor") return "Your workplace mentor completes this after review.";
  if (role === "assessor") return "Your assessor completes this after review.";
  return "Your trainer / assessor completes this after review.";
}

function WrenchCheckbox({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.wrenchCheck}${disabled ? ` ${styles.wrenchCheckDisabled}` : ""}${checked ? ` ${styles.wrenchCheckOn}` : ""}`}
      disabled={disabled}
      aria-pressed={checked}
      onClick={() => {
        if (disabled) return;
        onChange(!checked);
      }}
    >
      <span className={styles.wrenchCheckBox} aria-hidden>
        <svg
          className={styles.wrenchIcon}
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="currentColor"
          aria-hidden
        >
          <path d="M22.7 19.3 13.6 10.2a5.5 5.5 0 0 0-6.9-6.9L9.5 6.1 6.1 9.5 3.3 6.7a5.5 5.5 0 0 0 6.9 6.9l9.1 9.1a1 1 0 0 0 1.4 0l2-2a1 1 0 0 0 0-1.4zM7.4 3.9a3.5 3.5 0 0 1 4.2 4.2L9.5 6.1 7.4 3.9zm1.5 7.2a3.5 3.5 0 0 1-4.2-4.2l2.1 2.1 2.1 2.1z" />
        </svg>
      </span>
      <span>{label}</span>
    </button>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
  staffLocked,
}: {
  field: TaskFieldDef;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  staffLocked?: boolean;
}) {
  const locked = Boolean(disabled || staffLocked);
  const wrapClass = `${styles.field}${staffLocked ? ` ${styles.fieldStaffOnly}` : ""}`;

  if (field.type === "heading" || field.type === "description") {
    return <p className={styles.purposeBody}>{field.label}</p>;
  }

  if (field.type === "sign_off") {
    return (
      <div className={wrapClass}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <p className={staffLocked ? styles.fieldStaffNote : styles.fieldHint}>
          {staffLocked
            ? staffRoleHint(field)
            : `Role: ${field.signOffRole ?? "signer"} — confirm below when ready.`}
        </p>
        <WrenchCheckbox
          checked={value === "signed"}
          disabled={locked}
          onChange={(next) => onChange(next ? "signed" : "")}
          label="I confirm / sign"
        />
      </div>
    );
  }

  if (field.type === "checkbox_group") {
    const selected = parseJsonList(value);
    return (
      <div className={wrapClass}>
        <span className={styles.fieldLabel}>{field.label}</span>
        {staffLocked ? (
          <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
        ) : field.hint ? (
          <p className={styles.fieldHint}>{field.hint}</p>
        ) : null}
        <div className={styles.choiceStack}>
          {(field.options ?? []).map((opt) => {
            const checked = selected.includes(opt);
            return (
              <WrenchCheckbox
                key={opt}
                checked={checked}
                disabled={locked}
                label={opt}
                onChange={(next) => {
                  const set = new Set(selected);
                  if (next) set.add(opt);
                  else set.delete(opt);
                  onChange(JSON.stringify([...set]));
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "radio_group" || field.type === "difficulty_feedback") {
    return (
      <div className={wrapClass}>
        <span className={styles.fieldLabel}>{field.label}</span>
        {staffLocked ? (
          <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
        ) : field.hint ? (
          <p className={styles.fieldHint}>{field.hint}</p>
        ) : null}
        <div className={styles.choiceStack} role="radiogroup" aria-label={field.label}>
          {(field.options ?? []).map((opt) => (
            <label key={opt} className={styles.radioOption}>
              <input
                type="radio"
                name={field.key}
                value={opt}
                checked={value === opt}
                disabled={locked}
                onChange={() => onChange(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "rating_rows") {
    const rows = parseRatingRows(value, field.rowCount ?? 6);
    return (
      <div className={wrapClass}>
        <span className={styles.fieldLabel}>{field.label}</span>
        {staffLocked ? (
          <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
        ) : field.hint ? (
          <p className={styles.fieldHint}>{field.hint}</p>
        ) : null}
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Knowledge / skill / behaviour</th>
                <th>Before (1–5)</th>
                <th>Now (1–5)</th>
                <th>Evidence or example</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className={styles.input}
                      value={row.area}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], area: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      max={5}
                      value={row.before}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], before: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      max={5}
                      value={row.now}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], now: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.evidence}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], evidence: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (field.type === "action_rows") {
    const rows = parseActionRows(value, field.rowCount ?? 3);
    return (
      <div className={wrapClass}>
        <span className={styles.fieldLabel}>{field.label}</span>
        {staffLocked ? (
          <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
        ) : field.hint ? (
          <p className={styles.fieldHint}>{field.hint}</p>
        ) : null}
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>No.</th>
                <th>Agreed action / development objective</th>
                <th>Support or opportunity needed</th>
                <th>Owner / review date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.action}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], action: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.support}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], support: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.ownerReview}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], ownerReview: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (field.type === "parts_rows") {
    const rows = parsePartsRows(value, field.rowCount ?? 4);
    return (
      <div className={wrapClass}>
        <span className={styles.fieldLabel}>{field.label}</span>
        {staffLocked ? (
          <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
        ) : field.hint ? (
          <p className={styles.fieldHint}>{field.hint}</p>
        ) : null}
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Qty</th>
                <th>Part / material description</th>
                <th>Part no.</th>
                <th>Supplier / notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className={styles.input}
                      value={row.qty}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], qty: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.description}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], description: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.partNo}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], partNo: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.supplier}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], supplier: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (field.type === "textarea" || field.type === "knowledge_question") {
    return (
      <div className={wrapClass}>
        <label className={styles.fieldLabel} htmlFor={field.key}>
          {field.label}
        </label>
        {staffLocked ? (
          <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
        ) : field.hint ? (
          <p className={styles.fieldHint}>{field.hint}</p>
        ) : null}
        <textarea
          id={field.key}
          className={styles.textarea}
          value={value}
          disabled={locked}
          readOnly={staffLocked}
          placeholder={staffLocked ? "Waiting for staff…" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <label className={styles.fieldLabel} htmlFor={field.key}>
        {field.label}
      </label>
      {staffLocked ? (
        <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
      ) : field.hint ? (
        <p className={styles.fieldHint}>{field.hint}</p>
      ) : null}
      <input
        id={field.key}
        className={styles.input}
        type={
          field.type === "number"
            ? "number"
            : field.type === "date"
              ? "date"
              : "text"
        }
        value={value}
        disabled={locked}
        readOnly={staffLocked}
        placeholder={staffLocked ? "Waiting for staff…" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function isEditableStatus(status: TaskSubmissionStatus): boolean {
  return (
    status === "not_started" ||
    status === "in_progress" ||
    status === "returned" ||
    status === "awaiting_mentor"
  );
}

/**
 * Learner fills a practical / reflection in-portal, or uploads PDFs as fallback.
 * Answers autosave — no manual Save needed.
 */
export function LearnerTaskFillScreen({ taskId }: Props) {
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
        difficulty: fields.difficulty || null,
        difficultyComment: fields.difficultyComment || "",
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
        difficulty: fields.difficulty || null,
        difficultyComment: fields.difficultyComment || "",
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
      <LearnerPageShell title="Task not found" description="">
        <Link href="/learner/college-tasks" className={styles.back}>
          ← Back to college tasks
        </Link>
      </LearnerPageShell>
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
      if (!fields.difficulty) {
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
      difficulty: fields.difficulty || null,
      difficultyComment: fields.difficultyComment || "",
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
    <LearnerPageShell
      title={task.title}
      actions={
        <>
          <LearnerStatusChip tone="neutral" size="lg">
            ~{task.estimatedMinutes} min
          </LearnerStatusChip>
          <LearnerStatusChip tone={statusTone(submission.status)} size="lg">
            {statusLabel(submission.status)}
          </LearnerStatusChip>
        </>
      }
    >
      <div className={styles.root}>
        <Link href="/learner/college-tasks" className={styles.back}>
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
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="diff-upload">
                How easy or hard was this learning?
              </label>
              <select
                id="diff-upload"
                className={styles.select}
                disabled={locked}
                value={fields.difficulty ?? ""}
                onChange={(e) => setField("difficulty", e.target.value)}
              >
                <option value="">Choose…</option>
                <option value="1 — Too easy">1 — Too easy</option>
                <option value="2 — Easy">2 — Easy</option>
                <option value="3 — About right">3 — About right</option>
                <option value="4 — Hard">4 — Hard</option>
                <option value="5 — Too hard">5 — Too hard</option>
              </select>
            </div>
          </section>
        ) : (
          <div className={styles.formStack}>
            {task.sections.map((section) => (
              <section key={section.id} className={styles.sectionCard}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                {section.fields.map((field) => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={fields[field.key] ?? ""}
                    disabled={locked}
                    staffLocked={!isLearnerEditableField(field)}
                    onChange={(next) => {
                      if (!isLearnerEditableField(field)) return;
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
    </LearnerPageShell>
  );
}
