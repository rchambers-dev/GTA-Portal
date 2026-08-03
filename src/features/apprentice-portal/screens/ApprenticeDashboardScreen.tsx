"use client";

import Link from "next/link";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import { useApprenticeChat } from "../components/ApprenticeChatProvider";
import {
  ALEX_OPEN_TARGETS,
  ALEX_OTJ_ENTRIES,
  ALEX_PROFILE,
  buildOtjLoggingHealth,
  formatModuleDate,
  isOtjCatchUpEntry,
  otjHours,
  summariseOtjHours,
} from "../domain/mock-apprentice";
import styles from "./apprentice-pages.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const TARGET_TONES = ["amber", "red", "navy"] as const;

export function ApprenticeDashboardScreen() {
  const { unread } = useApprenticeChat();
  const profile = ALEX_PROFILE;
  const otjSummary = summariseOtjHours(ALEX_OTJ_ENTRIES);
  const loggingHealth = buildOtjLoggingHealth(ALEX_OTJ_ENTRIES);
  const catchUpPending = ALEX_OTJ_ENTRIES.filter(
    (e) => isOtjCatchUpEntry(e) && e.employerStatus === "pending",
  );
  const catchUpHours = catchUpPending.reduce((sum, e) => sum + otjHours(e), 0);

  return (
    <ApprenticePageShell
      title={`Hello, ${profile.displayName.split(" ")[0]}`}
      description={`${profile.programmeName} · Year ${profile.programmeYear} · Week ${profile.programmeWeek} at ${profile.employerName}.`}
    >
      <div className={`${styles.stack} ${styles.dashRoot}`}>
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
                : `${otjSummary.awaitingEmployerCount} awaiting ${profile.employerContact}`}
            </p>
          </Link>
          <Link
            href="/apprentice/messages"
            className={styles.glanceLink}
            data-tone="red"
          >
            <p className={styles.glanceLabel}>Messages</p>
            <p className={styles.glanceValue}>{unread}</p>
            <p className={styles.glanceHint}>
              {unread > 0 ? "Unread conversations" : "You're up to date"}
            </p>
          </Link>
        </div>

        <section className={styles.section}>
          <h2 className={styles.dashSectionTitle} data-accent="navy">
            Shortcuts
          </h2>
          <div className={styles.shortcuts}>
            <Link
              className={styles.shortcut}
              href="/apprentice/messages"
              data-tone="red"
            >
              Messages{unread > 0 ? ` (${unread})` : ""}
            </Link>
            <Link
              className={styles.shortcut}
              href="/apprentice/learning"
              data-tone="navy"
            >
              My Learning plan
            </Link>
            <Link
              className={styles.shortcut}
              href="/apprentice/otj"
              data-tone="amber"
            >
              OTJ hours
            </Link>
            <Link
              className={styles.shortcut}
              href="/apprentice/college-tasks"
              data-tone="green"
            >
              College tasks
            </Link>
            <Link
              className={styles.shortcut}
              href="/apprentice/reviews"
              data-tone="navy"
            >
              Reviews
            </Link>
            <Link
              className={styles.shortcut}
              href="/apprentice/support"
              data-tone="red"
            >
              Get support
            </Link>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.dashSectionTitle} data-accent="amber">
            Open targets
          </h2>
          <p className={styles.meta}>
            {ALEX_OPEN_TARGETS.length} open · due before your August review
          </p>
          <ul className={styles.list}>
            {ALEX_OPEN_TARGETS.map((t, index) => (
              <li key={t.id}>
                <Link
                  href={t.href}
                  className={styles.rowLink}
                  data-tone={TARGET_TONES[index % TARGET_TONES.length]}
                >
                  <div className={styles.rowMain}>
                    <strong>{t.title}</strong>
                    <span>
                      Owner: {t.owner} · Due {formatDate(t.dueDate)}
                    </span>
                  </div>
                  <div className={styles.rowEnd}>
                    <ApprenticeStatusChip tone="amber">Open</ApprenticeStatusChip>
                    <span className={styles.linkish}>{t.hrefLabel} →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ApprenticePageShell>
  );
}
