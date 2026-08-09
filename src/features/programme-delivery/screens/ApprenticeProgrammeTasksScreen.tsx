"use client";

import Link from "next/link";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { useApprenticePortalProfile } from "@/features/apprentice-portal/hooks/useApprenticePortalProfile";
import { formatCohortBlockWindow } from "../domain/rpl-funding-calc";
import {
  apprenticeBlockRag,
  apprenticeBlockRagLabel,
  apprenticeTaskRag,
  apprenticeTaskRagLabel,
  summariseBlockCompletion,
} from "../domain/progression-status";
import { isDeliveryBlockUnlocked } from "../domain/delivery-unlock";
import {
  tasksForDeliveryBlock,
} from "../domain/published-delivery-catalogue";
import { usePublishedDeliveryCatalogue } from "../domain/use-published-delivery-catalogue";
import { taskKindLabel } from "../domain/task-schema";
import {
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  subscribeTaskStore,
} from "../domain/task-submission-store";
import styles from "./programme-delivery.module.css";

/**
 * Apprentice college tasks from pinned GTA programme version published content.
 */
export function ApprenticeProgrammeTasksScreen() {
  const router = useRouter();
  const { profile, loading, error } = useApprenticePortalProfile();
  const apprenticeId = profile.apprenticeId || "";
  useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );

  const onBlocks = profile.deliverySpine === "blocks";
  const { catalogue, loading: catalogueLoading } = usePublishedDeliveryCatalogue({
    programmeVersionId: profile.gtaProgrammeVersionId,
    apprenticeId: apprenticeId || null,
    enabled: !loading && onBlocks,
  });

  useEffect(() => {
    if (loading) return;
    if (profile.deliverySpine && profile.deliverySpine !== "blocks") {
      router.replace("/apprentice/tracking");
    }
  }, [loading, profile.deliverySpine, router]);

  const taskedBlocks = useMemo(
    () =>
      catalogue.blocks.filter(
        (b) => tasksForDeliveryBlock(catalogue, b.spineItemId).length > 0,
      ),
    [catalogue],
  );

  if (loading || (onBlocks && catalogueLoading)) {
    return (
      <ApprenticePageShell
        title="Personal tracking"
        description="Loading your programme…"
      >
        <p className={styles.purposeBody}>Loading college tasks…</p>
      </ApprenticePageShell>
    );
  }

  if (profile.deliverySpine && profile.deliverySpine !== "blocks") {
    return (
      <ApprenticePageShell
        title="Personal tracking"
        description="Redirecting to your groups spine…"
      >
        <p className={styles.purposeBody}>
          You are enrolled on the groups spine. Opening personal tracking…
        </p>
      </ApprenticePageShell>
    );
  }

  if (catalogue.status !== "ready") {
    return (
      <ApprenticePageShell
        title="Personal tracking"
        description="College practicals for your pinned programme version."
      >
        <div className={styles.root}>
          <div className={styles.purpose}>
            <p className={styles.purposeLead}>
              <strong>
                {catalogue.status === "unpinned"
                  ? "Programme version not assigned"
                  : catalogue.status === "empty_published"
                    ? "Course content not yet published"
                    : "Programme version unavailable"}
              </strong>
            </p>
            <p className={styles.purposeBody}>{catalogue.message}</p>
          </div>
        </div>
      </ApprenticePageShell>
    );
  }

  const titleBits = [
    catalogue.programmeTitle,
    catalogue.standardCode,
    catalogue.externalVersion
      ? `SE v${catalogue.externalVersion}`
      : null,
    catalogue.internalVersion
      ? `GTA v${catalogue.internalVersion}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ApprenticePageShell
      title="Personal tracking"
      description="College practicals and block reflections for your programme. Complete these in the portal where you can — or upload the PDFs if you could not get on that college day."
    >
      <div className={styles.root}>
        {error ? (
          <p className={styles.purposeBody} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.purpose}>
          <p className={styles.purposeLead}>
            <strong>{titleBits || "Programme"}</strong>
            {" · Week "}
            {profile.programmeWeek}
            {" · "}
            {profile.collegeDays}
          </p>
          <p className={styles.purposeBody}>
            Tasks come from your assigned GTA programme version (Course Builder,
            published only). Blocks you have already reached stay open together so
            catch-up can stack.
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
          {taskedBlocks.map((block, index) => {
            const tasks = tasksForDeliveryBlock(catalogue, block.spineItemId);
            const prior =
              index > 0
                ? tasksForDeliveryBlock(
                    catalogue,
                    taskedBlocks[index - 1]!.spineItemId,
                  )
                : [];
            const cohortWindow = formatCohortBlockWindow(
              profile.programmeStartDate,
              block.weekStart,
              block.weekEnd,
            );
            const locked = !isDeliveryBlockUnlocked({
              block,
              blocks: catalogue.blocks,
              programmeWeek: profile.programmeWeek,
              priorBlockTasks: prior,
              apprenticeId,
            });
            const summary = summariseBlockCompletion(tasks, apprenticeId);
            const blockRag = apprenticeBlockRag(summary, locked);

            return (
              <article
                key={block.spineItemId}
                className={styles.blockCard}
                data-rag={blockRag}
              >
                <div className={styles.blockHead}>
                  <div>
                    <h2 className={styles.blockTitle}>
                      Block {block.displayOrdinal} · {block.title}
                    </h2>
                    <p className={styles.blockMeta}>
                      {block.weekStart != null && block.weekEnd != null
                        ? `Weeks ${block.weekStart}–${block.weekEnd}`
                        : `Sequence ${block.sequence}`}
                      {cohortWindow ? ` · ${cohortWindow}` : ""}
                      {block.plannedOtjHours > 0
                        ? ` · ${block.plannedOtjHours} hrs planned OTJ`
                        : ""}
                    </p>
                  </div>
                  <ApprenticeStatusChip
                    tone={blockRag === "neutral" ? "neutral" : blockRag}
                  >
                    {apprenticeBlockRagLabel(blockRag, summary)}
                  </ApprenticeStatusChip>
                </div>
                <ul className={styles.taskList}>
                  {tasks.map((task) => {
                    const sub = getTaskSubmission(task.id, apprenticeId);
                    const taskRag = apprenticeTaskRag(sub.status, locked);
                    const href = locked
                      ? "#"
                      : `/apprentice/tracking/${task.id}`;
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
