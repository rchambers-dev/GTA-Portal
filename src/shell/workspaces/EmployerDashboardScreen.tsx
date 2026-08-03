"use client";

import Link from "next/link";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import {
  formatOtjDuration,
  isOtjCatchUpEntry,
  otjHours,
} from "@/features/apprentice-portal/domain/apprentice-profile";
import apprenticeStyles from "@/features/apprentice-portal/screens/apprentice-pages.module.css";
import {
  EMPLOYER_OPEN_CASES,
  EMPLOYER_VIEWER,
  getEmployerCaseload,
  getEmployerPendingOtj,
  getEmployerPendingOtjTotals,
  getEmployerUpcomingReviews,
} from "./employer-dashboard-data";

const styles = apprenticeStyles;

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
    <ApprenticePageShell
      eyebrow="Employer workspace"
      title="Employer Dashboard"
      description={`${EMPLOYER_VIEWER.employerName} · ${caseload.length} apprentices with GTA. Agree off-the-job hours, join reviews, and raise concerns.`}
    >
      <div className={`${styles.stack} ${styles.dashRoot}`}>
        <div className={styles.grid}>
          <Link
            href="/employer/apprentice"
            className={styles.glanceLink}
            data-tone="navy"
          >
            <p className={styles.glanceLabel}>Apprentices</p>
            <p className={styles.glanceValue}>{caseload.length}</p>
            <p className={styles.glanceHint}>{EMPLOYER_VIEWER.employerName}</p>
          </Link>
          <Link
            href="/employer/otj"
            className={styles.glanceLink}
            data-tone="amber"
          >
            <p className={styles.glanceLabel}>OTJ to agree</p>
            <p className={styles.glanceValue}>{otjTotals.hours}h</p>
            <p className={styles.glanceHint}>
              {otjTotals.count} entr{otjTotals.count === 1 ? "y" : "ies"} waiting
              {otjTotals.catchUpCount > 0
                ? ` · ${otjTotals.catchUpCount} catch-up`
                : ""}
            </p>
          </Link>
          <Link
            href="/employer/reviews"
            className={styles.glanceLink}
            data-tone="green"
          >
            <p className={styles.glanceLabel}>Next review</p>
            <p className={styles.glanceValue}>
              {nextReview ? formatDate(nextReview.reviewDate) : "—"}
            </p>
            <p className={styles.glanceHint}>
              {nextReview ? nextReview.apprenticeName : "Nothing scheduled"}
            </p>
          </Link>
          <Link
            href="/employer/support"
            className={styles.glanceLink}
            data-tone="red"
          >
            <p className={styles.glanceLabel}>Open concerns</p>
            <p className={styles.glanceValue}>{openCases.length}</p>
            <p className={styles.glanceHint}>
              {openCases.length > 0 ? "With GTA" : "None open"}
            </p>
          </Link>
        </div>

        <section className={styles.section}>
          <h2 className={styles.dashSectionTitle} data-accent="navy">
            Shortcuts
          </h2>
          <div className={styles.shortcuts}>
            <Link className={styles.shortcut} href="/employer/otj" data-tone="amber">
              OTJ hours
            </Link>
            <Link
              className={styles.shortcut}
              href="/employer/reviews"
              data-tone="green"
            >
              Reviews
            </Link>
            <Link
              className={styles.shortcut}
              href="/employer/messages"
              data-tone="navy"
            >
              Messages
            </Link>
            <Link
              className={styles.shortcut}
              href="/employer/support"
              data-tone="red"
            >
              Support &amp; Concerns
            </Link>
            <Link
              className={styles.shortcut}
              href="/employer/attendance"
              data-tone="green"
            >
              Attendance
            </Link>
            <Link
              className={styles.shortcut}
              href="/employer/progress"
              data-tone="navy"
            >
              Progress
            </Link>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.dashSectionTitle} data-accent="amber">
            Needs your action
          </h2>
          <p className={styles.meta}>
            {pendingOtj.length} off-the-job entr
            {pendingOtj.length === 1 ? "y" : "ies"} waiting for you to agree or
            return
          </p>
          {pendingOtj.length === 0 ? (
            <p className={styles.empty}>
              Nothing waiting for you. Hours you agree are then confirmed by the
              apprentice&apos;s teacher.
            </p>
          ) : (
            <ul className={styles.list}>
              {pendingOtj.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href="/employer/otj"
                    className={styles.rowLink}
                    data-tone="amber"
                  >
                    <div className={styles.rowMain}>
                      <strong>
                        Entry {entry.entryNumber} · {entry.activityName}
                      </strong>
                      <span>
                        {formatOtjDuration(entry.durationMinutes)} · submitted{" "}
                        {formatDate(entry.submittedAt)}
                      </span>
                    </div>
                    <div className={styles.rowEnd}>
                      <ApprenticeStatusChip
                        tone={isOtjCatchUpEntry(entry) ? "red" : "amber"}
                      >
                        {isOtjCatchUpEntry(entry)
                          ? `Catch-up · ${otjHours(entry)}h`
                          : "Agree or return"}
                      </ApprenticeStatusChip>
                      <span className={styles.linkish}>Open →</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.dashSectionTitle} data-accent="navy">
            Your apprentices
          </h2>
          <p className={styles.meta}>{caseload.length} on programme with GTA</p>
          <ul className={styles.list}>
            {caseload.map((a) => {
              const behind = a.actualProgressPercent < a.plannedProgressPercent;
              return (
                <li key={a.apprenticeId}>
                  <Link
                    href="/employer/attendance"
                    className={styles.rowLink}
                    data-tone="navy"
                  >
                    <div className={styles.rowMain}>
                      <strong>{a.displayName}</strong>
                      <span>
                        {a.programmeName} · Year {a.programmeYear} · Week{" "}
                        {a.programmeWeek} · {a.attendancePercent}% attendance ·{" "}
                        {a.actualProgressPercent}% progress
                        {behind
                          ? ` (${a.plannedProgressPercent - a.actualProgressPercent}% behind)`
                          : " (on track)"}
                      </span>
                    </div>
                    <div className={styles.rowEnd}>
                      <ApprenticeStatusChip tone={behind ? "amber" : "green"}>
                        {behind ? "Behind plan" : "On track"}
                      </ApprenticeStatusChip>
                      <span className={styles.linkish}>View attendance →</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {upcomingReviews.length > 0 ? (
          <section className={styles.section}>
            <h2 className={styles.dashSectionTitle} data-accent="green">
              Upcoming reviews
            </h2>
            <p className={styles.meta}>
              {upcomingReviews.length} review
              {upcomingReviews.length === 1 ? "" : "s"} you can join
            </p>
            <ul className={styles.list}>
              {upcomingReviews.map((r) => (
                <li key={r.id}>
                  <Link
                    href="/employer/reviews"
                    className={styles.rowLink}
                    data-tone="green"
                  >
                    <div className={styles.rowMain}>
                      <strong>
                        {r.type} · {r.apprenticeName}
                      </strong>
                      <span>{formatDate(r.reviewDate)}</span>
                    </div>
                    <div className={styles.rowEnd}>
                      <ApprenticeStatusChip tone="green">Upcoming</ApprenticeStatusChip>
                      <span className={styles.linkish}>Open →</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </ApprenticePageShell>
  );
}
