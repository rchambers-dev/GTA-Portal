"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "@/features/learner-portal/components/LearnerPageShell";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { useDemoSession } from "@/shell/demo/DemoSessionProvider";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import { AUTOCARE_BLOCKS } from "../domain/autocare-blocks";
import { tasksForBlock } from "../domain/autocare-tasks";
import { taskKindLabel } from "../domain/task-schema";
import { summariseBlockCompletion } from "../domain/progression-status";
import {
  forceVerifyBlock,
  forceVerifyTask,
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  resolveTaskStoreLearnerId,
  statusLabel,
  statusTone,
  subscribeTaskStore,
} from "../domain/task-submission-store";
import styles from "@/features/administration/screens/admin-pages.module.css";
import deliveryStyles from "./programme-delivery.module.css";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Management system action — backfill verified Autocare tasks/blocks so BRAG
 * reflects work already completed outside the portal (e.g. live intake load).
 */
export function ManagementForceCompleteTasksScreen() {
  const { session } = useDemoSession();
  const canAct = hasPermission(session, PERMISSIONS.RECORDS_PROXY_WRITE);
  const admin = useAdminStore();
  const taskSnap = useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );

  const enrolments = useMemo(
    () =>
      [...admin.enrolments].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    [admin.enrolments],
  );

  const [learnerId, setLearnerId] = useState<string>("");
  const [completedAt, setCompletedAt] = useState(todayIso);
  const [openBlockId, setOpenBlockId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (learnerId || enrolments.length === 0) return;
    setLearnerId(enrolments[0].learnerId ?? enrolments[0].id);
  }, [enrolments, learnerId]);

  const enrolment =
    enrolments.find((e) => (e.learnerId ?? e.id) === learnerId) ?? null;
  const storeLearnerId = resolveTaskStoreLearnerId(
    enrolment?.learnerId ?? learnerId,
  );
  const actorName = session.displayName || "Management";

  // Keep React subscribed to task mutations.
  void taskSnap;

  function applyOptions() {
    return {
      completedAtIso: completedAt,
      actorName,
      note: `Force-completed via management system action by ${actorName} (historical backfill).`,
    };
  }

  function onForceTask(taskId: string, label: string) {
    forceVerifyTask(taskId, storeLearnerId, applyOptions());
    setMessage(`Marked verified: ${label}`);
  }

  function onForceBlock(blockId: number, blockName: string) {
    const tasks = tasksForBlock(blockId);
    const n = forceVerifyBlock(tasks, storeLearnerId, applyOptions());
    setMessage(
      `Block ${blockId} · ${blockName} — marked ${n} task${n === 1 ? "" : "s"} verified.`,
    );
    setOpenBlockId(blockId);
  }

  if (!canAct) {
    return (
      <LearnerPageShell
        eyebrow="Management · System Actions"
        title="Force-complete tasks"
        description="You need the records.proxy.write permission to backfill verified college tasks."
      >
        <p className={styles.empty}>
          Ask an owner / SuperAdmin to grant proxy write access.
        </p>
      </LearnerPageShell>
    );
  }

  return (
    <LearnerPageShell
      eyebrow="Management · System Actions"
      title="Force-complete tasks"
      description="Backfill Autocare blocks and tasks learners have already completed. Marks them verified with a completion date so progression BRAG updates. Use for live intake load — not day-to-day tutor sign-off."
    >
      <div className={styles.stack}>
        <div className={styles.panel}>
          <p className={deliveryStyles.purposeNote}>
            Pick the learner and the date the work was finished (use a date
            inside the cohort block window if you want Blue / early-finish BRAG
            to calculate correctly). Then force-complete a whole block or
            individual tasks.
          </p>
          <div className={styles.toolbar}>
            <label className={styles.field} style={{ minWidth: "16rem" }}>
              <span>Learner</span>
              <select
                value={learnerId}
                onChange={(e) => {
                  setLearnerId(e.target.value);
                  setMessage(null);
                }}
              >
                {enrolments.length === 0 ? (
                  <option value="">No enrolments</option>
                ) : (
                  enrolments.map((e) => (
                    <option key={e.id} value={e.learnerId ?? e.id}>
                      {e.displayName} · {e.programmeName}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className={styles.field}>
              <span>Completed on</span>
              <input
                type="date"
                value={completedAt}
                onChange={(e) => setCompletedAt(e.target.value)}
              />
            </label>
            <Link
              href="/management/learner-brag"
              className={styles.secondaryBtn}
            >
              Open progression BRAG
            </Link>
          </div>
          {message ? <p className={styles.success}>{message}</p> : null}
          {!enrolment ? (
            <p className={styles.empty}>
              Enrol a learner first, then return here to backfill tasks.
            </p>
          ) : null}
        </div>

        {enrolment
          ? AUTOCARE_BLOCKS.map((block) => {
              const tasks = tasksForBlock(block.id);
              const summary = summariseBlockCompletion(tasks, storeLearnerId);
              const open = openBlockId === block.id;
              return (
                <article key={block.id} className={styles.panel}>
                  <div className={deliveryStyles.fundingBlockHead}>
                    <div>
                      <h2 className={styles.panelTitle}>
                        Block {block.id} · {block.name}
                      </h2>
                      <p className={styles.muted}>
                        {block.kind}
                        {block.weekStart != null && block.weekEnd != null
                          ? ` · weeks ${block.weekStart}–${block.weekEnd}`
                          : ""}
                        {" · "}
                        {summary.verified}/{summary.total} verified
                      </p>
                    </div>
                    <div className={styles.formActions}>
                      <LearnerStatusChip
                        tone={
                          summary.complete
                            ? "green"
                            : summary.verified > 0
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {summary.complete
                          ? "Block complete"
                          : summary.verified > 0
                            ? "Partial"
                            : "Not started"}
                      </LearnerStatusChip>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() =>
                          setOpenBlockId((current) =>
                            current === block.id ? null : block.id,
                          )
                        }
                      >
                        {open ? "Hide tasks" : "Show tasks"}
                      </button>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        disabled={tasks.length === 0 || summary.complete}
                        onClick={() => onForceBlock(block.id, block.name)}
                      >
                        {summary.complete
                          ? "Already complete"
                          : "Force-complete block"}
                      </button>
                    </div>
                  </div>

                  {open ? (
                    <ul className={styles.linkedLearnerList}>
                      {tasks.map((task) => {
                        const sub = getTaskSubmission(task.id, storeLearnerId);
                        const verified = sub.status === "verified";
                        return (
                          <li key={task.id}>
                            <div className={styles.linkedLearnerRow}>
                              <div className={styles.linkedLearnerMain}>
                                <strong>
                                  Task {task.number} · {task.title}
                                </strong>
                                <span>
                                  {taskKindLabel(task.kind)}
                                  {sub.trainerSignedAt
                                    ? ` · signed ${sub.trainerSignedAt.slice(0, 10)}`
                                    : ""}
                                </span>
                              </div>
                              <div className={styles.formActions}>
                                <LearnerStatusChip tone={statusTone(sub.status)}>
                                  {statusLabel(sub.status)}
                                </LearnerStatusChip>
                                <button
                                  type="button"
                                  className={styles.secondaryBtn}
                                  disabled={verified}
                                  onClick={() =>
                                    onForceTask(
                                      task.id,
                                      `Task ${task.number} · ${task.title}`,
                                    )
                                  }
                                >
                                  {verified ? "Verified" : "Force-complete"}
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </article>
              );
            })
          : null}
      </div>
    </LearnerPageShell>
  );
}
