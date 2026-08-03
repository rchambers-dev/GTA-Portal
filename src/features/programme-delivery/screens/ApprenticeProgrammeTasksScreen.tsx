"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { ALEX_PROFILE } from "@/features/apprentice-portal/domain/mock-apprentice";
import { AUTOCARE_BLOCKS, AUTOCARE_STANDARD } from "../domain/autocare-blocks";
import { tasksForBlock } from "../domain/autocare-tasks";
import { formatCohortBlockWindow } from "../domain/rpl-funding-calc";
import {
  apprenticeBlockRag,
  apprenticeBlockRagLabel,
  apprenticeTaskRag,
  apprenticeTaskRagLabel,
  summariseBlockCompletion,
} from "../domain/progression-status";
import { taskKindLabel } from "../domain/task-schema";
import {
  DEMO_APPRENTICE_ID,
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  isBlockReflectionVerified,
  subscribeTaskStore,
} from "../domain/task-submission-store";
import styles from "./programme-delivery.module.css";

/**
 * Apprentice college tasks — knowledge test, job card, practicals and reflection.
 * Lesson plans are never shown here (staff/tutor only).
 *
 * Dates: programme weeks + cohort calendar from cohort start.
 * RAG: green complete · amber in progress · red needs completing (no Blue).
 */
export function ApprenticeProgrammeTasksScreen() {
  useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );

  const taskedBlocks = useMemo(
    () => AUTOCARE_BLOCKS.filter((b) => tasksForBlock(b.id).length > 0),
    [],
  );

  return (
    <ApprenticePageShell
      title="College tasks"
      description="Practical tasks and block reflections for your Autocare programme. Complete these in the portal where you can — or upload the PDFs if you could not get on that college day."
    >
      <div className={styles.root}>
        <div className={styles.purpose}>
          <p className={styles.purposeLead}>
            <strong>
              {AUTOCARE_STANDARD.label} · {AUTOCARE_STANDARD.code}{" "}
              {AUTOCARE_STANDARD.version}
            </strong>
            {" · "}
            {ALEX_PROFILE.collegeDays}
          </p>
          <p className={styles.purposeBody}>
            Preferred: fill each task in the portal. Fallback: upload every PDF
            required for that college day (each maps to its own task). Block
            reflection must be verified by your trainer before the next block
            unlocks.
          </p>
          <ul className={styles.ragLegend} aria-label="Status colours">
            <li>
              <span className={styles.ragDot} data-tone="green" /> Green — complete
            </li>
            <li>
              <span className={styles.ragDot} data-tone="amber" /> Amber — in progress
            </li>
            <li>
              <span className={styles.ragDot} data-tone="red" /> Red — needs completing
            </li>
          </ul>
        </div>

        <div className={styles.blockList}>
          {taskedBlocks.map((block) => {
            const tasks = tasksForBlock(block.id);
            const cohortWindow = formatCohortBlockWindow(
              ALEX_PROFILE.programmeStartDate,
              block.weekStart,
              block.weekEnd,
            );
            const priorOk =
              block.id === 1 ||
              isBlockReflectionVerified(
                block.id - 1,
                tasksForBlock(block.id - 1),
              );
            const locked = !priorOk;
            const summary = summariseBlockCompletion(tasks, DEMO_APPRENTICE_ID);
            const blockRag = apprenticeBlockRag(summary, locked);

            return (
              <article
                key={block.id}
                className={styles.blockCard}
                data-rag={blockRag}
              >
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
                      {cohortWindow ? ` · ${cohortWindow}` : ""}
                      {block.monthHint ? ` · ${block.monthHint}` : ""}
                      {block.plannedOtjHours > 0
                        ? ` · ${block.plannedOtjHours} hrs planned OTJ`
                        : ""}
                    </p>
                  </div>
                  <ApprenticeStatusChip tone={blockRag === "neutral" ? "neutral" : blockRag}>
                    {apprenticeBlockRagLabel(blockRag, summary)}
                  </ApprenticeStatusChip>
                </div>
                <ul className={styles.taskList}>
                  {tasks.map((task) => {
                    const sub = getTaskSubmission(task.id);
                    const taskRag = apprenticeTaskRag(sub.status, locked);
                    const href = locked
                      ? "#"
                      : `/apprentice/college-tasks/${task.id}`;
                    return (
                      <li key={task.id}>
                        <Link
                          href={href}
                          className={`${styles.taskRow} ${locked ? styles.locked : ""}`}
                          data-rag={taskRag}
                          aria-disabled={locked}
                          onClick={(e) => {
                            if (locked) e.preventDefault();
                          }}
                        >
                          <div className={styles.taskMain}>
                            <strong>
                              Task {task.taskNumber}: {task.title}
                            </strong>
                            <span>
                              {task.estimatedMinutes} min ·{" "}
                              {taskKindLabel(task.kind)}
                              {task.reviewStatus === "curriculum_review"
                                ? " · Curriculum reviewing content"
                                : ""}
                            </span>
                          </div>
                          <div className={styles.taskEnd}>
                            <ApprenticeStatusChip
                              tone={taskRag === "neutral" ? "neutral" : taskRag}
                            >
                              {apprenticeTaskRagLabel(sub.status, locked)}
                            </ApprenticeStatusChip>
                            {!locked ? (
                              <span className={styles.linkish}>Open →</span>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </ApprenticePageShell>
  );
}
