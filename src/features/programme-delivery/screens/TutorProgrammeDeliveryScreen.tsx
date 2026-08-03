"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { AUTOCARE_BLOCKS, AUTOCARE_STANDARD } from "../domain/autocare-blocks";
import {
  AUTOCARE_PRACTICAL_TASKS,
  lessonPlansForBlock,
  tasksForBlock,
} from "../domain/autocare-tasks";
import {
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  listAwaitingTrainer,
  statusLabel,
  statusTone,
  subscribeTaskStore,
} from "../domain/task-submission-store";
import styles from "./programme-delivery.module.css";

type Tab = "queue" | "blocks";

/**
 * Tutor programme delivery — lesson plans + practical tasks.
 * Apprentices never see lesson plans; tutors see everything.
 */
export function TutorProgrammeDeliveryScreen() {
  const [tab, setTab] = useState<Tab>("queue");
  useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );

  const awaiting = listAwaitingTrainer(AUTOCARE_PRACTICAL_TASKS);

  const taskedBlocks = AUTOCARE_BLOCKS.filter(
    (b) => tasksForBlock(b.id).length > 0,
  );

  return (
    <ApprenticePageShell
      eyebrow="Tutor"
      title="Programme delivery"
      description="Lesson plans and college practical tasks for Autocare. Review apprentice submissions, verify Task 5 reflections to unlock the next block, and use curriculum review status while leads check transcribed content."
    >
      <div className={styles.root}>
        <div className={styles.purpose}>
          <p className={styles.purposeLead}>
            <strong>
              {AUTOCARE_STANDARD.label} · {AUTOCARE_STANDARD.code}{" "}
              {AUTOCARE_STANDARD.version}
            </strong>
          </p>
          <p className={styles.purposeBody}>
            You see lesson plans and tasks. Apprentices only see tasks. Sign-off
            order for reflections: apprentice → mentor (employer portal) → you
            verify. Difficulty ratings feed next-year curriculum tweaks.
          </p>
        </div>

        <div className={styles.tabRow} role="tablist">
          <button
            type="button"
            role="tab"
            className={tab === "queue" ? styles.tabActive : styles.tab}
            aria-selected={tab === "queue"}
            onClick={() => setTab("queue")}
          >
            Sign-off queue ({awaiting.length})
          </button>
          <button
            type="button"
            role="tab"
            className={tab === "blocks" ? styles.tabActive : styles.tab}
            aria-selected={tab === "blocks"}
            onClick={() => setTab("blocks")}
          >
            Blocks & lesson plans
          </button>
        </div>

        {tab === "queue" ? (
          awaiting.length === 0 ? (
            <p className={styles.empty}>
              Nothing waiting for mentor or trainer sign-off right now.
            </p>
          ) : (
            <div className={styles.blockList}>
              {awaiting.map((task) => {
                const sub = getTaskSubmission(task.id);
                return (
                  <article key={task.id} className={styles.queueCard}>
                    <div>
                      <p className={styles.blockMeta}>
                        Alex Morgan · Block {task.blockId} · {task.evidenceRef}
                      </p>
                      <h3 className={styles.blockTitle}>{task.title}</h3>
                      <p className={styles.blockMeta}>
                        Method:{" "}
                        {sub.method === "pdf_upload"
                          ? `PDF upload (${sub.uploadedPdfNames.join(", ") || "files"})`
                          : "Portal form"}
                        {sub.difficulty ? ` · Difficulty: ${sub.difficulty}` : ""}
                      </p>
                    </div>
                    <div className={styles.taskEnd}>
                      <ApprenticeStatusChip tone={statusTone(sub.status)}>
                        {statusLabel(sub.status)}
                      </ApprenticeStatusChip>
                      <Link
                        className={styles.linkish}
                        href={`/staff/programme-delivery/${task.id}`}
                      >
                        Review →
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : (
          <div className={styles.blockList}>
            {taskedBlocks.map((block) => {
              const tasks = tasksForBlock(block.id);
              const plans = lessonPlansForBlock(block.id);
              return (
                <article key={block.id} className={styles.blockCard}>
                  <div className={styles.blockHead}>
                    <div>
                      <h2 className={styles.blockTitle}>
                        Block {block.id} · {block.name}
                      </h2>
                      <p className={styles.blockMeta}>
                        {block.weekStart != null && block.weekEnd != null
                          ? `Weeks ${block.weekStart}–${block.weekEnd}`
                          : block.kind === "epa"
                            ? "EPA assessment"
                            : "Pre-EPA consolidation"}
                        {" · "}
                        {block.plannedOtjHours} OTJ / {block.plannedNonOtjHours}{" "}
                        non-OTJ hrs
                      </p>
                    </div>
                  </div>

                  {plans.length > 0 ? (
                    <>
                      <p
                        className={styles.staffOnly}
                        style={{ padding: "0.75rem 1rem 0" }}
                      >
                        Lesson plans · staff only
                      </p>
                      <ul className={styles.lessonList}>
                        {plans.map((plan) => (
                          <li key={plan.id} className={styles.lessonItem}>
                            <span>
                              Week {plan.week}: {plan.title}
                            </span>
                            <span className={styles.blockMeta}>
                              {plan.sourceFile}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {tasks.length > 0 ? (
                    <ul className={styles.taskList}>
                      {tasks.map((task) => {
                        const sub = getTaskSubmission(task.id);
                        return (
                          <li key={task.id}>
                            <Link
                              href={`/staff/programme-delivery/${task.id}`}
                              className={styles.taskRow}
                            >
                              <div className={styles.taskMain}>
                                <strong>{task.title}</strong>
                                <span>
                                  {task.evidenceRef} · review: {task.reviewStatus}
                                </span>
                              </div>
                              <div className={styles.taskEnd}>
                                <ApprenticeStatusChip tone={statusTone(sub.status)}>
                                  {statusLabel(sub.status)}
                                </ApprenticeStatusChip>
                                <span className={styles.linkish}>Open →</span>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className={styles.empty} style={{ margin: "0.75rem" }}>
                      No practical tasks listed for this block.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </ApprenticePageShell>
  );
}
