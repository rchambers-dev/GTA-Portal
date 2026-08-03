"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import { useApprenticePortalProfile } from "../hooks/useApprenticePortalProfile";
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
  statusLabel,
  statusTone,
  subscribeTaskStore,
} from "@/features/programme-delivery/domain/task-submission-store";
import {
  apprenticeBlockRag,
  apprenticeBlockRagLabel,
  isApprenticeBlockUnlocked,
  summariseBlockCompletion,
} from "@/features/programme-delivery/domain/progression-status";
import styles from "./apprentice-pages.module.css";

/**
 * Progress against the apprentice's delivery spine:
 * - groups → personal tracking overview
 * - blocks → programme weeks and college block tasks
 */
export function ApprenticeProgressScreen() {
  const { profile } = useApprenticePortalProfile();
  const apprenticeId = profile.apprenticeId || "live-apprentice";
  const onGroups = profile.deliverySpine !== "blocks";
  useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );

  const taskedBlocks = useMemo(
    () => AUTOCARE_BLOCKS.filter((b) => tasksForBlock(b.id).length > 0),
    [],
  );

  let verified = 0;
  let inFlight = 0;
  let notStarted = 0;
  for (const task of AUTOCARE_PRACTICAL_TASKS) {
    const status = getTaskSubmission(task.id, apprenticeId).status;
    if (status === "verified") verified += 1;
    else if (status === "not_started") notStarted += 1;
    else inFlight += 1;
  }
  const taskStats = {
    verified,
    inFlight,
    notStarted,
    total: AUTOCARE_PRACTICAL_TASKS.length,
  };

  const behindPlan =
    profile.actualProgressPercent < profile.plannedProgressPercent;
  const gap = Math.max(
    0,
    profile.plannedProgressPercent - profile.actualProgressPercent,
  );

  return (
    <ApprenticePageShell
      title="Progress"
      description={
        onGroups
          ? `Planned versus actual on ${profile.programmeName} — tracked through personal tracking groups.`
          : `Planned versus actual on ${AUTOCARE_STANDARD.label} — tracked by programme weeks and college block tasks.`
      }
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
                ? `${gap}% behind plan — focus on tracking and OTJ`
                : "On or ahead of plan"}
            </p>
          </div>
          <div className={styles.glance} data-tone="blue">
            <p className={styles.glanceLabel}>
              {onGroups ? "Personal tracking" : "College tasks"}
            </p>
            <p className={styles.glanceValue}>
              {onGroups
                ? `${profile.actualProgressPercent}%`
                : `${taskStats.verified}/${taskStats.total}`}
            </p>
            <p className={styles.glanceHint}>
              {onGroups
                ? "Open tracking for group and task detail"
                : `${taskStats.inFlight} in flight · ${taskStats.notStarted} not started`}
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

        {onGroups ? (
          <section className={styles.section}>
            <h2 className={styles.dashSectionTitle} data-accent="amber">
              Personal tracking
            </h2>
            <p className={styles.meta}>
              You are on the groups delivery spine. Group completion, workplace
              tasks and gateways live in personal tracking.
            </p>
            <p>
              <Link href="/apprentice/tracking" className={styles.linkish}>
                Open personal tracking →
              </Link>
            </p>
          </section>
        ) : (
          <>
            {(() => {
              const currentBlock =
                taskedBlocks.find(
                  (b) =>
                    b.weekStart != null &&
                    b.weekEnd != null &&
                    profile.programmeWeek >= b.weekStart &&
                    profile.programmeWeek <= b.weekEnd,
                ) ?? taskedBlocks[0];
              const liveTasks = tasksForBlock(currentBlock?.id ?? 1);
              if (liveTasks.length === 0) return null;
              return (
                <section className={styles.section}>
                  <h2 className={styles.dashSectionTitle} data-accent="amber">
                    Live college tasks
                  </h2>
                  <p className={styles.meta}>
                    Block {currentBlock?.id} · {currentBlock?.name}. Open any
                    task below, or browse all blocks from Personal tracking.
                  </p>
                  <ul className={styles.list}>
                    {liveTasks.map((task) => {
                      const sub = getTaskSubmission(task.id, apprenticeId);
                      return (
                        <li key={task.id}>
                          <Link
                            href={`/apprentice/tracking/${task.id}`}
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
                              <ApprenticeStatusChip
                                tone={statusTone(sub.status)}
                              >
                                {statusLabel(sub.status)}
                              </ApprenticeStatusChip>
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
                All 12 blocks (60 tasks). Green = complete, amber = in progress,
                red = needs completing. Blocks already reached stay open together
                for catch-up — being behind does not re-lock later blocks.
              </p>
              <ul className={styles.list}>
                {taskedBlocks.map((block) => {
                  const tasks = tasksForBlock(block.id);
                  const locked = !isApprenticeBlockUnlocked({
                    blockId: block.id,
                    weekStart: block.weekStart,
                    programmeWeek: profile.programmeWeek,
                    priorBlockTasks: tasksForBlock(block.id - 1),
                    apprenticeId,
                  });
                  const summary = summariseBlockCompletion(tasks, apprenticeId);
                  const rag = apprenticeBlockRag(summary, locked);
                  const current =
                    block.weekStart != null &&
                    block.weekEnd != null &&
                    profile.programmeWeek >= block.weekStart &&
                    profile.programmeWeek <= block.weekEnd;
                  const tone =
                    rag === "neutral"
                      ? "navy"
                      : rag === "green"
                        ? "green"
                        : rag === "amber"
                          ? "amber"
                          : "red";

                  return (
                    <li key={block.id}>
                      <Link
                        href={locked ? "#" : "/apprentice/tracking"}
                        className={`${styles.rowLink}${locked ? ` ${styles.rowLocked}` : ""}`}
                        data-tone={tone}
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
                            {block.weekStart != null && block.weekEnd != null
                              ? `Weeks ${block.weekStart}–${block.weekEnd}`
                              : block.kind === "epa"
                                ? "EPA assessment"
                                : "Pre-EPA consolidation"}
                            {current ? " · current week" : ""}
                            {` · ${summary.verified}/${summary.total} verified`}
                          </span>
                        </div>
                        <div className={styles.rowEnd}>
                          <ApprenticeStatusChip
                            tone={rag === "neutral" ? "neutral" : rag}
                          >
                            {apprenticeBlockRagLabel(rag, summary)}
                          </ApprenticeStatusChip>
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
          </>
        )}
      </div>
    </ApprenticePageShell>
  );
}
