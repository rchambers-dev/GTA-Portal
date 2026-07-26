"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "../components/LearnerPageShell";
import { ALEX_PROFILE } from "../domain/mock-learner";
import {
  AUTOCARE_BLOCKS,
  AUTOCARE_STANDARD,
} from "@/features/programme-delivery/domain/autocare-blocks";
import {
  AUTOCARE_PRACTICAL_TASKS,
  tasksForBlock,
} from "@/features/programme-delivery/domain/autocare-tasks";
import {
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  isBlockReflectionVerified,
  statusLabel,
  statusTone,
  subscribeTaskStore,
} from "@/features/programme-delivery/domain/task-submission-store";
import styles from "./learner-pages.module.css";

/**
 * Progress against Autocare blocks (weeks) — not the old module catalogue.
 */
export function LearnerProgressScreen() {
  const profile = ALEX_PROFILE;
  const snapshot = useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );

  const trainingBlocks = useMemo(
    () => AUTOCARE_BLOCKS.filter((b) => b.kind === "training"),
    [],
  );

  const taskStats = useMemo(() => {
    let verified = 0;
    let inFlight = 0;
    let notStarted = 0;
    for (const task of AUTOCARE_PRACTICAL_TASKS) {
      const status = getTaskSubmission(task.id).status;
      if (status === "verified") verified += 1;
      else if (status === "not_started") notStarted += 1;
      else inFlight += 1;
    }
    return { verified, inFlight, notStarted, total: AUTOCARE_PRACTICAL_TASKS.length };
  }, [snapshot]);

  const behindPlan =
    profile.actualProgressPercent < profile.plannedProgressPercent;
  const gap = Math.max(
    0,
    profile.plannedProgressPercent - profile.actualProgressPercent,
  );

  return (
    <LearnerPageShell
      title="Progress"
      description={`Planned versus actual on ${AUTOCARE_STANDARD.label} — tracked by programme weeks and college block tasks.`}
    >
      <div className={styles.stack}>
        <div className={styles.grid}>
          <div className={styles.glance} data-tone="navy">
            <p className={styles.glanceLabel}>Programme week</p>
            <p className={styles.glanceValue}>{profile.programmeWeek}</p>
            <p className={styles.glanceHint}>
              of {AUTOCARE_STANDARD.deliveryWeeks} delivery weeks
            </p>
          </div>
          <div
            className={styles.glance}
            data-tone={behindPlan ? "amber" : "green"}
          >
            <p className={styles.glanceLabel}>Actual</p>
            <p className={styles.glanceValue}>
              {profile.actualProgressPercent}%
            </p>
            <p className={styles.glanceHint}>
              {behindPlan
                ? `${gap}% behind plan — focus on college tasks and OTJ`
                : "On or ahead of plan"}
            </p>
          </div>
          <div className={styles.glance} data-tone="blue">
            <p className={styles.glanceLabel}>College tasks</p>
            <p className={styles.glanceValue}>
              {taskStats.verified}/{taskStats.total}
            </p>
            <p className={styles.glanceHint}>
              {taskStats.inFlight} in flight · {taskStats.notStarted} not started
            </p>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.dashSectionTitle} data-accent="green">
            Overall completion
          </h2>
          <div className={styles.progressCompare}>
            <div className={styles.progressBar} aria-hidden>
              <div
                className={styles.progressFillPlanned}
                style={{ width: `${profile.plannedProgressPercent}%` }}
              />
              <div
                className={styles.progressFill}
                data-tone={behindPlan ? "amber" : "green"}
                style={{ width: `${profile.actualProgressPercent}%` }}
              />
            </div>
            <div className={styles.progressLegend}>
              <span data-tone="navy">
                <i aria-hidden /> Planned {profile.plannedProgressPercent}%
              </span>
              <span data-tone={behindPlan ? "amber" : "green"}>
                <i aria-hidden /> Actual {profile.actualProgressPercent}%
              </span>
            </div>
          </div>
        </section>

        {(() => {
          const currentBlock =
            trainingBlocks.find(
              (b) =>
                b.weekStart != null &&
                b.weekEnd != null &&
                profile.programmeWeek >= b.weekStart &&
                profile.programmeWeek <= b.weekEnd,
            ) ?? trainingBlocks[0];
          const liveTasks = tasksForBlock(currentBlock?.id ?? 1);
          if (liveTasks.length === 0) return null;
          return (
          <section className={styles.section}>
            <h2 className={styles.dashSectionTitle} data-accent="amber">
              Live college tasks
            </h2>
            <p className={styles.meta}>
              Block {currentBlock?.id} · {currentBlock?.name}. Open any task
              below, or browse all blocks from College tasks.
            </p>
            <ul className={styles.list}>
              {liveTasks.map((task) => {
                const sub = getTaskSubmission(task.id);
                return (
                  <li key={task.id}>
                    <Link
                      href={`/learner/college-tasks/${task.id}`}
                      className={styles.rowLink}
                    >
                      <div className={styles.rowMain}>
                        <strong>
                          Task {task.taskNumber}: {task.title}
                        </strong>
                        <span>
                          Block {task.blockId} · {task.evidenceRef}
                        </span>
                      </div>
                      <div className={styles.rowEnd}>
                        <LearnerStatusChip tone={statusTone(sub.status)}>
                          {statusLabel(sub.status)}
                        </LearnerStatusChip>
                        <span className={styles.linkish}>Open →</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          );
        })()}

        <section className={styles.section}>
          <h2 className={styles.dashSectionTitle} data-accent="navy">
            Blocks
          </h2>
          <p className={styles.meta}>
            Training blocks 1–10. Gateway and EPA are date-tracked (no OTJ).
            Task 5 reflection must be trainer-verified before the next block
            unlocks.
          </p>
          <ul className={styles.list}>
            {trainingBlocks.map((block) => {
              const tasks = tasksForBlock(block.id);
              const priorOk =
                block.id === 1 ||
                isBlockReflectionVerified(
                  block.id - 1,
                  tasksForBlock(block.id - 1),
                );
              const verifiedCount = tasks.filter(
                (t) => getTaskSubmission(t.id).status === "verified",
              ).length;
              const current =
                block.weekStart != null &&
                block.weekEnd != null &&
                profile.programmeWeek >= block.weekStart &&
                profile.programmeWeek <= block.weekEnd;
              const complete =
                tasks.length > 0 && verifiedCount === tasks.length;
              const locked = !priorOk;
              const taskCountLabel =
                tasks.length > 0
                  ? ` · ${verifiedCount}/${tasks.length} tasks verified`
                  : "";
              const lockLabel = !priorOk
                ? " · locked until previous reflection verified"
                : "";

              return (
                <li key={block.id}>
                  <Link
                    href={locked ? "#" : "/learner/college-tasks"}
                    className={`${styles.rowLink}${locked ? ` ${styles.rowLocked}` : ""}`}
                    data-tone={
                      locked
                        ? "navy"
                        : complete
                          ? "green"
                          : current
                            ? "amber"
                            : "blue"
                    }
                    aria-disabled={locked}
                    onClick={(e) => {
                      if (locked) e.preventDefault();
                    }}
                  >
                    <div className={styles.rowMain}>
                      <strong>
                        Block {block.id} · {block.name}
                      </strong>
                      <span>
                        Weeks {block.weekStart}–{block.weekEnd}
                        {taskCountLabel}
                        {lockLabel}
                      </span>
                    </div>
                    <div className={styles.rowEnd}>
                      <LearnerStatusChip
                        tone={
                          locked
                            ? "neutral"
                            : complete
                              ? "green"
                              : current
                                ? "amber"
                                : "blue"
                        }
                      >
                        {locked
                          ? "Locked"
                          : complete
                            ? "Complete"
                            : current
                              ? "Current"
                              : "Open"}
                      </LearnerStatusChip>
                      {!locked ? (
                        <span className={styles.linkish}>Tasks →</span>
                      ) : null}
                    </div>
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
