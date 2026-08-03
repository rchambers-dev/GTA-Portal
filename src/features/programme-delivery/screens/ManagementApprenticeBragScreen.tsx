"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { formatDisplayDate } from "@/features/apprentice-lifecycle/domain/programme-week";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { AUTOCARE_BLOCKS, AUTOCARE_STANDARD } from "../domain/autocare-blocks";
import {
  AUTOCARE_GATEWAYS,
  gatewayMilestoneAnchorLabel,
  gatewayMilestoneDueIso,
} from "../domain/gateways";
import { tasksForBlock } from "../domain/autocare-tasks";
import { taskKindLabel } from "../domain/task-schema";
import {
  blockCohortWindowDates,
  bragLabel,
  bragShortLabel,
  calculateBlockProgressionBrag,
  calculateMilestoneStatus,
  milestoneChipTone,
  milestoneLabel,
  milestoneShortLabel,
  rollUpProgressionBrag,
  summariseBlockCompletion,
  type ProgressionBrag,
} from "../domain/progression-status";
import {
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  resolveTaskStoreApprenticeId,
  statusLabel,
  statusTone,
  subscribeTaskStore,
} from "../domain/task-submission-store";
import styles from "@/features/administration/screens/admin-pages.module.css";
import deliveryStyles from "./programme-delivery.module.css";

type PieSlice = { key: string; label: string; count: number; color: string };

function buildConicGradient(slices: PieSlice[]): string {
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  if (total <= 0) {
    return "conic-gradient(from -90deg, #e2e8f0 0 100%)";
  }
  let cursor = 0;
  const stops: string[] = [];
  for (const slice of slices) {
    if (slice.count <= 0) continue;
    const start = (cursor / total) * 100;
    cursor += slice.count;
    const end = (cursor / total) * 100;
    stops.push(`${slice.color} ${start}% ${end}%`);
  }
  return `conic-gradient(from -90deg, ${stops.join(", ")})`;
}

function BragPieCard({
  title,
  centerValue,
  centerLabel,
  slices,
  ariaLabel,
}: {
  title: string;
  centerValue: string;
  centerLabel: string;
  slices: PieSlice[];
  ariaLabel: string;
}) {
  return (
    <article className={deliveryStyles.pieCard}>
      <p className={deliveryStyles.pieCardTitle}>{title}</p>
      <div className={deliveryStyles.pieBlock}>
        <div
          className={deliveryStyles.pie}
          style={{ background: buildConicGradient(slices) }}
          role="img"
          aria-label={ariaLabel}
        >
          <div className={deliveryStyles.pieHole}>
            <strong>{centerValue}</strong>
            <span>{centerLabel}</span>
          </div>
        </div>
        <ul className={deliveryStyles.pieLegend}>
          {slices.map((slice) => (
            <li key={slice.key}>
              <span
                className={deliveryStyles.pieLegendDot}
                style={{ background: slice.color }}
              />
              {slice.label}
              <strong>{slice.count}</strong>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/**
 * Management progression BRAG — training blocks use Blue/Green/Amber/Red.
 * Gateway / EPA use Green (complete) / Amber (on track) / Red (behind).
 */
export function ManagementApprenticeBragScreen() {
  const taskSnap = useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );
  const admin = useAdminStore();
  const [apprenticeId, setApprenticeId] = useState<string>("");
  const [openBlockId, setOpenBlockId] = useState<number | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("apprentice");
    if (q) setApprenticeId(q);
  }, []);

  const enrolments = useMemo(
    () =>
      admin.enrolments
        .filter((e) => e.status === "active" || e.status === "pending_start")
        .slice()
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [admin.enrolments],
  );

  const enrolment = enrolments.find((e) => e.apprenticeId === apprenticeId) ?? null;
  const cohort = enrolment?.cohortId
    ? admin.cohorts.find((c) => c.id === enrolment.cohortId)
    : null;
  const cohortStartDate =
    cohort?.startDate || enrolment?.startDate || "2024-09-02";
  const deliveryEnd =
    cohort?.expectedEndDate || enrolment?.originalPlannedEndDate || null;
  const storeApprenticeId = resolveTaskStoreApprenticeId(apprenticeId);

  const { trainingRows, epaBlockSummary, milestoneRows } = useMemo(() => {
    void taskSnap;
    const training = [];
    let epaSummary = null as ReturnType<typeof summariseBlockCompletion> | null;

    for (const block of AUTOCARE_BLOCKS) {
      const tasks = tasksForBlock(block.id);
      if (tasks.length === 0) continue;
      const summary = summariseBlockCompletion(tasks, storeApprenticeId);

      if (block.kind === "training") {
        const window = blockCohortWindowDates(block, cohortStartDate);
        const brag = calculateBlockProgressionBrag({
          windowStartIso: window?.startIso ?? null,
          windowEndIso: window?.endIso ?? null,
          complete: summary.complete,
          completedAtIso: summary.completedAt,
        });
        training.push({ block, summary, window, brag });
        continue;
      }

      if (block.kind === "epa") {
        epaSummary = summary;
      }
    }

    const milestones = AUTOCARE_GATEWAYS.map((gw) => {
      const dueIso = gatewayMilestoneDueIso({
        milestone: gw,
        cohortStartIso: cohortStartDate,
        deliveryEndIso: deliveryEnd,
      });
      const complete =
        gw.kind === "epa" ? Boolean(epaSummary?.complete) : false;
      const milestone = calculateMilestoneStatus({
        kind: gw.kind,
        complete,
        dueIso,
      });
      return { gw, dueIso, milestone, complete };
    });

    return {
      trainingRows: training,
      epaBlockSummary: epaSummary,
      milestoneRows: milestones,
    };
  }, [cohortStartDate, deliveryEnd, storeApprenticeId, taskSnap]);

  const overall = rollUpProgressionBrag(
    trainingRows.map((row) => ({
      brag: row.brag,
      windowEndIso: row.window?.endIso ?? null,
      complete: row.summary.complete,
    })),
  );

  const charts = useMemo(() => {
    const bragCounts = {
      blue: 0,
      green: 0,
      amber: 0,
      red: 0,
      notDue: 0,
    };
    let verified = 0;
    let inFlight = 0;
    let notStartedOverdue = 0;
    let notStartedPending = 0;
    let taskTotal = 0;

    for (const row of trainingRows) {
      if (row.brag === "blue") bragCounts.blue += 1;
      else if (row.brag === "green") bragCounts.green += 1;
      else if (row.brag === "amber") bragCounts.amber += 1;
      else if (row.brag === "red") bragCounts.red += 1;
      else bragCounts.notDue += 1;

      verified += row.summary.verified;
      inFlight += row.summary.inFlight;
      if (row.brag === "red") {
        notStartedOverdue += row.summary.notStarted;
      } else {
        notStartedPending += row.summary.notStarted;
      }
      taskTotal += row.summary.total;
    }

    if (epaBlockSummary) {
      verified += epaBlockSummary.verified;
      inFlight += epaBlockSummary.inFlight;
      const epaMilestone = milestoneRows.find((m) => m.gw.kind === "epa");
      if (epaMilestone?.milestone === "behind") {
        notStartedOverdue += epaBlockSummary.notStarted;
      } else {
        notStartedPending += epaBlockSummary.notStarted;
      }
      taskTotal += epaBlockSummary.total;
    }

    const milestoneCounts = {
      complete: 0,
      onTrack: 0,
      behind: 0,
      notDue: 0,
    };
    for (const row of milestoneRows) {
      if (row.milestone === "complete") milestoneCounts.complete += 1;
      else if (row.milestone === "on_track") milestoneCounts.onTrack += 1;
      else if (row.milestone === "behind") milestoneCounts.behind += 1;
      else milestoneCounts.notDue += 1;
    }

    const trainingBragSlices: PieSlice[] = [
      { key: "blue", label: "Blue — early", count: bragCounts.blue, color: "#3b82f6" },
      { key: "green", label: "Green — on track", count: bragCounts.green, color: "#22c55e" },
      { key: "amber", label: "Amber — at risk", count: bragCounts.amber, color: "#f59e0b" },
      { key: "red", label: "Red — overdue", count: bragCounts.red, color: "#ef4444" },
      { key: "notDue", label: "Not due yet", count: bragCounts.notDue, color: "#94a3b8" },
    ];

    const taskSlices: PieSlice[] = [
      { key: "verified", label: "Verified", count: verified, color: "#22c55e" },
      { key: "inFlight", label: "In progress", count: inFlight, color: "#f59e0b" },
      {
        key: "overdue",
        label: "Overdue — not started",
        count: notStartedOverdue,
        color: "#ef4444",
      },
      {
        key: "notDue",
        label: "Not started (not due)",
        count: notStartedPending,
        color: "#64748b",
      },
    ];

    const milestoneSlices: PieSlice[] = [
      {
        key: "complete",
        label: "Complete",
        count: milestoneCounts.complete,
        color: "#22c55e",
      },
      {
        key: "onTrack",
        label: "On track",
        count: milestoneCounts.onTrack,
        color: "#f59e0b",
      },
      {
        key: "behind",
        label: "Behind",
        count: milestoneCounts.behind,
        color: "#ef4444",
      },
      {
        key: "notDue",
        label: "Date TBC",
        count: milestoneCounts.notDue,
        color: "#94a3b8",
      },
    ];

    return {
      trainingBragSlices,
      taskSlices,
      milestoneSlices,
      trainingBlockTotal: trainingRows.length,
      taskTotal,
      verified,
      milestoneTotal: milestoneRows.length,
    };
  }, [epaBlockSummary, milestoneRows, trainingRows]);

  return (
    <ApprenticePageShell
      title="Apprentice progression BRAG"
      description="Training blocks use Blue / Green / Amber / Red against cohort dates. Gateway 1, Gateway 2 and EPA use Green / Amber / Red (RAG) so they stay clear of training-block Blue."
      eyebrow="Management"
    >
      <div className={styles.root}>
        <div className={deliveryStyles.purpose}>
          <p className={deliveryStyles.purposeLead}>
            <strong>
              {AUTOCARE_STANDARD.label} · {AUTOCARE_STANDARD.code}{" "}
              {AUTOCARE_STANDARD.version}
            </strong>
          </p>
          <p className={deliveryStyles.purposeBody}>
            Overall BRAG is the worst <em>training</em> block that is due or
            complete. Pies at the top summarise the same numbers so you can
            screenshot and check the split quickly.
          </p>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.field} style={{ minWidth: "16rem" }}>
            <span>Apprentice</span>
            <select
              value={apprenticeId}
              onChange={(e) => {
                setApprenticeId(e.target.value);
                setOpenBlockId(null);
                const url = new URL(window.location.href);
                url.searchParams.set("apprentice", e.target.value);
                window.history.replaceState({}, "", url.toString());
              }}
            >
              {enrolments.map((e) => (
                <option key={e.id} value={e.apprenticeId ?? e.id}>
                  {e.displayName} · {e.programmeName}
                </option>
              ))}
            </select>
          </label>
        </div>

        {enrolment ? (
          <div className={deliveryStyles.bragBoard}>
            <div
              className={deliveryStyles.bragOverall}
              data-brag={overall ?? undefined}
            >
              <p className={deliveryStyles.purposeLabel}>
                Overall training progression
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  alignItems: "center",
                }}
              >
                {overall ? (
                  <ApprenticeStatusChip tone={overall} size="lg">
                    {bragLabel(overall)}
                  </ApprenticeStatusChip>
                ) : (
                  <ApprenticeStatusChip tone="neutral" size="lg">
                    No due training blocks yet
                  </ApprenticeStatusChip>
                )}
              </div>
              <p className={styles.muted}>
                {enrolment.displayName}
                {" · "}
                {cohort?.name ?? "No cohort"}
                {" · start "}
                {formatDisplayDate(
                  new Date(`${cohortStartDate}T12:00:00.000Z`),
                )}
                {deliveryEnd
                  ? ` · delivery end ${formatDisplayDate(new Date(`${deliveryEnd}T12:00:00.000Z`))}`
                  : ""}
              </p>
            </div>

            <div className={deliveryStyles.pieGrid}>
              <BragPieCard
                title="Training BRAG mix"
                centerValue={`${charts.trainingBlockTotal}`}
                centerLabel="blocks"
                slices={charts.trainingBragSlices}
                ariaLabel={`Training BRAG mix across ${charts.trainingBlockTotal} blocks`}
              />
              <BragPieCard
                title="All tasks (60)"
                centerValue={`${charts.verified}/${charts.taskTotal}`}
                centerLabel="verified"
                slices={charts.taskSlices}
                ariaLabel={`Task status: ${charts.verified} verified of ${charts.taskTotal}`}
              />
              <BragPieCard
                title="Gateway 1 · 2 · EPA"
                centerValue={`${charts.milestoneTotal}`}
                centerLabel="milestones"
                slices={charts.milestoneSlices}
                ariaLabel={`Gateway and EPA milestone status across ${charts.milestoneTotal} items`}
              />
            </div>

            <h2 className={styles.panelTitle}>Training blocks</h2>
            <p className={styles.muted}>
              Select a block to expand its tasks, then open a task to review
              the quality of work submitted.
            </p>
            {trainingRows.map(({ block, summary, window, brag }) => {
              const open = openBlockId === block.id;
              const tasks = tasksForBlock(block.id);
              return (
                <article
                  key={block.id}
                  className={deliveryStyles.bragRow}
                  data-brag={brag ?? undefined}
                >
                  <button
                    type="button"
                    className={deliveryStyles.fundingBlockHead}
                    onClick={() => setOpenBlockId(open ? null : block.id)}
                    aria-expanded={open}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      font: "inherit",
                      color: "inherit",
                    }}
                  >
                    <div>
                      <h3 className={styles.panelTitle}>
                        Block {block.id} · {block.name}
                      </h3>
                      <p className={styles.muted}>
                        {window
                          ? `${formatDisplayDate(new Date(`${window.startIso}T12:00:00.000Z`))} – ${formatDisplayDate(new Date(`${window.endIso}T12:00:00.000Z`))}`
                          : "No cohort week window"}
                        {" · "}
                        {summary.verified}/{summary.total} tasks verified
                        {summary.complete ? " · block complete" : ""}
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        alignItems: "center",
                      }}
                    >
                      {brag ? (
                        <ApprenticeStatusChip tone={brag as ProgressionBrag}>
                          {bragShortLabel(brag)}
                        </ApprenticeStatusChip>
                      ) : (
                        <ApprenticeStatusChip tone="neutral">
                          Not due yet
                        </ApprenticeStatusChip>
                      )}
                      <span className={styles.muted} aria-hidden>
                        {open ? "▴" : "▾"}
                      </span>
                    </div>
                  </button>
                  <p className={deliveryStyles.fundingMeta}>
                    {brag
                      ? bragLabel(brag)
                      : "Window has not started — not rated Green until the block is active"}
                    {summary.completedAt
                      ? ` · completed ${formatDisplayDate(new Date(summary.completedAt))}`
                      : ""}
                  </p>
                  {open ? (
                    <ul className={deliveryStyles.taskList}>
                      {tasks.map((task) => {
                        const sub = getTaskSubmission(task.id, storeApprenticeId);
                        const canOpen =
                          sub.status !== "not_started" ||
                          Object.keys(sub.fields).length > 0;
                        const href = `/management/apprentice-brag/task/${task.id}?apprentice=${encodeURIComponent(apprenticeId)}`;
                        const notStartedTone =
                          brag === "red" ? "red" : "neutral";
                        const notStartedRag =
                          brag === "red" ? "red" : "neutral";
                        return (
                          <li key={task.id}>
                            {canOpen ? (
                              <Link
                                href={href}
                                className={deliveryStyles.taskRow}
                                data-rag={
                                  sub.status === "verified"
                                    ? "green"
                                    : sub.status === "not_started"
                                      ? notStartedRag
                                      : "amber"
                                }
                              >
                                <div className={deliveryStyles.taskMain}>
                                  <strong>
                                    Task {task.taskNumber}: {task.title}
                                  </strong>
                                  <span>
                                    {taskKindLabel(task.kind)}
                                    {sub.difficulty
                                      ? ` · ${sub.difficulty}`
                                      : ""}
                                  </span>
                                </div>
                                <div className={deliveryStyles.taskEnd}>
                                  <ApprenticeStatusChip
                                    tone={
                                      sub.status === "not_started"
                                        ? notStartedTone
                                        : statusTone(sub.status)
                                    }
                                  >
                                    {sub.status === "not_started" &&
                                    brag === "red"
                                      ? "Overdue"
                                      : statusLabel(sub.status)}
                                  </ApprenticeStatusChip>
                                  <span className={deliveryStyles.linkish}>
                                    View work →
                                  </span>
                                </div>
                              </Link>
                            ) : (
                              <div
                                className={deliveryStyles.taskRow}
                                data-rag={notStartedRag}
                              >
                                <div className={deliveryStyles.taskMain}>
                                  <strong>
                                    Task {task.taskNumber}: {task.title}
                                  </strong>
                                  <span>
                                    {taskKindLabel(task.kind)} · no submission
                                    yet
                                  </span>
                                </div>
                                <ApprenticeStatusChip tone={notStartedTone}>
                                  {brag === "red" ? "Overdue" : "Not started"}
                                </ApprenticeStatusChip>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </article>
              );
            })}

            <h2 className={styles.panelTitle}>Gateway &amp; EPA milestones</h2>
            <p className={styles.muted}>
              Separate from training blocks (MBB model). Gateway 1 after Block 5
              (~12 months), Gateway 2 after Block 10 (~24 months), EPA at cohort
              delivery end. Green = complete, amber = on track, red = behind.
            </p>
            {milestoneRows.map(({ gw, dueIso, milestone }) => {
              const tone = milestoneChipTone(milestone);
              return (
                <article
                  key={gw.id}
                  className={deliveryStyles.milestoneRow}
                  data-milestone={milestone}
                >
                  <div className={deliveryStyles.fundingBlockHead}>
                    <div>
                      <h3 className={styles.panelTitle}>{gw.name}</h3>
                      <p className={styles.muted}>
                        Due{" "}
                        {dueIso
                          ? formatDisplayDate(
                              new Date(`${dueIso}T12:00:00.000Z`),
                            )
                          : "TBC"}
                        {" · "}
                        {gatewayMilestoneAnchorLabel(gw)}
                      </p>
                    </div>
                    <ApprenticeStatusChip tone={tone}>
                      {milestoneShortLabel(milestone)}
                    </ApprenticeStatusChip>
                  </div>
                  <p className={deliveryStyles.fundingMeta}>
                    {gw.description}
                    {" · "}
                    {milestoneLabel(gw.name, milestone)}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.muted}>No enrolment selected.</p>
        )}
      </div>
    </ApprenticePageShell>
  );
}
