"use client";

import Link from "next/link";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import { useApprenticeChat } from "../components/ApprenticeChatProvider";
import { useApprenticePortalProfile } from "../hooks/useApprenticePortalProfile";
import {
  buildOtjLoggingHealth,
  formatModuleDate,
  isOtjCatchUpEntry,
  otjHours,
  summariseOtjHours,
  type ApprenticeOtjEntry,
} from "../domain/apprentice-profile";
import styles from "./apprentice-pages.module.css";

function formatDate(iso: string): string {
  if (!iso) return "Not scheduled";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const TARGET_TONES = ["amber", "red", "navy"] as const;

export function ApprenticeDashboardScreen() {
  const { unread } = useApprenticeChat();
  const { profile, loading, error } = useApprenticePortalProfile();
  const otjEntries: ApprenticeOtjEntry[] = [];
  const openTargets: Array<{
    id: string;
    title: string;
    owner: string;
    dueDate: string;
    href: string;
    hrefLabel?: string;
  }> = [];
  const otjSummary = summariseOtjHours(otjEntries);
  const loggingHealth = buildOtjLoggingHealth(otjEntries);
  const catchUpPending = otjEntries.filter(
    (e) => isOtjCatchUpEntry(e) && e.employerStatus === "pending",
  );
  const catchUpHours = catchUpPending.reduce((sum, e) => sum + otjHours(e), 0);

  if (loading) {
    return (
      <ApprenticePageShell title="Dashboard" description="Loading your programme…">
        <p className={styles.note}>Fetching your live apprentice record…</p>
      </ApprenticePageShell>
    );
  }

  return (
    <ApprenticePageShell
      title={`Hello, ${profile.displayName.split(" ")[0]}`}
      description={`${profile.programmeName} · Year ${profile.programmeYear} · Week ${profile.programmeWeek} at ${profile.employerName}.`}
    >
      <div className={`${styles.stack} ${styles.dashRoot}`}>
        {error ? (
          <p className={styles.note} role="alert">
            {error}
          </p>
        ) : null}

        {loggingHealth.alert && loggingHealth.apprenticeNudge ? (
          <Link
            href="/apprentice/otj"
            className={styles.otjGapAlert}
            data-kind={loggingHealth.alertKind}
            role="status"
          >
            <p className={styles.otjGapAlertTitle}>OTJ logging reminder</p>
            <p className={styles.otjGapAlertCopy}>{loggingHealth.apprenticeNudge}</p>
            {loggingHealth.lastSubmittedAt ? (
              <p className={styles.meta}>
                Last submitted {formatModuleDate(loggingHealth.lastSubmittedAt)}
                {loggingHealth.daysSinceLastSubmit != null
                  ? ` · ${loggingHealth.daysSinceLastSubmit} days ago`
                  : ""}
              </p>
            ) : null}
            <p className={styles.meta}>
              <span className={styles.linkish}>Open OTJ hours →</span>
            </p>
          </Link>
        ) : null}

        <div className={styles.grid}>
          <Link
            href="/apprentice/reviews"
            className={styles.glanceLink}
            data-tone="navy"
          >
            <p className={styles.glanceLabel}>Next review</p>
            <p className={styles.glanceValue}>{formatDate(profile.nextReviewDate)}</p>
            <p className={styles.glanceHint}>Progress review with {profile.mentorName}</p>
          </Link>
          <Link
            href="/apprentice/attendance"
            className={styles.glanceLink}
            data-tone="green"
          >
            <p className={styles.glanceLabel}>Attendance</p>
            <p className={styles.glanceValue}>{profile.attendancePercent}%</p>
            <p className={styles.glanceHint}>College days: {profile.collegeDays}</p>
          </Link>
          <Link
            href="/apprentice/otj"
            className={styles.glanceLink}
            data-tone="amber"
          >
            <p className={styles.glanceLabel}>OTJ with employer</p>
            <p className={styles.glanceValue}>
              {otjSummary.awaitingEmployerHours}h
            </p>
            <p className={styles.glanceHint}>
              {catchUpPending.length > 0
                ? `Includes ${catchUpHours}h catch-up block`
                : "No OTJ entries logged yet"}
            </p>
          </Link>
          <Link
            href="/apprentice/messages"
            className={styles.glanceLink}
            data-tone="blue"
          >
            <p className={styles.glanceLabel}>Messages</p>
            <p className={styles.glanceValue}>{unread}</p>
            <p className={styles.glanceHint}>Unread</p>
          </Link>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Open targets</h2>
            <ApprenticeStatusChip tone="neutral">
              {openTargets.length}
            </ApprenticeStatusChip>
          </div>
          {openTargets.length === 0 ? (
            <p className={styles.note}>
              No open targets yet — they will appear here when mentors or tutors
              set actions.
            </p>
          ) : (
            <ul className={styles.list}>
              {openTargets.map((target, index) => (
                <li key={target.id}>
                  <Link
                    href={target.href}
                    className={styles.rowLink}
                    data-tone={TARGET_TONES[index % TARGET_TONES.length]}
                  >
                    <div className={styles.rowMain}>
                      <strong>{target.title}</strong>
                      <span className={styles.meta}>
                        {target.owner}
                        {target.dueDate ? ` · due ${formatDate(target.dueDate)}` : ""}
                      </span>
                    </div>
                    <span className={styles.rowCta}>
                      {target.hrefLabel ?? "Open →"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ApprenticePageShell>
  );
}
