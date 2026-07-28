"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "@/features/learner-portal/components/LearnerPageShell";
import { useDemoSession } from "@/shell/demo/DemoSessionProvider";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import styles from "./admin-pages.module.css";

type ProxyRow = {
  enrolmentId: string;
  learnerId: string | null;
  displayName: string;
  learnerReference: string;
  email: string;
  programmeName: string;
  startDate: string;
  originalPlannedEndDate: string;
  status: string;
  actualProgressPercent: number | null;
  notes: string;
  plannedProgressPercent: number;
  variancePercent: number | null;
  varianceLabel: string;
};

/**
 * Management system action: load / correct learner progress data on behalf of
 * pupils without requiring their structured form flows.
 */
export function ManagementProxyWriteScreen() {
  const { session } = useDemoSession();
  const canProxy = hasPermission(session, PERMISSIONS.RECORDS_PROXY_WRITE);
  const [rows, setRows] = useState<ProxyRow[]>([]);
  const [loading, setLoading] = useState(canProxy);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { actualProgressPercent: string; notes: string }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/management/proxy-write", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Unable to load learner programmes");
      }
      const data = (await response.json()) as { rows: ProxyRow[] };
      setRows(data.rows);
      const nextDrafts: Record<
        string,
        { actualProgressPercent: string; notes: string }
      > = {};
      for (const row of data.rows) {
        nextDrafts[row.enrolmentId] = {
          actualProgressPercent:
            row.actualProgressPercent == null
              ? ""
              : String(row.actualProgressPercent),
          notes: row.notes,
        };
      }
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canProxy) return;
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canProxy, load]);

  async function save(row: ProxyRow) {
    const draft = drafts[row.enrolmentId];
    if (!draft) return;
    setSavingId(row.enrolmentId);
    setError(null);
    setSuccess(null);
    try {
      const raw = draft.actualProgressPercent.trim();
      const actualProgressPercent = raw === "" ? null : Number.parseFloat(raw);
      if (
        actualProgressPercent != null &&
        !Number.isFinite(actualProgressPercent)
      ) {
        throw new Error("Actual progress must be a number");
      }
      const response = await fetch("/api/management/proxy-write", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrolmentId: row.enrolmentId,
          actualProgressPercent,
          notes: draft.notes,
          summary: `Proxy write for ${row.displayName}`,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Unable to save proxy write");
      }
      const data = (await response.json()) as { row: ProxyRow };
      setRows((prev) =>
        prev.map((entry) =>
          entry.enrolmentId === row.enrolmentId ? data.row : entry,
        ),
      );
      setDrafts((prev) => ({
        ...prev,
        [row.enrolmentId]: {
          actualProgressPercent:
            data.row.actualProgressPercent == null
              ? ""
              : String(data.row.actualProgressPercent),
          notes: data.row.notes,
        },
      }));
      setSuccess(`Updated ${row.displayName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save");
    } finally {
      setSavingId(null);
    }
  }

  if (!canProxy) {
    return (
      <LearnerPageShell
        eyebrow="Management · System Actions"
        title="Load learner data"
        description="You need the records.proxy.write permission to fill learner progress on behalf of pupils."
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
      title="Load learner data"
      description="Bypass structured learner flows and enter actual progress against planned dates. Writes are audited."
    >
      <div className={styles.stack}>
        {error ? <p className={styles.error}>{error}</p> : null}
        {success ? <p className={styles.success}>{success}</p> : null}
        {loading ? (
          <p className={styles.empty}>Loading live enrolments…</p>
        ) : rows.length === 0 ? (
          <p className={styles.empty}>
            No live learner programmes yet. Enrol learners first, then return here
            to set actual progress.
          </p>
        ) : (
          rows.map((row) => {
            const draft = drafts[row.enrolmentId] ?? {
              actualProgressPercent: "",
              notes: "",
            };
            const behind =
              row.variancePercent != null && row.variancePercent < -5;
            return (
              <section key={row.enrolmentId} className={styles.panel}>
                <div className={styles.toolbar}>
                  <div>
                    <h2 className={styles.panelTitle}>{row.displayName}</h2>
                    <p className={styles.panelLead}>
                      {row.learnerReference || "No reference"} ·{" "}
                      {row.programmeName}
                    </p>
                  </div>
                  <LearnerStatusChip tone={behind ? "amber" : "neutral"}>
                    {row.varianceLabel}
                  </LearnerStatusChip>
                </div>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Planned progress (derived)</span>
                    <input value={`${row.plannedProgressPercent}%`} readOnly />
                  </label>
                  <label className={styles.field}>
                    <span>Actual progress %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={draft.actualProgressPercent}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.enrolmentId]: {
                            ...draft,
                            actualProgressPercent: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className={`${styles.field} ${styles.detailFieldWide}`}>
                    <span>Notes</span>
                    <textarea
                      rows={2}
                      value={draft.notes}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.enrolmentId]: {
                            ...draft,
                            notes: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
                <div className={styles.toolbarActions}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    disabled={savingId === row.enrolmentId}
                    onClick={() => void save(row)}
                  >
                    {savingId === row.enrolmentId
                      ? "Saving…"
                      : "Save proxy write"}
                  </button>
                </div>
              </section>
            );
          })
        )}
      </div>
    </LearnerPageShell>
  );
}
