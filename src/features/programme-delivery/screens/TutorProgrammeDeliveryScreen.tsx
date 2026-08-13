"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { Select } from "@/components/ui/Select";
import { isDeliveryBlockUnlocked } from "../domain/delivery-unlock";
import {
  tasksForDeliveryBlock,
} from "../domain/published-delivery-catalogue";
import { usePublishedDeliveryCatalogue } from "../domain/use-published-delivery-catalogue";
import {
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  listAwaitingTrainer,
  resolveTaskStoreApprenticeId,
  statusLabel,
  statusTone,
  subscribeTaskStore,
} from "../domain/task-submission-store";
import styles from "./programme-delivery.module.css";

type Tab = "queue" | "blocks";

/**
 * Tutor programme delivery — published Course Builder tasks for a selected
 * learner's pinned GTA programme version. No Autocare static fallback.
 */
export function TutorProgrammeDeliveryScreen() {
  const [tab, setTab] = useState<Tab>("queue");
  const admin = useAdminStore();
  const enrolments = useMemo(
    () =>
      admin.enrolments
        .filter((e) => e.apprenticeId)
        .slice()
        .sort((a, b) =>
          (a.displayName || a.apprenticeId || "").localeCompare(
            b.displayName || b.apprenticeId || "",
          ),
        ),
    [admin.enrolments],
  );
  const [apprenticeId, setApprenticeId] = useState("");
  const selected =
    enrolments.find((e) => e.apprenticeId === apprenticeId) ?? enrolments[0] ?? null;
  const resolvedApprenticeId = selected?.apprenticeId ?? "";
  const storeId = resolveTaskStoreApprenticeId(resolvedApprenticeId);

  useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );

  const { catalogue, loading } = usePublishedDeliveryCatalogue({
    programmeVersionId: selected?.gtaProgrammeVersionId ?? null,
    apprenticeId: resolvedApprenticeId || null,
    enabled: Boolean(selected),
  });

  const awaiting =
    catalogue.status === "ready"
      ? listAwaitingTrainer(catalogue.tasks, storeId)
      : [];

  const taskedBlocks =
    catalogue.status === "ready"
      ? catalogue.blocks.filter(
          (b) => tasksForDeliveryBlock(catalogue, b.spineItemId).length > 0,
        )
      : [];

  return (
    <ApprenticePageShell
      eyebrow="Tutor"
      title="Programme delivery"
      description="Review published Course Builder tasks for a learner’s pinned GTA programme version. Draft content never appears here."
    >
      <div className={styles.root}>
        <div className={styles.purpose}>
          <p className={styles.purposeLead}>
            Review published Course Builder tasks for a learner’s pinned GTA
            programme version. Draft content never appears here.
          </p>
          <p className={styles.purposeNote}>
            <Link href="/staff/programme-delivery/block1">
              Block 1 Session delivery pilot →
            </Link>{" "}
            (planned Session sign-off for TEST apprentices)
          </p>
          <label className={styles.blockMeta} style={{ display: "grid", gap: 6 }}>
            <span>Learner (enrolment pin)</span>
            <Select
              value={resolvedApprenticeId}
              onChange={setApprenticeId}
              options={
                enrolments.length === 0
                  ? [{ value: "", label: "No enrolments…" }]
                  : enrolments.map((e) => ({
                      value: e.apprenticeId!,
                      label: `${e.displayName || e.apprenticeId}${
                        e.gtaProgrammeVersionId ? "" : " · unpinned"
                      }`,
                    }))
              }
            />
          </label>
          <p className={styles.purposeLead} style={{ marginTop: 12 }}>
            <strong>
              {catalogue.programmeTitle ||
                selected?.programmeName ||
                "Programme"}
            </strong>
            {catalogue.standardCode ? ` · ${catalogue.standardCode}` : ""}
            {catalogue.internalVersion
              ? ` · GTA v${catalogue.internalVersion}`
              : ""}
          </p>
          {selected && !selected.gtaProgrammeVersionId ? (
            <p className={styles.purposeBody}>
              This enrolment has no GTA programme version pin. Bind one on RPL/TNP
              before delivery content can load.
            </p>
          ) : null}
          {selected?.gtaProgrammeVersionId && catalogue.status !== "ready" ? (
            <p className={styles.purposeBody}>{catalogue.message}</p>
          ) : null}
          {selected && catalogue.status === "ready" ? (
            <p className={styles.purposeBody}>
              Learners on the same cohort may be pinned to different GTA programme
              versions — always select the learner before reviewing.
            </p>
          ) : null}
        </div>

        {!selected ? (
          <p className={styles.empty}>Select a learner to open delivery.</p>
        ) : loading ? (
          <p className={styles.empty}>Loading published tasks…</p>
        ) : catalogue.status !== "ready" ? (
          <p className={styles.empty}>{catalogue.message}</p>
        ) : (
          <>
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
                Blocks
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
                    const sub = getTaskSubmission(task.id, storeId);
                    return (
                      <article key={task.id} className={styles.queueCard}>
                        <div>
                          <p className={styles.blockMeta}>
                            Block {task.blockId} · Task {task.taskNumber}
                          </p>
                          <h2 className={styles.blockTitle}>{task.title}</h2>
                          <ApprenticeStatusChip tone={statusTone(sub.status)}>
                            {statusLabel(sub.status)}
                          </ApprenticeStatusChip>
                        </div>
                        <Link
                          href={`/staff/programme-delivery/${task.id}?apprentice=${encodeURIComponent(resolvedApprenticeId)}`}
                          className={styles.linkish}
                        >
                          Review →
                        </Link>
                      </article>
                    );
                  })}
                </div>
              )
            ) : (
              <div className={styles.blockList}>
                {taskedBlocks.map((block) => {
                  const tasks = tasksForDeliveryBlock(
                    catalogue,
                    block.spineItemId,
                  );
                  const unlocked = isDeliveryBlockUnlocked({
                    block,
                    blocks: catalogue.blocks,
                    programmeWeek: 999,
                  });
                  return (
                    <article key={block.spineItemId} className={styles.blockCard}>
                      <h2 className={styles.blockTitle}>
                        Block {block.displayOrdinal} · {block.title}
                      </h2>
                      <ul className={styles.taskList}>
                        {tasks.map((task) => {
                          const sub = getTaskSubmission(task.id, storeId);
                          return (
                            <li key={task.id}>
                              <Link
                                href={`/staff/programme-delivery/${task.id}?apprentice=${encodeURIComponent(resolvedApprenticeId)}`}
                                className={styles.taskRow}
                              >
                                <div className={styles.taskMain}>
                                  <strong>
                                    Task {task.taskNumber}: {task.title}
                                  </strong>
                                  <span>
                                    {unlocked ? "Open" : "Locked until calendar week / authorised unlock"}
                                  </span>
                                </div>
                                <ApprenticeStatusChip tone={statusTone(sub.status)}>
                                  {statusLabel(sub.status)}
                                </ApprenticeStatusChip>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </ApprenticePageShell>
  );
}
