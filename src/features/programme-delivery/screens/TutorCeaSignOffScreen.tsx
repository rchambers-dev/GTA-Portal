"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { formatDisplayDate } from "@/features/apprentice-lifecycle/domain/programme-week";
import styles from "./programme-delivery.module.css";

type QueueItem = {
  apprenticeId: string;
  apprenticeName: string;
  programmeName: string;
  standardCode: string;
  packId: string;
  packTitle: string;
  groupId: string;
  groupNumber: number;
  groupTitle: string;
  taskId: string;
  taskNumber: number;
  taskTitle: string;
  status: "ready_to_assess" | "awaiting_tutor_verify" | "returned";
  kind: "mandatory" | "additional";
  isResubmission: boolean;
  submissionCount: number;
  apprenticeNotes: string;
  readyAt: string | null;
  returnNote: string | null;
  tutorReview: string | null;
  employerSignedByName: string | null;
  employerSignedAt: string | null;
};

type Props = {
  audience?: "teacher" | "employer";
};

function itemKey(item: QueueItem): string {
  return `${item.apprenticeId}::${item.packId}::${item.taskId}`;
}

function reviewHref(item: QueueItem, audience: "teacher" | "employer"): string {
  const q = new URLSearchParams({
    apprenticeId: item.apprenticeId,
    packId: item.packId,
    taskId: item.taskId,
  });
  if (audience === "employer") {
    return `/employer/cea-sign-offs/review?${q.toString()}`;
  }
  return `/staff/cea-sign-offs/review?${q.toString()}`;
}

/**
 * Queue of submitted CEA documents awaiting full-document review.
 */
export function TutorCeaSignOffScreen({ audience = "teacher" }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/cea-sign-offs?audience=${audience}`);
      const json = (await res.json().catch(() => ({}))) as {
        queue?: QueueItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || `Failed to load queue (${res.status})`);
      }
      setQueue(json.queue ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [audience]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ApprenticePageShell
      eyebrow={audience === "employer" ? "Employer" : "Tutor"}
      title={
        audience === "employer"
          ? "Workplace sign-off"
          : "Tracking sign-off"
      }
      description={
        audience === "employer"
          ? "Approve workplace documents first. Tutors still verify before full sign-off."
          : "Review mandatory submissions, and verify workplace tasks after employer approval."
      }
    >
      <div className={styles.root}>
        <div className={styles.purpose}>
          <p className={styles.purposeLead}>
            <strong>
              {audience === "employer"
                ? "Additional workplace tasks"
                : "Groups spine · teacher sign-off"}
            </strong>
          </p>
          <p className={styles.purposeBody}>
            Resubmissions are flagged. Use the full document view to tick parts
            that are already correct so the apprentice only amends what you send
            back.
          </p>
        </div>

        {error ? (
          <p className={styles.empty} role="alert">
            {error}{" "}
            <button
              type="button"
              className={styles.linkish}
              onClick={() => void load()}
            >
              Retry
            </button>
          </p>
        ) : null}

        {loading ? (
          <p className={styles.empty}>Loading sign-off queue…</p>
        ) : queue.length === 0 ? (
          <p className={styles.empty}>
            Nothing waiting for{" "}
            {audience === "employer" ? "employer" : "tutor"} review right now.
          </p>
        ) : (
          <div className={styles.blockList}>
            {queue.map((item) => (
              <article key={itemKey(item)} className={styles.queueCard}>
                <div>
                  <p className={styles.blockMeta}>
                    {item.apprenticeName}
                    {" · "}
                    {item.standardCode}
                    {" · "}
                    {item.programmeName}
                  </p>
                  <h3 className={styles.blockTitle}>
                    Group {item.groupNumber} · Task {item.taskNumber}:{" "}
                    {item.taskTitle}
                  </h3>
                  <p className={styles.blockMeta}>
                    {item.groupTitle}
                    {item.readyAt
                      ? ` · submitted ${formatDisplayDate(new Date(item.readyAt))}`
                      : ""}
                    {item.isResubmission
                      ? ` · resubmission (v${item.submissionCount})`
                      : item.submissionCount > 0
                        ? ` · v${item.submissionCount}`
                        : ""}
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    alignItems: "flex-end",
                  }}
                >
                  <ApprenticeStatusChip
                    tone={
                      item.status === "awaiting_tutor_verify"
                        ? "blue"
                        : item.isResubmission
                          ? "blue"
                          : "amber"
                    }
                  >
                    {item.status === "awaiting_tutor_verify"
                      ? "Tutor verify"
                      : item.isResubmission
                        ? "Resubmission"
                        : "Submitted"}
                  </ApprenticeStatusChip>
                  <Link
                    href={reviewHref(item, audience)}
                    className={styles.primaryBtn}
                  >
                    Open document →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </ApprenticePageShell>
  );
}
