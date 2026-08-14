"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { Select } from "@/components/ui/Select";
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

/**
 * Tutor landing: pick a learner, open Session delivery.
 * Tasks are separate and must not block this page.
 */
export function TutorProgrammeDeliveryScreen() {
  const admin = useAdminStore();
  const enrolments = useMemo(() => {
    const rows = admin.enrolments
      .filter((e) => e.apprenticeId)
      .slice()
      .sort((a, b) =>
        (a.displayName || a.apprenticeId || "").localeCompare(
          b.displayName || b.apprenticeId || "",
        ),
      );
    return rows.slice().sort((a, b) => {
      const at = /TEST|DEMO/i.test(a.displayName) ? 0 : 1;
      const bt = /TEST|DEMO/i.test(b.displayName) ? 0 : 1;
      return at - bt;
    });
  }, [admin.enrolments]);

  const [apprenticeId, setApprenticeId] = useState("");
  const selected =
    enrolments.find((e) => e.apprenticeId === apprenticeId) ??
    enrolments[0] ??
    null;
  const resolvedApprenticeId = selected?.apprenticeId ?? "";
  const storeId = resolveTaskStoreApprenticeId(resolvedApprenticeId);
  const week = selected?.programmeWeek ?? null;

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

  const blockHref = (block: 1 | 2) => {
    const path =
      block === 1
        ? "/staff/programme-delivery/block1"
        : "/staff/programme-delivery/block2";
    if (!selected?.id) return path;
    return `${path}?enrolment=${encodeURIComponent(selected.id)}`;
  };

  return (
    <ApprenticePageShell
      eyebrow="Tutor"
      title="Programme delivery"
      description="Deliver planned learning Sessions for a learner. This is not Task marking, competence, or OTJ."
    >
      <div className={styles.root}>
        <div className={styles.purpose}>
          <h2 className={styles.purposeLabel}>What to do here</h2>
          <ol className={styles.steps}>
            <li>Choose the learner you are teaching.</li>
            <li>Open the Block for that week.</li>
            <li>
              Open the Session, use the tutor materials, then confirm the
              Session was delivered.
            </li>
          </ol>
          <p className={styles.purposeNote}>
            Confirming a Session was delivered does <strong>not</strong> mean
            the apprentice passed a Task or is competent. Tasks stay separate.
          </p>
          <label className={styles.blockMeta} style={{ display: "grid", gap: 6 }}>
            <span>Learner</span>
            <Select
              value={resolvedApprenticeId}
              onChange={setApprenticeId}
              options={
                enrolments.length === 0
                  ? [{ value: "", label: "No learners available" }]
                  : enrolments.map((e) => ({
                      value: e.apprenticeId!,
                      label: `${e.displayName || e.apprenticeId}${
                        e.programmeWeek ? ` · week ${e.programmeWeek}` : ""
                      }${e.gtaProgrammeVersionId ? "" : " · not pinned"}`,
                    }))
              }
            />
          </label>
          {selected ? (
            <p className={styles.purposeLead}>
              <strong>{selected.displayName}</strong>
              {selected.programmeName ? ` · ${selected.programmeName}` : ""}
              {week ? ` · programme week ${week}` : ""}
            </p>
          ) : null}
          {selected && !selected.gtaProgrammeVersionId ? (
            <p className={styles.purposeBody}>
              This enrolment is not pinned to a GTA programme version yet, so
              Session delivery cannot load.
            </p>
          ) : null}
        </div>

        {!selected ? (
          <p className={styles.empty}>Choose a learner to continue.</p>
        ) : (
          <div className={styles.actionGrid}>
            <article className={styles.actionCard}>
              <p className={styles.purposeLabel}>Block 1</p>
              <h2 className={styles.blockTitle}>Weeks 1–10</h2>
              <p className={styles.blockMeta}>
                Foundation skills Sessions. Open the Session, use the lesson
                plan, then confirm it was delivered.
              </p>
              {week != null && week <= 10 ? (
                <p className={styles.blockMeta}>This learner is in Block 1 now.</p>
              ) : null}
              <Link href={blockHref(1)} className={styles.primaryBtn}>
                Open Block 1 Sessions
              </Link>
            </article>
            <article className={styles.actionCard}>
              <p className={styles.purposeLabel}>Block 2</p>
              <h2 className={styles.blockTitle}>Weeks 11–20</h2>
              <p className={styles.blockMeta}>
                Later Sessions. The learner only sees these when the Block is
                open. You can still prepare and deliver them.
              </p>
              {week != null && week >= 11 && week <= 20 ? (
                <p className={styles.blockMeta}>This learner is in Block 2 now.</p>
              ) : week != null && week < 11 ? (
                <p className={styles.blockMeta}>
                  Learner copy for Block 2 stays locked until week 11 (or an
                  authorised unlock).
                </p>
              ) : null}
              <Link href={blockHref(2)} className={styles.primaryBtn}>
                Open Block 2 Sessions
              </Link>
            </article>
          </div>
        )}

        {selected && catalogue.status === "ready" && awaiting.length > 0 ? (
          <section className={styles.purpose}>
            <h2 className={styles.purposeLabel}>Task reviews waiting</h2>
            <p className={styles.purposeLead}>
              These are Tasks, not Sessions. Reviewing a Task does not sign off
              a Session.
            </p>
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
                      Review Task →
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        ) : selected && !loading ? (
          <p className={styles.empty}>
            No Task reviews are waiting. That is normal — deliver Sessions
            first. Tasks are a separate piece of work.
          </p>
        ) : null}
      </div>
    </ApprenticePageShell>
  );
}
