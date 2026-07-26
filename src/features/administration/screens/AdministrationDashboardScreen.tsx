"use client";

import Link from "next/link";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "@/features/learner-portal/components/LearnerPageShell";
import learnerStyles from "@/features/learner-portal/screens/learner-pages.module.css";
import { awaitingEnrolment } from "../domain/intake-pack";
import { resetAdminStore } from "../domain/store";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AdministrationDashboardScreen() {
  const store = useAdminStore();

  const enrolledLearnerIds = store.enrolments.map((e) => e.learnerId);
  const intakeQueue = store.learners.filter(
    (l) => l.intakeStatus === "in_progress",
  );
  const readyToEnrol = awaitingEnrolment(store.learners, enrolledLearnerIds);
  const awaitingEnable = store.users.filter(
    (u) => u.role === "Learner" && u.status === "invited",
  );
  const pendingStart = store.enrolments.filter(
    (e) => e.status === "pending_start" || e.status === "draft",
  );
  const recentEnrolments = [...store.enrolments]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const recentTransfers = [...store.enrolments]
    .filter((e) => /Transfer \d/i.test(e.notes) || e.notes.includes("Transfer "))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);

  const attentionCount =
    intakeQueue.length +
    readyToEnrol.length +
    awaitingEnable.length +
    pendingStart.length;

  return (
    <LearnerPageShell
      eyebrow="Administration"
      title="Administration Dashboard"
      description="Learner path only: intake → enrol on a programme → enable their portal. Transfers cover college-day / group and employer moves. Staff accounts sit on Management."
      actions={
        <div className={styles.toolbarActions}>
          <Link href="/administration/intake" className={styles.primaryBtn}>
            Start new learner
          </Link>
          <Link
            href="/administration/enrolments"
            className={styles.secondaryBtn}
          >
            Enrolments
          </Link>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              if (
                window.confirm(
                  "Reset administration demo data to the seeded records?",
                )
              ) {
                resetAdminStore();
              }
            }}
          >
            Reset demo data
          </button>
        </div>
      }
    >
      <div className={`${learnerStyles.stack} ${learnerStyles.dashRoot}`}>
        <div className={learnerStyles.grid}>
          <Link
            href="/administration/intake"
            className={learnerStyles.glanceLink}
            data-tone="amber"
          >
            <p className={learnerStyles.glanceLabel}>Intake in progress</p>
            <p className={learnerStyles.glanceValue}>{intakeQueue.length}</p>
            <p className={learnerStyles.glanceHint}>
              Personal details still open
            </p>
          </Link>
          <Link
            href="/administration/enrolments"
            className={learnerStyles.glanceLink}
            data-tone="navy"
          >
            <p className={learnerStyles.glanceLabel}>Ready to enrol</p>
            <p className={learnerStyles.glanceValue}>{readyToEnrol.length}</p>
            <p className={learnerStyles.glanceHint}>
              Marked ready — put on a programme
            </p>
          </Link>
          <Link
            href="/administration/accounts"
            className={learnerStyles.glanceLink}
            data-tone="red"
          >
            <p className={learnerStyles.glanceLabel}>Awaiting enable</p>
            <p className={learnerStyles.glanceValue}>{awaitingEnable.length}</p>
            <p className={learnerStyles.glanceHint}>
              Learner environments to turn on
            </p>
          </Link>
          <div className={learnerStyles.glance} data-tone="green">
            <p className={learnerStyles.glanceLabel}>Learners online</p>
            <p className={learnerStyles.glanceValue}>—</p>
            <p className={learnerStyles.glanceHint}>
              Live presence connects with portal sessions
            </p>
          </div>
        </div>

        <section className={learnerStyles.section}>
          <h2 className={learnerStyles.dashSectionTitle} data-accent="navy">
            Shortcuts
          </h2>
          <div className={learnerStyles.shortcuts}>
            <Link
              className={learnerStyles.shortcut}
              href="/administration/intake"
              data-tone="amber"
            >
              Learner Intake
            </Link>
            <Link
              className={learnerStyles.shortcut}
              href="/administration/enrolments"
              data-tone="navy"
            >
              Learner Enrolments
            </Link>
            <Link
              className={learnerStyles.shortcut}
              href="/administration/accounts"
              data-tone="red"
            >
              Account Setup
            </Link>
            <Link
              className={learnerStyles.shortcut}
              href="/administration/cohorts"
              data-tone="navy"
            >
              Cohorts &amp; Groups
            </Link>
            <Link
              className={learnerStyles.shortcut}
              href="/administration/employers"
              data-tone="green"
            >
              Employer records
            </Link>
            <Link
              className={learnerStyles.shortcut}
              href="/administration/programmes"
              data-tone="navy"
            >
              Programme records
            </Link>
            <Link
              className={learnerStyles.shortcut}
              href="/learners?from=administration"
              data-tone="navy"
            >
              Learners
            </Link>
            <Link
              className={learnerStyles.shortcut}
              href="/administration/shared-drive"
              data-tone="green"
            >
              Shared Drive
            </Link>
            <Link
              className={learnerStyles.shortcut}
              href="/administration/messages"
              data-tone="amber"
            >
              Messages
            </Link>
            <Link
              className={learnerStyles.shortcut}
              href="/administration/safeguarding"
              data-tone="red"
            >
              Safeguarding
            </Link>
          </div>
        </section>

        <section className={learnerStyles.section}>
          <h2 className={learnerStyles.dashSectionTitle} data-accent="amber">
            Needs attention
          </h2>
          <p className={learnerStyles.meta}>
            {attentionCount === 0
              ? "Nothing waiting right now"
              : `${attentionCount} item${attentionCount === 1 ? "" : "s"} across intake, enrolment, and account setup`}
          </p>

          {attentionCount === 0 ? (
            <p className={styles.empty}>Queues are clear.</p>
          ) : (
            <ul className={learnerStyles.list}>
              {intakeQueue.slice(0, 4).map((row) => (
                <li key={`intake-${row.id}`}>
                  <Link
                    href="/administration/intake"
                    className={learnerStyles.rowLink}
                    data-tone="amber"
                  >
                    <div className={learnerStyles.rowMain}>
                      <strong>{row.displayName}</strong>
                      <span>
                        Intake draft
                        {row.learnerReference
                          ? ` · ${row.learnerReference}`
                          : ""}
                        {row.town ? ` · ${row.town}` : ""}
                      </span>
                    </div>
                    <div className={learnerStyles.rowEnd}>
                      <LearnerStatusChip tone="amber">
                        In progress
                      </LearnerStatusChip>
                      <span className={learnerStyles.linkish}>Continue →</span>
                    </div>
                  </Link>
                </li>
              ))}

              {readyToEnrol.slice(0, 4).map((row) => (
                <li key={`ready-${row.id}`}>
                  <Link
                    href="/administration/enrolments"
                    className={learnerStyles.rowLink}
                    data-tone="navy"
                  >
                    <div className={learnerStyles.rowMain}>
                      <strong>{row.displayName}</strong>
                      <span>
                        Ready for enrolment
                        {row.learnerReference
                          ? ` · ${row.learnerReference}`
                          : ""}
                      </span>
                    </div>
                    <div className={learnerStyles.rowEnd}>
                      <LearnerStatusChip tone="navy">
                        Ready to enrol
                      </LearnerStatusChip>
                      <span className={learnerStyles.linkish}>Enrol →</span>
                    </div>
                  </Link>
                </li>
              ))}

              {awaitingEnable.slice(0, 4).map((row) => (
                <li key={`enable-${row.id}`}>
                  <Link
                    href="/administration/accounts"
                    className={learnerStyles.rowLink}
                    data-tone="red"
                  >
                    <div className={learnerStyles.rowMain}>
                      <strong>{row.displayName}</strong>
                      <span>Learner environment awaiting enable</span>
                    </div>
                    <div className={learnerStyles.rowEnd}>
                      <LearnerStatusChip tone="amber">
                        Awaiting enable
                      </LearnerStatusChip>
                      <span className={learnerStyles.linkish}>Enable →</span>
                    </div>
                  </Link>
                </li>
              ))}

              {pendingStart.slice(0, 4).map((row) => (
                <li key={`pending-${row.id}`}>
                  <Link
                    href="/administration/enrolments"
                    className={learnerStyles.rowLink}
                    data-tone="amber"
                  >
                    <div className={learnerStyles.rowMain}>
                      <strong>{row.displayName}</strong>
                      <span>
                        {row.programmeName} · {row.employerName} · starts{" "}
                        {formatDate(row.startDate)}
                      </span>
                    </div>
                    <div className={learnerStyles.rowEnd}>
                      <LearnerStatusChip tone="amber">
                        Pending start
                      </LearnerStatusChip>
                      <span className={learnerStyles.linkish}>Open →</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={learnerStyles.section}>
          <h2 className={learnerStyles.dashSectionTitle} data-accent="navy">
            Recent enrolments
          </h2>
          <p className={learnerStyles.meta}>
            Latest new starters and currently studying placements — open an
            enrolment to transfer group or employer
          </p>
          {recentEnrolments.length === 0 ? (
            <p className={styles.empty}>No enrolments yet.</p>
          ) : (
            <ul className={learnerStyles.list}>
              {recentEnrolments.map((row) => (
                <li key={row.id}>
                  <Link
                    href="/administration/enrolments"
                    className={learnerStyles.rowLink}
                    data-tone="navy"
                  >
                    <div className={learnerStyles.rowMain}>
                      <strong>{row.displayName}</strong>
                      <span>
                        {row.kind === "new_starter"
                          ? "New starter"
                          : "Currently studying"}{" "}
                        · {row.programmeName} · {row.employerName}
                        {row.collegeDays ? ` · ${row.collegeDays}` : ""}
                      </span>
                    </div>
                    <div className={learnerStyles.rowEnd}>
                      <LearnerStatusChip
                        tone={
                          row.status === "active"
                            ? "green"
                            : row.status === "pending_start"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {row.status.replace("_", " ")}
                      </LearnerStatusChip>
                      <span className={learnerStyles.linkish}>Open →</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {recentTransfers.length > 0 ? (
          <section className={learnerStyles.section}>
            <h2 className={learnerStyles.dashSectionTitle} data-accent="green">
              Recent transfers
            </h2>
            <p className={learnerStyles.meta}>
              Group / college-day or employer moves recorded on enrolments
            </p>
            <ul className={learnerStyles.list}>
              {recentTransfers.map((row) => {
                const lastLine =
                  row.notes
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line.startsWith("Transfer "))
                    .at(-1) ?? "Transfer recorded";
                return (
                  <li key={`xfer-${row.id}`}>
                    <Link
                      href="/administration/enrolments"
                      className={learnerStyles.rowLink}
                      data-tone="green"
                    >
                      <div className={learnerStyles.rowMain}>
                        <strong>{row.displayName}</strong>
                        <span>{lastLine}</span>
                      </div>
                      <div className={learnerStyles.rowEnd}>
                        <LearnerStatusChip tone="green">
                          Transferred
                        </LearnerStatusChip>
                        <span className={learnerStyles.linkish}>Open →</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </LearnerPageShell>
  );
}
