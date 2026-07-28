"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "@/features/learner-portal/components/LearnerPageShell";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { taskById, tasksForBlock } from "../domain/autocare-tasks";
import { taskKindLabel } from "../domain/task-schema";
import {
  DEMO_LEARNER_ID,
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  statusLabel,
  statusTone,
  subscribeTaskStore,
} from "../domain/task-submission-store";
import styles from "./programme-delivery.module.css";

type Props = { taskId: string };

function storeLearnerId(adminLearnerId: string | null): string {
  if (!adminLearnerId || adminLearnerId === "lrn-alex-morgan") {
    return DEMO_LEARNER_ID;
  }
  return adminLearnerId;
}

function fieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/**
 * Management read-only view of a learner's submitted college task work.
 */
export function ManagementTaskViewScreen({ taskId }: Props) {
  const searchParams = useSearchParams();
  const adminLearnerId = searchParams.get("learner");
  const learnerKey = storeLearnerId(adminLearnerId);
  const admin = useAdminStore();
  const enrolment =
    admin.enrolments.find((e) => e.learnerId === adminLearnerId) ??
    admin.enrolments.find((e) => e.learnerId === "lrn-alex-morgan") ??
    null;

  const task = taskById(taskId);
  useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );
  const sub = getTaskSubmission(taskId, learnerKey);

  const backHref = adminLearnerId
    ? `/management/learner-brag?learner=${encodeURIComponent(adminLearnerId)}`
    : "/management/learner-brag";

  if (!task) {
    return (
      <LearnerPageShell
        eyebrow="Management"
        title="Task not found"
        description=""
      >
        <Link href={backHref} className={styles.back}>
          ← Back to progression BRAG
        </Link>
      </LearnerPageShell>
    );
  }

  const fieldEntries = Object.entries(sub.fields).filter(
    ([, v]) => v && v.trim() && v !== "signed",
  );
  const blockTasks = tasksForBlock(task.blockId);
  const displayName = enrolment?.displayName ?? "Learner";

  return (
    <LearnerPageShell
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
            <LearnerStatusChip tone={statusTone(sub.status)}>
              {statusLabel(sub.status)}
            </LearnerStatusChip>
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
              const s = getTaskSubmission(t.id, learnerKey);
              const href = `/management/learner-brag/task/${t.id}${
                adminLearnerId
                  ? `?learner=${encodeURIComponent(adminLearnerId)}`
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
                    <LearnerStatusChip tone={statusTone(s.status)}>
                      {statusLabel(s.status)}
                    </LearnerStatusChip>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </LearnerPageShell>
  );
}
