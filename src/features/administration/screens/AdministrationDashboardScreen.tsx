"use client";

import Link from "next/link";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import apprenticeStyles from "@/features/apprentice-portal/screens/apprentice-pages.module.css";
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

  const enrolledApprenticeIds = store.enrolments.map((e) => e.apprenticeId);
  const intakeQueue = store.apprentices.filter(
    (l) => l.intakeStatus === "in_progress",
  );
  const readyToEnrol = awaitingEnrolment(store.apprentices, enrolledApprenticeIds);
  const awaitingEnable = store.users.filter(
    (u) => u.role === "Apprentice" && u.status === "invited",
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
    <ApprenticePageShell
      eyebrow="Administration"
      title="Administration Dashboard"
      description="Apprentice path only: intake → enrol on a programme → enable their portal. Transfers cover college-day / group and employer moves. Staff accounts sit on Management."
      actions={
        <div className={styles.toolbarActions}>
          <Link href="/administration/intake" className={styles.primaryBtn}>
            Start new apprentice
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
      <div className={`${apprenticeStyles.stack} ${apprenticeStyles.dashRoot}`}>
        <div className={apprenticeStyles.grid}>
          <Link
            href="/administration/intake"
            className={apprenticeStyles.glanceLink}
            data-tone="amber"
          >
            <p className={apprenticeStyles.glanceLabel}>Intake in progress</p>
            <p className={apprenticeStyles.glanceValue}>{intakeQueue.length}</p>
            <p className={apprenticeStyles.glanceHint}>
              Personal details still open
            </p>
          </Link>
          <Link
            href="/administration/enrolments"
            className={apprenticeStyles.glanceLink}
            data-tone="navy"
          >
            <p className={apprenticeStyles.glanceLabel}>Ready to enrol</p>
            <p className={apprenticeStyles.glanceValue}>{readyToEnrol.length}</p>
            <p className={apprenticeStyles.glanceHint}>
              Marked ready — put on a programme
            </p>
          </Link>
          <Link
            href="/administration/accounts"
            className={apprenticeStyles.glanceLink}
            data-tone="red"
          >
            <p className={apprenticeStyles.glanceLabel}>Awaiting enable</p>
            <p className={apprenticeStyles.glanceValue}>{awaitingEnable.length}</p>
            <p className={apprenticeStyles.glanceHint}>
              Apprentice environments to turn on
            </p>
          </Link>
          <div className={apprenticeStyles.glance} data-tone="green">
            <p className={apprenticeStyles.glanceLabel}>Apprentices online</p>
            <p className={apprenticeStyles.glanceValue}>—</p>
            <p className={apprenticeStyles.glanceHint}>
              Live presence connects with portal sessions
            </p>
          </div>
        </div>

        <section className={apprenticeStyles.section}>
          <h2 className={apprenticeStyles.dashSectionTitle} data-accent="navy">
            Shortcuts
          </h2>
          <div className={apprenticeStyles.shortcuts}>
            <Link
              className={apprenticeStyles.shortcut}
              href="/administration/intake"
              data-tone="amber"
            >
              Apprentice Intake
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/administration/enrolments"
              data-tone="navy"
            >
              Apprentice Enrolments
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/administration/accounts"
              data-tone="red"
            >
              Apprentice Account Setup
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/administration/cohorts"
              data-tone="navy"
            >
              Cohorts &amp; Groups
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/administration/employers"
              data-tone="green"
            >
              Employer records
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/administration/programmes"
              data-tone="navy"
            >
              Programme records
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/apprentices?from=administration"
              data-tone="navy"
            >
              Apprentices
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/administration/shared-drive"
              data-tone="green"
            >
              Shared Drive
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/administration/messages"
              data-tone="amber"
            >
              Messages
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/administration/safeguarding"
              data-tone="red"
            >
              Safeguarding
            </Link>
          </div>
        </section>

        <section className={apprenticeStyles.section}>
          <h2 className={apprenticeStyles.dashSectionTitle} data-accent="amber">
            Needs attention
          </h2>
          <p className={apprenticeStyles.meta}>
            {attentionCount === 0
              ? "Nothing waiting right now"
              : `${attentionCount} item${attentionCount === 1 ? "" : "s"} across intake, enrolment, and account setup`}
          </p>

          {attentionCount === 0 ? (
            <p className={styles.empty}>Queues are clear.</p>
          ) : (
            <ul className={apprenticeStyles.list}>
              {intakeQueue.slice(0, 4).map((row) => (
                <li key={`intake-${row.id}`}>
                  <Link
                    href="/administration/intake"
                    className={apprenticeStyles.rowLink}
                    data-tone="amber"
                  >
                    <div className={apprenticeStyles.rowMain}>
                      <strong>{row.displayName}</strong>
                      <span>
                        Intake draft
                        {row.apprenticeReference
                          ? ` · ${row.apprenticeReference}`
                          : ""}
                        {row.town ? ` · ${row.town}` : ""}
                      </span>
                    </div>
                    <div className={apprenticeStyles.rowEnd}>
                      <ApprenticeStatusChip tone="amber">
                        In progress
                      </ApprenticeStatusChip>
                      <span className={apprenticeStyles.linkish}>Continue →</span>
                    </div>
                  </Link>
                </li>
              ))}

              {readyToEnrol.slice(0, 4).map((row) => (
                <li key={`ready-${row.id}`}>
                  <Link
                    href="/administration/enrolments"
                    className={apprenticeStyles.rowLink}
                    data-tone="navy"
                  >
                    <div className={apprenticeStyles.rowMain}>
                      <strong>{row.displayName}</strong>
                      <span>
                        Ready for enrolment
                        {row.apprenticeReference
                          ? ` · ${row.apprenticeReference}`
                          : ""}
                      </span>
                    </div>
                    <div className={apprenticeStyles.rowEnd}>
                      <ApprenticeStatusChip tone="navy">
                        Ready to enrol
                      </ApprenticeStatusChip>
                      <span className={apprenticeStyles.linkish}>Enrol →</span>
                    </div>
                  </Link>
                </li>
              ))}

              {awaitingEnable.slice(0, 4).map((row) => (
                <li key={`enable-${row.id}`}>
                  <Link
                    href="/administration/accounts"
                    className={apprenticeStyles.rowLink}
                    data-tone="red"
                  >
                    <div className={apprenticeStyles.rowMain}>
                      <strong>{row.displayName}</strong>
                      <span>Apprentice environment awaiting enable</span>
                    </div>
                    <div className={apprenticeStyles.rowEnd}>
                      <ApprenticeStatusChip tone="amber">
                        Awaiting enable
                      </ApprenticeStatusChip>
                      <span className={apprenticeStyles.linkish}>Enable →</span>
                    </div>
                  </Link>
                </li>
              ))}

              {pendingStart.slice(0, 4).map((row) => (
                <li key={`pending-${row.id}`}>
                  <Link
                    href="/administration/enrolments"
                    className={apprenticeStyles.rowLink}
                    data-tone="amber"
                  >
                    <div className={apprenticeStyles.rowMain}>
                      <strong>{row.displayName}</strong>
                      <span>
                        {row.programmeName} · {row.employerName} · starts{" "}
                        {formatDate(row.startDate)}
                      </span>
                    </div>
                    <div className={apprenticeStyles.rowEnd}>
                      <ApprenticeStatusChip tone="amber">
                        Pending start
                      </ApprenticeStatusChip>
                      <span className={apprenticeStyles.linkish}>Open →</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={apprenticeStyles.section}>
          <h2 className={apprenticeStyles.dashSectionTitle} data-accent="navy">
            Recent enrolments
          </h2>
          <p className={apprenticeStyles.meta}>
            Latest new starters and currently studying placements — open an
            enrolment to transfer group or employer
          </p>
          {recentEnrolments.length === 0 ? (
            <p className={styles.empty}>No enrolments yet.</p>
          ) : (
            <ul className={apprenticeStyles.list}>
              {recentEnrolments.map((row) => (
                <li key={row.id}>
                  <Link
                    href="/administration/enrolments"
                    className={apprenticeStyles.rowLink}
                    data-tone="navy"
                  >
                    <div className={apprenticeStyles.rowMain}>
                      <strong>{row.displayName}</strong>
                      <span>
                        {row.kind === "new_starter"
                          ? "New starter"
                          : "Currently studying"}{" "}
                        · {row.programmeName} · {row.employerName}
                        {row.collegeDays ? ` · ${row.collegeDays}` : ""}
                      </span>
                    </div>
                    <div className={apprenticeStyles.rowEnd}>
                      <ApprenticeStatusChip
                        tone={
                          row.status === "active"
                            ? "green"
                            : row.status === "pending_start"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {row.status.replace("_", " ")}
                      </ApprenticeStatusChip>
                      <span className={apprenticeStyles.linkish}>Open →</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {recentTransfers.length > 0 ? (
          <section className={apprenticeStyles.section}>
            <h2 className={apprenticeStyles.dashSectionTitle} data-accent="green">
              Recent transfers
            </h2>
            <p className={apprenticeStyles.meta}>
              Group / college-day or employer moves recorded on enrolments
            </p>
            <ul className={apprenticeStyles.list}>
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
                      className={apprenticeStyles.rowLink}
                      data-tone="green"
                    >
                      <div className={apprenticeStyles.rowMain}>
                        <strong>{row.displayName}</strong>
                        <span>{lastLine}</span>
                      </div>
                      <div className={apprenticeStyles.rowEnd}>
                        <ApprenticeStatusChip tone="green">
                          Transferred
                        </ApprenticeStatusChip>
                        <span className={apprenticeStyles.linkish}>Open →</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </ApprenticePageShell>
  );
}
