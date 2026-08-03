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
  status: "ready_to_assess" | "returned";
  apprenticeNotes: string;
  readyAt: string | null;
  returnNote: string | null;
};

function itemKey(item: QueueItem): string {
  return `${item.apprenticeId}::${item.packId}::${item.taskId}`;
}

/**
 * Tutor queue for groups-spine CEA mandatory tasks marked ready to assess.
 */
export function TutorCeaSignOffScreen() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/cea-sign-offs");
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(
    item: QueueItem,
    action: "sign_off" | "return",
  ): Promise<void> {
    const key = itemKey(item);
    setBusyKey(key);
    setFlash(null);
    try {
      const res = await fetch("/api/staff/cea-sign-offs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apprenticeId: item.apprenticeId,
          packId: item.packId,
          taskId: item.taskId,
          action,
          returnNote: returnNotes[key],
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || `Action failed (${res.status})`);
      }
      setQueue((prev) => prev.filter((q) => itemKey(q) !== key));
      setFlash(
        action === "sign_off"
          ? `Signed off · ${item.apprenticeName} · Group ${item.groupNumber} Task ${item.taskNumber}`
          : `Returned · ${item.apprenticeName} · Group ${item.groupNumber} Task ${item.taskNumber}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <ApprenticePageShell
      eyebrow="Tutor"
      title="Personal tracking sign-off"
      description="Mandatory CEA tasks apprentices marked ready to assess. Sign off to complete group quotas for BRAG, or return with a note."
    >
      <div className={styles.root}>
        <div className={styles.purpose}>
          <p className={styles.purposeLead}>
            <strong>Groups spine · teacher sign-off</strong>
          </p>
          <p className={styles.purposeBody}>
            This is separate from college block tasks. Employer workplace
            (additional) tasks do not appear here. Overall BRAG green for a group
            only after the mandatory quota is signed off.
          </p>
          <p className={styles.purposeBody}>
            <Link href="/management/apprentice-brag" className={styles.linkish}>
              Open progression BRAG →
            </Link>
          </p>
        </div>

        {flash ? <p className={styles.empty}>{flash}</p> : null}
        {error ? (
          <p className={styles.empty} role="alert">
            {error}{" "}
            <button type="button" className={styles.linkish} onClick={() => void load()}>
              Retry
            </button>
          </p>
        ) : null}

        {loading ? (
          <p className={styles.empty}>Loading sign-off queue…</p>
        ) : queue.length === 0 ? (
          <p className={styles.empty}>
            Nothing waiting for tutor sign-off right now.
          </p>
        ) : (
          <div className={styles.blockList}>
            {queue.map((item) => {
              const key = itemKey(item);
              const busy = busyKey === key;
              return (
                <article key={key} className={styles.queueCard}>
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
                        ? ` · marked ready ${formatDisplayDate(new Date(item.readyAt))}`
                        : ""}
                    </p>
                    {item.apprenticeNotes ? (
                      <p className={styles.purposeBody}>
                        <strong>Apprentice notes:</strong> {item.apprenticeNotes}
                      </p>
                    ) : null}
                    {item.status === "returned" && item.returnNote ? (
                      <p className={styles.purposeBody}>
                        <strong>Last return note:</strong> {item.returnNote}
                      </p>
                    ) : null}
                    <label className={styles.blockMeta} style={{ display: "block", marginTop: "0.75rem" }}>
                      Return note (optional)
                      <textarea
                        rows={2}
                        value={returnNotes[key] ?? ""}
                        onChange={(e) =>
                          setReturnNotes((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        style={{
                          display: "block",
                          width: "100%",
                          marginTop: "0.35rem",
                          font: "inherit",
                        }}
                        placeholder="What should the apprentice fix?"
                      />
                    </label>
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
                      tone={item.status === "returned" ? "red" : "amber"}
                    >
                      {item.status === "returned"
                        ? "Returned"
                        : "Ready to assess"}
                    </ApprenticeStatusChip>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={busy}
                      onClick={() => void act(item, "sign_off")}
                    >
                      {busy ? "Saving…" : "Sign off"}
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={busy}
                      onClick={() => void act(item, "return")}
                    >
                      Return
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </ApprenticePageShell>
  );
}
