"use client";

import Link from "next/link";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "@/features/learner-portal/components/LearnerPageShell";
import learnerStyles from "@/features/learner-portal/screens/learner-pages.module.css";
import { getAdminStats, resetAdminStore } from "../domain/store";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

export function AdministrationDashboardScreen() {
  const store = useAdminStore();
  const stats = getAdminStats();
  const recentEnrolments = [...store.enrolments]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const pending = store.enrolments.filter(
    (e) => e.status === "pending_start" || e.status === "draft",
  );

  return (
    <LearnerPageShell
      eyebrow="Administration"
      title="Administration Dashboard"
      description="Enrol new starters, register learners already on programme, and keep employer and portal user records tidy."
      actions={
        <div className={styles.toolbarActions}>
          <Link href="/administration/enrolments" className={styles.primaryBtn}>
            Add learner
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
            href="/administration/enrolments"
            className={learnerStyles.glanceLink}
            data-tone="navy"
          >
            <p className={learnerStyles.glanceLabel}>Active learners</p>
            <p className={learnerStyles.glanceValue}>{stats.activeLearners}</p>
            <p className={learnerStyles.glanceHint}>On programme now</p>
          </Link>
          <Link
            href="/administration/enrolments"
            className={learnerStyles.glanceLink}
            data-tone="amber"
          >
            <p className={learnerStyles.glanceLabel}>Pending start</p>
            <p className={learnerStyles.glanceValue}>{stats.pendingStart}</p>
            <p className={learnerStyles.glanceHint}>New starters not yet live</p>
          </Link>
          <Link
            href="/administration/employers"
            className={learnerStyles.glanceLink}
            data-tone="green"
          >
            <p className={learnerStyles.glanceLabel}>Employers</p>
            <p className={learnerStyles.glanceValue}>{stats.activeEmployers}</p>
            <p className={learnerStyles.glanceHint}>Active workplace records</p>
          </Link>
          <Link
            href="/administration/accounts"
            className={learnerStyles.glanceLink}
            data-tone="red"
          >
            <p className={learnerStyles.glanceLabel}>Portal users</p>
            <p className={learnerStyles.glanceValue}>{stats.portalUsers}</p>
            <p className={learnerStyles.glanceHint}>Accounts that can sign in</p>
          </Link>
        </div>

        <section className={learnerStyles.section}>
          <h2 className={learnerStyles.dashSectionTitle} data-accent="navy">
            Shortcuts
          </h2>
          <div className={learnerStyles.shortcuts}>
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
              href="/administration/enrolments"
              data-tone="amber"
            >
              Learner enrolments
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
              href="/administration/accounts"
              data-tone="red"
            >
              Account setup
            </Link>
          </div>
        </section>

        <section className={learnerStyles.section}>
          <h2 className={learnerStyles.dashSectionTitle} data-accent="amber">
            Needs attention
          </h2>
          <p className={learnerStyles.meta}>
            {pending.length} enrolment{pending.length === 1 ? "" : "s"} waiting
            to go live
          </p>
          {pending.length === 0 ? (
            <p className={styles.empty}>No pending starters right now.</p>
          ) : (
            <ul className={learnerStyles.list}>
              {pending.map((row) => (
                <li key={row.id}>
                  <Link
                    href="/administration/enrolments"
                    className={learnerStyles.rowLink}
                    data-tone="amber"
                  >
                    <div className={learnerStyles.rowMain}>
                      <strong>{row.displayName}</strong>
                      <span>
                        {row.programmeName} · {row.employerName} · start{" "}
                        {row.startDate}
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
            Latest updates across new starters and current learners
          </p>
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
        </section>
      </div>
    </LearnerPageShell>
  );
}
