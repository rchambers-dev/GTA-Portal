"use client";

import { useMemo, useState } from "react";
import {
  canEmployerActOnOtj,
  formatModuleDate,
  formatOtjActivityPeriod,
  formatOtjDuration,
  isOtjCatchUpEntry,
  otjHours,
  otjTrainingTypeLabel,
  returnOtjByEmployer,
  unlockTutorAfterEmployerAgree,
  type ApprenticeOtjEntry,
} from "../domain/apprentice-profile";
import { ApprenticeStatusChip } from "../components/ApprenticePageShell";
import styles from "./TutorModuleSignOffScreen.module.css";

/**
 * Employer dashboard — agree / return apprentice OTJ hours.
 * Teacher cannot act until employer agrees.
 */
export function EmployerOtjApprovalsScreen() {
  const [entries, setEntries] = useState<ApprenticeOtjEntry[]>([]);
  const [done, setDone] = useState<ApprenticeOtjEntry[]>([]);

  const pendingHours = useMemo(
    () =>
      Math.round(
        entries.reduce((sum, e) => sum + e.durationMinutes / 60, 0) * 100,
      ) / 100,
    [entries],
  );

  function agree(id: string) {
    const item = entries.find((e) => e.id === id);
    if (!item || !canEmployerActOnOtj(item)) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setDone((prev) => [
      unlockTutorAfterEmployerAgree(item, "Employer contact"),
      ...prev,
    ]);
  }

  function returnEntry(id: string) {
    const item = entries.find((e) => e.id === id);
    if (!item || !canEmployerActOnOtj(item)) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setDone((prev) => [
      returnOtjByEmployer(
        item,
        "Employer contact",
        "Returned for apprentice to update.",
      ),
      ...prev,
    ]);
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Employer workspace</p>
        <h1 className={styles.title}>OTJ hours to agree</h1>
        <p className={styles.lead}>
          Step 2 of 3: confirm the apprentice&apos;s entry is true.
          After you agree, their teacher can give the final agree. Teachers cannot
          confirm before you.
        </p>
      </header>

      <div className={styles.summary}>
        <div className={styles.glance}>
          <span className={styles.glanceLabel}>Waiting for you</span>
          <strong>{pendingHours}h</strong>
        </div>
        <div className={styles.glance}>
          <span className={styles.glanceLabel}>Entries</span>
          <strong>{entries.length}</strong>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Pending employer agreement · {entries.length}
        </h2>
        {entries.length === 0 ? (
          <p className={styles.empty}>Nothing waiting for employer agreement.</p>
        ) : (
          <div className={styles.cards}>
            {entries.map((entry) => (
              <article key={entry.id} className={styles.card}>
                <div className={styles.cardMain}>
                  <p className={styles.apprentice}>Apprentice</p>
                  <h3 className={styles.topic}>
                    Entry {entry.entryNumber} · {entry.activityName}
                  </h3>
                  <p className={styles.meta}>
                    {formatOtjDuration(entry.durationMinutes)} ·{" "}
                    {otjTrainingTypeLabel(entry.trainingType)}
                    {entry.trainingType === "OTHER" && entry.trainingTypeOther
                      ? ` (${entry.trainingTypeOther})`
                      : ""}
                  </p>
                  <p className={styles.meta}>
                    Period {formatOtjActivityPeriod(entry)} · Submitted{" "}
                    {formatModuleDate(entry.submittedAt)}
                  </p>
                  {isOtjCatchUpEntry(entry) ? (
                    <p className={styles.meta}>
                      Catch-up block · {otjHours(entry)}h in one entry — confirm
                      the period is genuine off-the-job learning, not day-to-day
                      work.
                    </p>
                  ) : null}
                  <p className={styles.meta}>{entry.comments}</p>
                </div>
                <div className={styles.cardSide}>
                  {isOtjCatchUpEntry(entry) ? (
                    <ApprenticeStatusChip tone="amber">Catch-up block</ApprenticeStatusChip>
                  ) : null}
                  <ApprenticeStatusChip tone="amber">Employer pending</ApprenticeStatusChip>
                  <button
                    type="button"
                    className={styles.redoBtn}
                    onClick={() => agree(entry.id)}
                  >
                    Agree (stub)
                  </button>
                  <button
                    type="button"
                    className={styles.redoBtn}
                    onClick={() => returnEntry(entry.id)}
                  >
                    Return (stub)
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {done.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Handled this session · {done.length}</h2>
          <div className={styles.cards}>
            {done.map((entry) => (
              <article key={entry.id} className={styles.card}>
                <div className={styles.cardMain}>
                  <h3 className={styles.topic}>
                    Entry {entry.entryNumber} · {entry.activityName}
                  </h3>
                  <p className={styles.meta}>
                    {entry.employerStatus === "agreed"
                      ? "Agreed — unlocked for teacher final agree"
                      : entry.employerNote}
                  </p>
                </div>
                <ApprenticeStatusChip
                  tone={entry.employerStatus === "agreed" ? "green" : "red"}
                >
                  {entry.employerStatus === "agreed" ? "Agreed" : "Returned"}
                </ApprenticeStatusChip>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
