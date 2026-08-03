"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { usePortalSession } from "@/shell/demo/PortalSessionProvider";
import { taskById } from "../domain/autocare-tasks";
import {
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  statusLabel,
  statusTone,
  subscribeTaskStore,
  upsertTaskSubmission,
} from "../domain/task-submission-store";
import styles from "./programme-delivery.module.css";

type Props = { taskId: string };

/**
 * Tutor reviews a submission — mentor then trainer verify.
 * Task 5 reflection: trainer “Progress verified” unlocks the next block.
 */
export function TutorTaskReviewScreen({ taskId }: Props) {
  const { session } = usePortalSession();
  const task = taskById(taskId);
  useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );

  const sub = getTaskSubmission(taskId);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (!task) {
    return (
      <ApprenticePageShell eyebrow="Tutor" title="Task not found" description="">
        <Link href="/staff/programme-delivery" className={styles.back}>
          ← Back to programme delivery
        </Link>
      </ApprenticePageShell>
    );
  }

  function signAsMentor() {
    upsertTaskSubmission(taskId, {
      mentorSignedAt: new Date().toISOString(),
      mentorSignedBy: session.account.name,
      status: "awaiting_trainer",
      fields: { ...sub.fields, mentorSign: "signed" },
    });
    setMessage("Mentor sign-off recorded. Waiting for trainer verify.");
  }

  function verifyAsTrainer() {
    const isReflection = task?.kind === "reflection";
    const fields = {
      ...sub.fields,
      trainerSign: "signed",
      trainerDecision: sub.fields.trainerDecision || "Progress verified",
      assessorSign: "signed",
      assessmentDecision:
        sub.fields.assessmentDecision ||
        (isReflection ? "Progress verified" : "Pass"),
    };
    upsertTaskSubmission(taskId, {
      trainerSignedAt: new Date().toISOString(),
      trainerSignedBy: session.account.name,
      trainerDecision: fields.trainerDecision,
      status: "verified",
      fields,
    });
    setMessage(
      isReflection
        ? "Progress verified — next block unlocked for the apprentice."
        : "Task verified.",
    );
  }

  function returnWork() {
    upsertTaskSubmission(taskId, {
      status: "returned",
      returnNote: note || "Please amend and resubmit.",
    });
    setMessage("Returned to apprentice.");
  }

  const fieldEntries = Object.entries(sub.fields).filter(
    ([, v]) => v && v.trim(),
  );

  return (
    <ApprenticePageShell
      eyebrow="Tutor"
      title={task.title}
      description={`${task.evidenceRef} · Block ${task.blockId}`}
    >
      <div className={styles.root}>
        <Link href="/staff/programme-delivery" className={styles.back}>
          ← Back to programme delivery
        </Link>

        <div className={styles.purpose}>
          <p className={styles.purposeLead}>
            <ApprenticeStatusChip tone={statusTone(sub.status)}>
              {statusLabel(sub.status)}
            </ApprenticeStatusChip>{" "}
            Method: {sub.method ?? "—"}
            {sub.difficulty ? ` · Difficulty: ${sub.difficulty}` : ""}
          </p>
          <p className={styles.purposeBody}>{task.scenario}</p>
          {sub.returnNote ? (
            <p className={styles.purposeBody}>Return note: {sub.returnNote}</p>
          ) : null}
        </div>

        {sub.method === "pdf_upload" ? (
          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Uploaded PDFs</h2>
            {sub.uploadedPdfNames.length === 0 ? (
              <p className={styles.fieldHint}>No filenames recorded yet.</p>
            ) : (
              <ul className={styles.uploadList}>
                {sub.uploadedPdfNames.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Portal answers</h2>
            {fieldEntries.length === 0 ? (
              <p className={styles.fieldHint}>No answers saved yet.</p>
            ) : (
              <dl className={styles.formStack}>
                {fieldEntries.map(([key, value]) => (
                  <div key={key} className={styles.field}>
                    <dt className={styles.fieldLabel}>{key}</dt>
                    <dd className={styles.purposeBody} style={{ margin: 0 }}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}

        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Sign-off actions</h2>
          <p className={styles.fieldHint}>
            Reflection gate: apprentice → mentor → trainer verifies.
          </p>
          <div className={styles.actions}>
            {sub.status === "awaiting_mentor" ? (
              <button type="button" className={styles.secondaryBtn} onClick={signAsMentor}>
                Record mentor sign-off
              </button>
            ) : null}
            {sub.status === "awaiting_trainer" ? (
              <button type="button" className={styles.primaryBtn} onClick={verifyAsTrainer}>
                Verify as trainer
              </button>
            ) : null}
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="return-note">
              Return note (if sending back)
            </label>
            <textarea
              id="return-note"
              className={styles.textarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={returnWork}>
              Return to apprentice
            </button>
          </div>
          {message ? <p className={styles.purposeBody}>{message}</p> : null}
        </section>
      </div>
    </ApprenticePageShell>
  );
}
