"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import { formatTutorDate } from "../domain/apprentice-tutor";
import {
  exitNotesLabel,
  exitReasonLabel,
  exitTypeLabel,
  formatRecordedAt,
  reversalNoteLabel,
  splitLearnerExits,
  validateExitReversal,
  validateLearnerExit,
  type ExitType,
  type LearnerExitPage,
  type LearnerExitRecord,
} from "../domain/learner-exit";
import { recordLearnerExitAction, reverseLearnerExitAction } from "./learner-exit-actions";
import styles from "./admin-pages.module.css";

export function LearnerExitPanel({
  canManage,
  gtaId,
  exits,
}: {
  canManage: boolean;
  gtaId: string;
  exits: LearnerExitPage;
}) {
  const { active, reversed } = splitLearnerExits(exits.exits);
  const [recording, setRecording] = useState(false);

  return (
    <section className={styles.learnerCard} aria-labelledby="learner-exit-heading" data-learner-exits="live">
      <h2 id="learner-exit-heading" className={styles.formGroupTitle}>
        Exit
      </h2>
      {exits.loadError ? (
        <p className={styles.error} role="alert">
          {exits.loadError}
        </p>
      ) : null}
      {active.length > 1 ? (
        <p className={styles.error} role="alert">
          This apprentice has more than one exit that has not been reversed.
        </p>
      ) : null}
      {active.length === 0 ? (
        <p className={styles.empty} role="status">
          No exit recorded.
        </p>
      ) : (
        <div className={styles.stack}>
          {active.map((exit) => (
            <ExitResult key={exit.id} exit={exit} canManage={canManage} />
          ))}
        </div>
      )}
      {canManage && active.length === 0 ? (
        <div className={styles.learnerActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            data-record-exit="live"
            onClick={() => setRecording(true)}
          >
            Record exit
          </button>
        </div>
      ) : null}
      {canManage ? null : (
        <p className={styles.formGroupMeta} role="status">
          You can view exits. Administrator and Management can record or reverse one.
        </p>
      )}
      {recording ? (
        <FormDialog title="Record exit" labelledBy="record-exit-title" onClose={() => setRecording(false)}>
          <RecordExitForm
            gtaId={gtaId}
            today={exits.today}
            courseStart={exits.courseStart}
            reasons={exits.reasons}
            onCancel={() => setRecording(false)}
          />
        </FormDialog>
      ) : null}
      <h3 className={styles.formGroupTitle}>Reversed exits</h3>
      {reversed.length === 0 ? (
        <p className={styles.empty} role="status">
          No reversed exits.
        </p>
      ) : (
        <div className={styles.stack} data-reversed-exits="live">
          {reversed.map((exit) => (
            <ExitResult key={exit.id} exit={exit} canManage={false} reversed />
          ))}
        </div>
      )}
    </section>
  );
}

function ExitResult({
  exit,
  canManage,
  reversed = false,
}: {
  exit: LearnerExitRecord;
  canManage: boolean;
  reversed?: boolean;
}) {
  return (
    <article data-exit-result={exit.id} data-exit-reversed={reversed ? "true" : "false"}>
      <dl className={styles.learnerFacts}>
        <dt>Status</dt>
        <dd data-exit-status={exit.exitType}>{exitTypeLabel(exit.exitType)}</dd>
        <dt>End date</dt>
        <dd>{formatTutorDate(exit.exitDate)}</dd>
        <dt>Reason</dt>
        <dd>{exitReasonLabel(exit)}</dd>
        <dt>Recorded by</dt>
        <dd>{exit.recordedByName}</dd>
        <dt>Recorded on</dt>
        <dd>{formatRecordedAt(exit.recordedAt)}</dd>
        <dt>Notes</dt>
        <dd data-safeguarding-redacted={exit.notesWithheld ? "true" : undefined}>{exitNotesLabel(exit)}</dd>
        {reversed ? (
          <>
            <dt>Reversed by</dt>
            <dd>{exit.reversedByName ?? "Unknown user"}</dd>
            <dt>Reversed on</dt>
            <dd>{exit.reversedAt ? formatRecordedAt(exit.reversedAt) : "No date"}</dd>
            <dt>Reversal note</dt>
            <dd data-safeguarding-redacted={exit.reversalNoteWithheld ? "true" : undefined}>
              {reversalNoteLabel(exit)}
            </dd>
          </>
        ) : null}
      </dl>
      {canManage ? <ReverseExitForm exitId={exit.id} /> : null}
    </article>
  );
}

function ReverseExitForm({ exitId }: { exitId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateExitReversal({ exitId, note });
    if (!parsed.ok) {
      setFormError(parsed.formError);
      return;
    }
    setFormError(null);
    setPending(true);
    try {
      const result = await reverseLearnerExitAction({ exitId, note });
      if (!result.ok) {
        setFormError(result.formError);
        return;
      }
      setNote("");
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The exit could not be reversed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate data-reverse-exit={exitId}>
      <p className={styles.formGroupMeta}>
        Reversing sets the learner back to in learning and clears the actual course end. It does not
        reopen a placement or a break.
      </p>
      <label className={styles.learnerField}>
        <span>
          Reversal note <em className={styles.fieldRequired}>required</em>
        </span>
        <textarea
          value={note}
          required
          disabled={pending}
          aria-label="Reversal note"
          onChange={(event) => {
            setNote(event.target.value);
            setFormError(null);
          }}
        />
      </label>
      {formError ? (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      ) : null}
      <div className={styles.learnerActions}>
        <button type="submit" className={styles.secondaryBtn} disabled={pending}>
          {pending ? "Reversing…" : "Reverse exit"}
        </button>
      </div>
    </form>
  );
}

function FormDialog({
  title,
  labelledBy,
  onClose,
  children,
}: {
  title: string;
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.modalBackdrop} onMouseDown={onClose}>
      <div
        className={styles.formDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        data-exit-dialog="record"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={labelledBy} className={styles.confirmTitle}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function RecordExitForm({
  gtaId,
  today,
  courseStart,
  reasons,
  initialExitType = "completed",
  onCancel,
}: {
  gtaId: string;
  today: string;
  courseStart: string | null;
  reasons: LearnerExitPage["reasons"];
  initialExitType?: ExitType;
  onCancel: () => void;
}) {
  const [exitType, setExitType] = useState<ExitType>(initialExitType);
  const [exitDate, setExitDate] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [notes, setNotes] = useState("");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function chooseType(next: ExitType) {
    setExitType(next);
    if (next === "completed") setReasonId("");
    setFormError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateLearnerExit({
      gtaId,
      exitType,
      exitDate,
      reasonId,
      notes,
      today,
      courseStart,
    });
    if (!parsed.ok) {
      setFormError(parsed.formError);
      return;
    }
    setFormError(null);
    setPending(true);
    try {
      const result = await recordLearnerExitAction({
        gtaId,
        exitType,
        exitDate,
        reasonId: exitType === "withdrawn" ? reasonId : "",
        notes,
      });
      if (!result.ok) {
        setFormError(result.formError);
        return;
      }
      onCancel();
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The exit could not be recorded.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate data-record-exit-form={exitType}>
      <p className={styles.formGroupMeta}>
        A withdrawal needs a reason. A completion does not. The exit date cannot be in the future
        {courseStart ? ` or before the course start (${formatTutorDate(courseStart)})` : ""}.
      </p>
      <fieldset>
        <legend className={styles.formGroupTitle}>Exit</legend>
        <label className={styles.checkRow}>
          <input
            type="radio"
            name="exit-type"
            value="completed"
            checked={exitType === "completed"}
            disabled={pending}
            onChange={() => chooseType("completed")}
          />
          <span>Completed</span>
        </label>
        <label className={styles.checkRow}>
          <input
            type="radio"
            name="exit-type"
            value="withdrawn"
            checked={exitType === "withdrawn"}
            disabled={pending}
            onChange={() => chooseType("withdrawn")}
          />
          <span>Withdrawn</span>
        </label>
      </fieldset>
      <label className={styles.learnerField}>
        <span>
          Exit date <em className={styles.fieldRequired}>required</em>
        </span>
        <input
          type="date"
          value={exitDate}
          required
          max={today || undefined}
          min={courseStart ?? undefined}
          disabled={pending}
          aria-label="Exit date"
          onChange={(event) => {
            setExitDate(event.target.value);
            setFormError(null);
          }}
        />
      </label>
      {exitType === "withdrawn" ? (
        <div className={styles.learnerField} data-exit-reason="withdrawn">
          <span>
            Reason <em className={styles.fieldRequired}>required</em>
          </span>
          <Select
            aria-label="Withdrawal reason"
            value={reasonId}
            disabled={pending}
            placeholder="Choose a reason"
            options={reasons.map((reason) => ({ value: reason.id, label: reason.label }))}
            onChange={(value) => {
              setReasonId(value);
              setFormError(null);
            }}
          />
        </div>
      ) : null}
      <label className={styles.learnerField}>
        <span>Notes</span>
        <textarea
          value={notes}
          disabled={pending}
          aria-label="Exit notes"
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      {formError ? (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      ) : null}
      <div className={styles.learnerActions}>
        <button type="submit" className={styles.primaryBtn} disabled={pending}>
          {pending ? "Saving…" : "Record exit"}
        </button>
        <button type="button" className={styles.secondaryBtn} disabled={pending} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
