"use client";

import { useMemo, useState } from "react";
import {
  canTutorActOnOtj,
  formatModuleDate,
  formatOtjActivityPeriod,
  formatOtjDuration,
  isOtjCatchUpEntry,
  otjHours,
  otjTrainingTypeLabel,
  type ApprenticeOtjEntry,
} from "../domain/apprentice-profile";
import { ApprenticeStatusChip } from "../components/ApprenticePageShell";
import styles from "./TutorModuleSignOffScreen.module.css";

/**
 * Tutor / teacher dashboard stub — final OTJ confirmation only after employer.
 */
export function TutorOtjApprovalsScreen() {
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
    if (!item || !canTutorActOnOtj(item)) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setDone((prev) => [
      {
        ...item,
        tutorStatus: "agreed",
        tutorName: "Tutor",
        tutorDecidedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  function returnEntry(id: string) {
    const item = entries.find((e) => e.id === id);
    if (!item || !canTutorActOnOtj(item)) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setDone((prev) => [
      {
        ...item,
        tutorStatus: "returned",
        tutorName: "Tutor",
        tutorDecidedAt: new Date().toISOString(),
        tutorNote: "Returned — hours or activity need correcting.",
      },
      ...prev,
    ]);
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Teacher workspace</p>
        <h1 className={styles.title}>OTJ hours — final agree</h1>
        <p className={styles.lead}>
          Step 3 of 3: you are the last person who can agree the entry is correct.
          Only employer-agreed entries appear here — you cannot confirm before the
          employer.
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
          Pending teacher final agree · {entries.length}
        </h2>
        {entries.length === 0 ? (
          <p className={styles.empty}>
            Nothing waiting for teacher confirmation. Employer must agree first.
          </p>
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
                    Period {formatOtjActivityPeriod(entry)} · Employer{" "}
                    {entry.employerName} agreed{" "}
                    {formatModuleDate(entry.employerDecidedAt)}
                  </p>
                  {isOtjCatchUpEntry(entry) ? (
                    <p className={styles.meta}>
                      Catch-up block · {otjHours(entry)}h — final check that the
                      period claim is credible before agreeing.
                    </p>
                  ) : null}
                  <p className={styles.meta}>{entry.comments}</p>
                </div>
                <div className={styles.cardSide}>
                  {isOtjCatchUpEntry(entry) ? (
                    <ApprenticeStatusChip tone="amber">Catch-up block</ApprenticeStatusChip>
                  ) : null}
                  <ApprenticeStatusChip tone="blue">Teacher final</ApprenticeStatusChip>
                  <button
                    type="button"
                    className={styles.redoBtn}
                    onClick={() => agree(entry.id)}
                  >
                    Final agree (stub)
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
                    {entry.tutorStatus === "agreed"
                      ? "Fully agreed (apprentice → employer → teacher)"
                      : entry.tutorNote}
                  </p>
                </div>
                <ApprenticeStatusChip
                  tone={entry.tutorStatus === "agreed" ? "green" : "red"}
                >
                  {entry.tutorStatus === "agreed" ? "Final agree" : "Returned"}
                </ApprenticeStatusChip>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
