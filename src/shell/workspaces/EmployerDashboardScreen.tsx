"use client";

import Link from "next/link";
import {
  formatOtjDuration,
  isOtjCatchUpEntry,
  otjHours,
} from "@/features/learner-portal/domain/mock-learner";
import {
  EMPLOYER_OPEN_CASES,
  EMPLOYER_VIEWER,
  getEmployerCaseload,
  getEmployerPendingOtj,
  getEmployerPendingOtjTotals,
  getEmployerUpcomingReviews,
} from "./employer-dashboard-data";
import styles from "./EmployerDashboardScreen.module.css";

function formatDate(iso: string): string {
  return new Date(iso.includes("T") ? iso : `${iso}T12:00:00`).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short", year: "numeric" },
  );
}

export function EmployerDashboardScreen() {
  const caseload = getEmployerCaseload();
  const pendingOtj = getEmployerPendingOtj();
  const otjTotals = getEmployerPendingOtjTotals();
  const upcomingReviews = getEmployerUpcomingReviews();
  const openCases = EMPLOYER_OPEN_CASES;
  const nextReview = [...upcomingReviews].sort(
    (a, b) => +new Date(a.reviewDate) - +new Date(b.reviewDate),
  )[0];

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Employer workspace</p>
        <h1 className={styles.title}>Employer Dashboard</h1>
        <p className={styles.lead}>
          {EMPLOYER_VIEWER.employerName} · {caseload.length} apprentices with GTA.
          Agree off-the-job hours, join reviews, and raise concerns — GTA handles
          sensitive cases first.
        </p>
      </header>

      <div className={styles.glanceGrid}>
        <Link href="/employer/apprentice" className={styles.glance} data-tone="navy">
          <span className={styles.glanceLabel}>Apprentices</span>
          <strong className={styles.glanceValue}>{caseload.length}</strong>
          <span className={styles.glanceHint}>{EMPLOYER_VIEWER.employerName}</span>
        </Link>
        <Link href="/employer/otj" className={styles.glance} data-tone="amber">
          <span className={styles.glanceLabel}>OTJ to agree</span>
          <strong className={styles.glanceValue}>{otjTotals.hours}h</strong>
          <span className={styles.glanceHint}>
            {otjTotals.count} entr{otjTotals.count === 1 ? "y" : "ies"} waiting
            {otjTotals.catchUpCount > 0
              ? ` · ${otjTotals.catchUpCount} catch-up`
              : ""}
          </span>
        </Link>
        <Link href="/employer/reviews" className={styles.glance} data-tone="green">
          <span className={styles.glanceLabel}>Next review</span>
          <strong className={styles.glanceValue}>
            {nextReview ? formatDate(nextReview.reviewDate) : "—"}
          </strong>
          <span className={styles.glanceHint}>
            {nextReview ? nextReview.learnerName : "Nothing scheduled"}
          </span>
        </Link>
        <Link href="/employer/support" className={styles.glance} data-tone="red">
          <span className={styles.glanceLabel}>Open concerns</span>
          <strong className={styles.glanceValue}>{openCases.length}</strong>
          <span className={styles.glanceHint}>
            {openCases.length > 0 ? "With GTA" : "None open"}
          </span>
        </Link>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Needs your action</h2>
          {pendingOtj.length > 0 ? (
            <Link href="/employer/otj" className={styles.sectionLink}>
              Open OTJ hours →
            </Link>
          ) : null}
        </div>
        {pendingOtj.length === 0 ? (
          <p className={styles.empty}>
            Nothing waiting for you. Off-the-job hours you agree are then confirmed
            by the apprentice&apos;s teacher.
          </p>
        ) : (
          <ul className={styles.actionList}>
            {pendingOtj.map((entry) => (
              <li key={entry.id}>
                <Link href="/employer/otj" className={styles.actionRow}>
                  <div className={styles.actionMain}>
                    <strong>
                      Entry {entry.entryNumber} · {entry.activityName}
                    </strong>
                    <span>
                      {formatOtjDuration(entry.durationMinutes)} · submitted{" "}
                      {formatDate(entry.submittedAt)}
                    </span>
                  </div>
                  <div className={styles.actionEnd}>
                    {isOtjCatchUpEntry(entry) ? (
                      <span className={`${styles.tag} ${styles.tagAmber}`}>
                        Catch-up · {otjHours(entry)}h
                      </span>
                    ) : null}
                    <span className={`${styles.tag} ${styles.tagAmber}`}>
                      Agree or return
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Your apprentices</h2>
        <div className={styles.apprenticeGrid}>
          {caseload.map((a) => {
            const behind = a.actualProgressPercent < a.plannedProgressPercent;
            const card = (
              <>
                <div className={styles.apprenticeHead}>
                  <span className={styles.avatar}>{a.initials}</span>
                  <div>
                    <strong className={styles.apprenticeName}>
                      {a.displayName}
                    </strong>
                    <span className={styles.apprenticeMeta}>
                      {a.programmeName}
                    </span>
                    <span className={styles.apprenticeMeta}>
                      Year {a.programmeYear} · Week {a.programmeWeek}
                    </span>
                  </div>
                </div>
                <div className={styles.apprenticeStats}>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Attendance</span>
                    <strong>{a.attendancePercent}%</strong>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Progress</span>
                    <strong>
                      {a.actualProgressPercent}%
                      <span
                        className={behind ? styles.behind : styles.onTrack}
                      >
                        {behind
                          ? ` · ${a.plannedProgressPercent - a.actualProgressPercent}% behind`
                          : " · on track"}
                      </span>
                    </strong>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Next review</span>
                    <strong>{formatDate(a.nextReviewDate)}</strong>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>OTJ to agree</span>
                    <strong>
                      {a.otjPendingCount > 0
                        ? `${a.otjPendingHours}h · ${a.otjPendingCount}`
                        : "None"}
                    </strong>
                  </div>
                </div>
                {a.linked ? (
                  <span className={styles.apprenticeCta}>View overview →</span>
                ) : (
                  <span className={styles.apprenticeCtaMuted}>
                    Detail coming soon
                  </span>
                )}
              </>
            );
            return a.linked ? (
              <Link
                key={a.learnerId}
                href="/employer/apprentice"
                className={styles.apprenticeCard}
              >
                {card}
              </Link>
            ) : (
              <div key={a.learnerId} className={styles.apprenticeCard}>
                {card}
              </div>
            );
          })}
        </div>
      </section>

      {upcomingReviews.length > 0 ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Upcoming reviews</h2>
            <Link href="/employer/reviews" className={styles.sectionLink}>
              All reviews →
            </Link>
          </div>
          <ul className={styles.actionList}>
            {upcomingReviews.map((r) => (
              <li key={r.id}>
                <Link href="/employer/reviews" className={styles.actionRow}>
                  <div className={styles.actionMain}>
                    <strong>
                      {r.type} · {r.learnerName}
                    </strong>
                    <span>{formatDate(r.reviewDate)}</span>
                  </div>
                  <span className={`${styles.tag} ${styles.tagGreen}`}>
                    Upcoming
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Shortcuts</h2>
        <div className={styles.shortcuts}>
          <Link className={styles.shortcut} href="/employer/otj" data-tone="amber">
            OTJ hours
          </Link>
          <Link className={styles.shortcut} href="/employer/reviews" data-tone="green">
            Reviews
          </Link>
          <Link className={styles.shortcut} href="/employer/messages" data-tone="navy">
            Messages
          </Link>
          <Link className={styles.shortcut} href="/employer/support" data-tone="red">
            Support &amp; Concerns
          </Link>
          <Link className={styles.shortcut} href="/employer/attendance" data-tone="green">
            Attendance
          </Link>
          <Link className={styles.shortcut} href="/employer/commitments" data-tone="navy">
            Commitments
          </Link>
        </div>
      </section>
    </div>
  );
}
