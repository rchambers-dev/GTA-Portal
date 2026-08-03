"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { taskById, tasksForBlock } from "../domain/autocare-tasks";
import { taskKindLabel } from "../domain/task-schema";
import {
  resolveTaskStoreApprenticeId,
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  statusLabel,
  statusTone,
  subscribeTaskStore,
} from "../domain/task-submission-store";
import styles from "./programme-delivery.module.css";

type Props = { taskId: string };

function storeApprenticeId(adminApprenticeId: string | null): string {
  return resolveTaskStoreApprenticeId(adminApprenticeId);
}

function fieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/**
 * Management read-only view of an apprentice's submitted college task work.
 */
export function ManagementTaskViewScreen({ taskId }: Props) {
  const searchParams = useSearchParams();
  const adminApprenticeId = searchParams.get("apprentice");
  const apprenticeKey = storeApprenticeId(adminApprenticeId);
  const admin = useAdminStore();
  const enrolment =
    admin.enrolments.find((e) => e.apprenticeId === adminApprenticeId) ?? null;

  const task = taskById(taskId);
  useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );
  const sub = getTaskSubmission(taskId, apprenticeKey);

  const backHref = adminApprenticeId
    ? `/management/apprentice-brag?apprentice=${encodeURIComponent(adminApprenticeId)}`
    : "/management/apprentice-brag";

  if (!task) {
    return (
      <ApprenticePageShell
        eyebrow="Management"
        title="Task not found"
        description=""
      >
        <Link href={backHref} className={styles.back}>
          ← Back to progression BRAG
        </Link>
      </ApprenticePageShell>
    );
  }

  const fieldEntries = Object.entries(sub.fields).filter(
    ([, v]) => v && v.trim() && v !== "signed",
  );
  const blockTasks = tasksForBlock(task.blockId);
  const displayName = enrolment?.displayName ?? "Apprentice";

  return (
    <ApprenticePageShell
      eyebrow="Management"
      title={task.title}
      description={`${displayName} · Block ${task.blockId} · Task ${task.taskNumber} · ${taskKindLabel(task.kind)}`}
    >
      <div className={styles.root}>
        <Link href={backHref} className={styles.back}>
          ← Back to progression BRAG
        </Link>

        <div className={styles.purpose}>
          <p className={styles.purposeLead}>
            <ApprenticeStatusChip tone={statusTone(sub.status)}>
              {statusLabel(sub.status)}
            </ApprenticeStatusChip>
            {" · "}
            {task.evidenceRef}
            {sub.difficulty ? ` · Difficulty: ${sub.difficulty}` : ""}
          </p>
          <p className={styles.purposeBody}>{task.scenario}</p>
          <p className={styles.purposeNote}>
            Read-only quality view for management. Sign-off actions stay on the
            tutor programme delivery screen.
          </p>
        </div>

        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Submission summary</h2>
          <dl className={styles.formStack}>
            <div className={styles.field}>
              <dt className={styles.fieldLabel}>Method</dt>
              <dd className={styles.purposeBody} style={{ margin: 0 }}>
                {sub.method === "pdf_upload" ? "PDF upload" : "Portal form"}
              </dd>
            </div>
            <div className={styles.field}>
              <dt className={styles.fieldLabel}>Apprentice signed</dt>
              <dd className={styles.purposeBody} style={{ margin: 0 }}>
                {sub.apprenticeSignedAt
                  ? new Date(sub.apprenticeSignedAt).toLocaleString("en-GB")
                  : "—"}
              </dd>
            </div>
            <div className={styles.field}>
              <dt className={styles.fieldLabel}>Mentor</dt>
              <dd className={styles.purposeBody} style={{ margin: 0 }}>
                {sub.mentorSignedBy
                  ? `${sub.mentorSignedBy}${sub.mentorSignedAt ? ` · ${new Date(sub.mentorSignedAt).toLocaleString("en-GB")}` : ""}`
                  : "—"}
              </dd>
            </div>
            <div className={styles.field}>
              <dt className={styles.fieldLabel}>Trainer</dt>
              <dd className={styles.purposeBody} style={{ margin: 0 }}>
                {sub.trainerSignedBy
                  ? `${sub.trainerSignedBy}${sub.trainerDecision ? ` · ${sub.trainerDecision}` : ""}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>

        {sub.method === "pdf_upload" ? (
          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Uploaded PDFs</h2>
            {sub.uploadedPdfNames.length === 0 ? (
              <p className={styles.fieldHint}>No filenames recorded.</p>
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
            <h2 className={styles.sectionTitle}>Work submitted</h2>
            {fieldEntries.length === 0 ? (
              <p className={styles.fieldHint}>
                No written answers saved on this task yet.
              </p>
            ) : (
              <dl className={styles.formStack}>
                {fieldEntries.map(([key, value]) => (
                  <div key={key} className={styles.field}>
                    <dt className={styles.fieldLabel}>{fieldLabel(key)}</dt>
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
          <h2 className={styles.sectionTitle}>
            Other tasks in Block {task.blockId}
          </h2>
          <ul className={styles.taskList}>
            {blockTasks.map((t) => {
              const s = getTaskSubmission(t.id, apprenticeKey);
              const href = `/management/apprentice-brag/task/${t.id}${
                adminApprenticeId
                  ? `?apprentice=${encodeURIComponent(adminApprenticeId)}`
                  : ""
              }`;
              return (
                <li key={t.id}>
                  <Link
                    href={href}
                    className={styles.taskRow}
                    data-rag={
                      s.status === "verified"
                        ? "green"
                        : s.status === "not_started"
                          ? "neutral"
                          : "amber"
                    }
                  >
                    <div className={styles.taskMain}>
                      <strong>
                        Task {t.taskNumber}: {t.title}
                      </strong>
                      <span>{taskKindLabel(t.kind)}</span>
                    </div>
                    <ApprenticeStatusChip tone={statusTone(s.status)}>
                      {statusLabel(s.status)}
                    </ApprenticeStatusChip>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </ApprenticePageShell>
  );
}
