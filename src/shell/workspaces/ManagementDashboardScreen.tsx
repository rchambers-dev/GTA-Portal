"use client";

import Link from "next/link";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import apprenticeStyles from "@/features/apprentice-portal/screens/apprentice-pages.module.css";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import styles from "@/features/administration/screens/admin-pages.module.css";

function isStaffUser(role: string): boolean {
  return role !== "Apprentice" && role !== "Employer";
}

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

/**
 * Leadership board for Management / Owner.
 * Deliberately excludes Administration day-to-day (intake, enrolments, employers).
 */
export function ManagementDashboardScreen() {
  const store = useAdminStore();

  const staffUsers = store.users.filter((u) => isStaffUser(u.role));
  const staffAwaitingEnable = staffUsers.filter((u) => u.status === "invited");
  const staffActive = staffUsers.filter((u) => u.status === "active");
  const staffDisabled = staffUsers.filter((u) => u.status === "disabled");

  const activeCohorts = store.cohorts.filter((c) => c.status === "active");
  const plannedCohorts = store.cohorts.filter((c) => c.status === "planned");
  const activeProgrammes = store.programmes.filter((p) => p.status === "active");
  const activeEnrolments = store.enrolments.filter((e) => e.status === "active");

  const upcomingCohorts = [...plannedCohorts]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 5);

  const recentActiveCohorts = [...activeCohorts]
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, 5);

  return (
    <ApprenticePageShell
      eyebrow="Management"
      title="Management Dashboard"
      description="Programme oversight, staffing, funding and progression — not the Administration intake desk. Day-to-day apprentice enrolment stays with Administration."
      actions={
        <div className={styles.toolbarActions}>
          <Link href="/management/course-builder" className={styles.primaryBtn}>
            Course Builder
          </Link>
          <Link href="/management/staff" className={styles.secondaryBtn}>
            Staff
          </Link>
        </div>
      }
    >
      <div className={`${apprenticeStyles.stack} ${apprenticeStyles.dashRoot}`}>
        <div className={apprenticeStyles.grid}>
          <Link
            href="/management/staff"
            className={apprenticeStyles.glanceLink}
            data-tone="amber"
          >
            <p className={apprenticeStyles.glanceLabel}>Staff awaiting enable</p>
            <p className={apprenticeStyles.glanceValue}>
              {staffAwaitingEnable.length}
            </p>
            <p className={apprenticeStyles.glanceHint}>
              Turn on staff portal environments
            </p>
          </Link>
          <Link
            href="/management/staff"
            className={apprenticeStyles.glanceLink}
            data-tone="green"
          >
            <p className={apprenticeStyles.glanceLabel}>Active staff</p>
            <p className={apprenticeStyles.glanceValue}>{staffActive.length}</p>
            <p className={apprenticeStyles.glanceHint}>
              {staffDisabled.length > 0
                ? `${staffDisabled.length} disabled`
                : "Enabled portal accounts"}
            </p>
          </Link>
          <Link
            href="/management/cohorts"
            className={apprenticeStyles.glanceLink}
            data-tone="navy"
          >
            <p className={apprenticeStyles.glanceLabel}>Active cohorts</p>
            <p className={apprenticeStyles.glanceValue}>
              {activeCohorts.length}
            </p>
            <p className={apprenticeStyles.glanceHint}>
              {plannedCohorts.length} planned intake
              {plannedCohorts.length === 1 ? "" : "s"}
            </p>
          </Link>
          <Link
            href="/management/apprentice-brag"
            className={apprenticeStyles.glanceLink}
            data-tone="red"
          >
            <p className={apprenticeStyles.glanceLabel}>On programme</p>
            <p className={apprenticeStyles.glanceValue}>
              {activeEnrolments.length}
            </p>
            <p className={apprenticeStyles.glanceHint}>
              Open progression BRAG for detail
            </p>
          </Link>
        </div>

        <section className={apprenticeStyles.section}>
          <h2 className={apprenticeStyles.dashSectionTitle} data-accent="navy">
            Management work
          </h2>
          <p className={apprenticeStyles.meta}>
            Areas Jon and Management own — Administration covers intake,
            enrolments, and apprentice account setup.
          </p>
          <div className={apprenticeStyles.shortcuts}>
            <Link
              className={apprenticeStyles.shortcut}
              href="/management/course-builder"
              data-tone="navy"
            >
              Course Builder
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/management/apprentice-funding"
              data-tone="amber"
            >
              Apprentice funding (RPL / KSB)
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/management/apprentice-brag"
              data-tone="red"
            >
              Progression BRAG
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/management/staff"
              data-tone="green"
            >
              Staff
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/staff-records?from=management"
              data-tone="green"
            >
              Staff Records
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/management/roles"
              data-tone="navy"
            >
              Roles &amp; responsibilities
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/management/audit"
              data-tone="navy"
            >
              Audit history
            </Link>
            <Link
              className={apprenticeStyles.shortcut}
              href="/management/programmes-records"
              data-tone="amber"
            >
              Apprenticeships
            </Link>
          </div>
        </section>

        <section className={apprenticeStyles.section}>
          <h2 className={apprenticeStyles.dashSectionTitle} data-accent="amber">
            Staff attention
          </h2>
          <p className={apprenticeStyles.meta}>
            {staffAwaitingEnable.length === 0
              ? "No staff environments waiting to be enabled"
              : `${staffAwaitingEnable.length} staff account${staffAwaitingEnable.length === 1 ? "" : "s"} awaiting enable`}
          </p>
          {staffAwaitingEnable.length === 0 ? (
            <p className={styles.empty}>Staff enable queue is clear.</p>
          ) : (
            <ul className={apprenticeStyles.list}>
              {staffAwaitingEnable.slice(0, 6).map((row) => (
                <li key={row.id}>
                  <Link
                    href="/management/staff"
                    className={apprenticeStyles.rowLink}
                    data-tone="amber"
                  >
                    <div className={apprenticeStyles.rowMain}>
                      <strong>{row.displayName}</strong>
                      <span>
                        {row.role}
                        {row.email ? ` · ${row.email}` : ""}
                      </span>
                    </div>
                    <div className={apprenticeStyles.rowEnd}>
                      <ApprenticeStatusChip tone="amber">
                        Awaiting enable
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
            Cohort oversight
          </h2>
          <p className={apprenticeStyles.meta}>
            Planned and live intakes across {activeProgrammes.length} active
            apprenticeship
            {activeProgrammes.length === 1 ? "" : "s"}. Group placement still
            happens in Administration.
          </p>
          {upcomingCohorts.length === 0 && recentActiveCohorts.length === 0 ? (
            <p className={styles.empty}>No cohorts on record yet.</p>
          ) : (
            <ul className={apprenticeStyles.list}>
              {upcomingCohorts.map((row) => (
                <li key={`planned-${row.id}`}>
                  <Link
                    href="/management/cohorts"
                    className={apprenticeStyles.rowLink}
                    data-tone="amber"
                  >
                    <div className={apprenticeStyles.rowMain}>
                      <strong>{row.name}</strong>
                      <span>
                        Planned · starts {formatDate(row.startDate)} · v
                        {row.standardVersion}
                      </span>
                    </div>
                    <div className={apprenticeStyles.rowEnd}>
                      <ApprenticeStatusChip tone="amber">
                        Planned
                      </ApprenticeStatusChip>
                      <span className={apprenticeStyles.linkish}>Open →</span>
                    </div>
                  </Link>
                </li>
              ))}
              {recentActiveCohorts.map((row) => (
                <li key={`active-${row.id}`}>
                  <Link
                    href="/management/cohorts"
                    className={apprenticeStyles.rowLink}
                    data-tone="navy"
                  >
                    <div className={apprenticeStyles.rowMain}>
                      <strong>{row.name}</strong>
                      <span>
                        Active · started {formatDate(row.startDate)} · v
                        {row.standardVersion}
                      </span>
                    </div>
                    <div className={apprenticeStyles.rowEnd}>
                      <ApprenticeStatusChip tone="green">
                        Active
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
          <h2 className={apprenticeStyles.dashSectionTitle} data-accent="green">
            Programme &amp; funding
          </h2>
          <ul className={apprenticeStyles.list}>
            <li>
              <Link
                href="/management/course-builder"
                className={apprenticeStyles.rowLink}
                data-tone="navy"
              >
                <div className={apprenticeStyles.rowMain}>
                  <strong>Course Builder</strong>
                  <span>
                    Author groups and block packs per Skills England version
                  </span>
                </div>
                <div className={apprenticeStyles.rowEnd}>
                  <span className={apprenticeStyles.linkish}>Open →</span>
                </div>
              </Link>
            </li>
            <li>
              <Link
                href="/management/apprentice-funding"
                className={apprenticeStyles.rowLink}
                data-tone="amber"
              >
                <div className={apprenticeStyles.rowMain}>
                  <strong>Apprentice funding (RPL / KSB)</strong>
                  <span>
                    Per-apprentice Knowledge / Skills / Behaviours adjustments
                  </span>
                </div>
                <div className={apprenticeStyles.rowEnd}>
                  <span className={apprenticeStyles.linkish}>Open →</span>
                </div>
              </Link>
            </li>
            <li>
              <Link
                href="/management/apprentice-brag"
                className={apprenticeStyles.rowLink}
                data-tone="red"
              >
                <div className={apprenticeStyles.rowMain}>
                  <strong>Apprentice progression BRAG</strong>
                  <span>
                    Overall and per-block Blue / Green / Amber / Red against
                    cohort dates
                  </span>
                </div>
                <div className={apprenticeStyles.rowEnd}>
                  <span className={apprenticeStyles.linkish}>Open →</span>
                </div>
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </ApprenticePageShell>
  );
}
