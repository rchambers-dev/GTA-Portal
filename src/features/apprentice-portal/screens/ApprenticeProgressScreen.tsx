"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import { useApprenticePortalProfile } from "../hooks/useApprenticePortalProfile";
import {
  createBlankCeaState,
  resolveGroupsPack,
} from "../domain/cea";
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
  bragShortLabel,
  isApprenticeBlockUnlocked,
  milestoneChipTone,
  milestoneShortLabel,
  summariseBlockCompletion,
} from "@/features/programme-delivery/domain/progression-status";
import { buildGroupsBragBoard } from "@/features/programme-delivery/domain/groups-progression";
import { formatDisplayDate } from "@/features/apprentice-lifecycle/domain/programme-week";
import styles from "./apprentice-pages.module.css";

/**
 * Progress against the apprentice's delivery spine:
 * - groups → MV tracker month brackets + course %
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

  const groupsPack = useMemo(() => {
    if (!onGroups) return null;
    return resolveGroupsPack(
      profile.standardCode ?? "ST0499",
      profile.standardVersion ?? "1.2",
    );
  }, [onGroups, profile.standardCode, profile.standardVersion]);

  const groupsBoard = useMemo(() => {
    if (!groupsPack || !profile.programmeStartDate) return null;
    const state = createBlankCeaState(apprenticeId, groupsPack);
    return buildGroupsBragBoard({
      pack: groupsPack,
      state,
      programmeStartIso: profile.programmeStartDate,
    });
  }, [apprenticeId, groupsPack, profile.programmeStartDate]);

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

  const actualPercent = onGroups
    ? (groupsBoard?.progress.actualPercent ?? profile.actualProgressPercent)
    : profile.actualProgressPercent;
  const plannedPercent = onGroups
    ? (groupsBoard?.progress.plannedPercent ?? profile.plannedProgressPercent)
    : profile.plannedProgressPercent;
  const behindPlan = actualPercent < plannedPercent;
  const gap = Math.max(0, plannedPercent - actualPercent);

  const groupsComplete =
    groupsBoard?.trainingRows.filter((r) => r.summary.complete).length ?? 0;
  const groupsTotal = groupsBoard?.trainingRows.length ?? 0;

  return (
    <ApprenticePageShell
      title="Progress"
      description={
        onGroups
          ? `Planned versus actual on ${profile.programmeName} — tracked through personal tracking month brackets.`
          : `Planned versus actual on ${AUTOCARE_STANDARD.label} — tracked by programme weeks and college block tasks.`
      }
    >
      <div className={styles.stack}>
        <div className={styles.grid}>
          <div className={styles.glance} data-tone="navy">
            <p className={styles.glanceLabel}>
              {onGroups ? "Programme month plan" : "Programme week"}
            </p>
            <p className={styles.glanceValue}>
              {onGroups ? `${plannedPercent}%` : profile.programmeWeek}
            </p>
            <p className={styles.glanceHint}>
              {onGroups
                ? "Expected from tracker brackets so far"
                : `of ${AUTOCARE_STANDARD.deliveryWeeks} delivery weeks`}
            </p>
          </div>
          <div
            className={styles.glance}
            data-tone={behindPlan ? "amber" : "green"}
          >
            <p className={styles.glanceLabel}>Actual</p>
            <p className={styles.glanceValue}>{actualPercent}%</p>
            <p className={styles.glanceHint}>
              {behindPlan
                ? `${gap}% behind plan — focus on tracking and OTJ`
                : "On or ahead of plan"}
            </p>
          </div>
          <div className={styles.glance} data-tone="blue">
            <p className={styles.glanceLabel}>
              {onGroups ? "Groups complete" : "College tasks"}
            </p>
            <p className={styles.glanceValue}>
              {onGroups
                ? `${groupsComplete}/${groupsTotal}`
                : `${taskStats.verified}/${taskStats.total}`}
            </p>
            <p className={styles.glanceHint}>
              {onGroups
                ? "Mandatory quota met on personal tracking"
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
                style={{ width: `${plannedPercent}%` }}
              />
              <div
                className={styles.progressFill}
                data-tone={behindPlan ? "amber" : "green"}
                style={{ width: `${actualPercent}%` }}
              />
            </div>
            <div className={styles.progressLegend}>
              <span data-tone="navy">
                <i aria-hidden /> Planned {plannedPercent}%
              </span>
              <span data-tone={behindPlan ? "amber" : "green"}>
                <i aria-hidden /> Actual {actualPercent}%
              </span>
            </div>
          </div>
        </section>

        {onGroups ? (
          <>
            <section className={styles.section}>
              <h2 className={styles.dashSectionTitle} data-accent="amber">
                Tracker phases
              </h2>
              <p className={styles.meta}>
                Month brackets from your personal tracking sheet. Complete each
                group&apos;s mandatory work before the phase end to stay on
                track.
              </p>
              {!groupsBoard ? (
                <p className={styles.meta}>
                  Groups pack not available for this programme yet.
                </p>
              ) : (
                <ul className={styles.list}>
                  {groupsBoard.trainingRows.map((row) => {
                    const tone = row.brag ?? "neutral";
                    return (
                      <li key={row.group.id}>
                        <div className={styles.rowLink} data-tone={tone === "blue" ? "navy" : tone === "neutral" ? "navy" : tone}>
                          <div className={styles.rowMain}>
                            <strong>
                              Group {row.group.number} · {row.group.title}
                            </strong>
                            <span>
                              {row.milestone.phaseLabel}
                              {row.window
                                ? ` · due ${formatDisplayDate(new Date(`${row.window.endIso}T12:00:00.000Z`))}`
                                : ""}
                              {row.courseWeightPercent > 0
                                ? ` · ${row.courseWeightPercent}%`
                                : ""}
                              {` · ${row.summary.mandatorySigned}/${row.summary.mandatoryRequired} mandatory`}
                            </span>
                          </div>
                          <div className={styles.rowEnd}>
                            <ApprenticeStatusChip
                              tone={
                                row.brag === "blue"
                                  ? "blue"
                                  : row.brag === "green"
                                    ? "green"
                                    : row.brag === "amber"
                                      ? "amber"
                                      : row.brag === "red"
                                        ? "red"
                                        : "neutral"
                              }
                            >
                              {row.brag
                                ? bragShortLabel(row.brag)
                                : "Not due yet"}
                            </ApprenticeStatusChip>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {groupsBoard && groupsBoard.milestoneRows.length > 0 ? (
              <section className={styles.section}>
                <h2 className={styles.dashSectionTitle} data-accent="navy">
                  Gateways &amp; EPA
                </h2>
                <ul className={styles.list}>
                  {groupsBoard.milestoneRows.map((row) => (
                    <li key={row.milestone.id}>
                      <div className={styles.rowLink}>
                        <div className={styles.rowMain}>
                          <strong>{row.milestone.title}</strong>
                          <span>
                            {row.milestone.phaseLabel}
                            {row.window?.endIso
                              ? ` · due ${formatDisplayDate(new Date(`${row.window.endIso}T12:00:00.000Z`))}`
                              : ""}
                          </span>
                        </div>
                        <div className={styles.rowEnd}>
                          <ApprenticeStatusChip
                            tone={milestoneChipTone(row.status)}
                          >
                            {milestoneShortLabel(row.status)}
                          </ApprenticeStatusChip>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className={styles.section}>
              <h2 className={styles.dashSectionTitle} data-accent="green">
                Personal tracking
              </h2>
              <p className={styles.meta}>
                Open personal tracking for group tasks, workplace evidence and
                gateway reflections.
              </p>
              <p>
                <Link href="/apprentice/tracking" className={styles.linkish}>
                  Open personal tracking →
                </Link>
              </p>
            </section>
          </>
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
