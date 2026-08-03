"use client";

import { useMemo, useState } from "react";
import { ApprenticePageShell, ApprenticeStatusChip } from "@/features/apprentice-portal/components/ApprenticePageShell";
import {
  calculateProgrammeWeek,
  formatDisplayDate,
} from "@/features/apprentice-lifecycle/domain/programme-week";
import { enrolmentPositionLabel } from "../domain/enrolment-status";
import type {
  AdminCohortRecord,
  AdminApprenticeEnrolment,
  AdminProgrammeRecord,
} from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

type ProgrammeSearchMode = "name" | "code" | "level";

const SEARCH_MODES: Array<{
  id: ProgrammeSearchMode;
  label: string;
  placeholder: string;
}> = [
  { id: "name", label: "Name", placeholder: "Search by programme name…" },
  { id: "code", label: "Code", placeholder: "Search by standard code…" },
  { id: "level", label: "Level", placeholder: "Search by level, e.g. 2 or 3…" },
];

function apprenticesForProgramme(
  enrolments: AdminApprenticeEnrolment[],
  programme: AdminProgrammeRecord,
): AdminApprenticeEnrolment[] {
  return enrolments
    .filter(
      (e) =>
        e.standardCode.toUpperCase() === programme.standardCode.toUpperCase() ||
        e.programmeName === programme.name,
    )
    .sort((a, b) => {
      // Newest start date first; same intake → name
      const byStart = (b.startDate || "").localeCompare(a.startDate || "");
      if (byStart !== 0) return byStart;
      return a.displayName.localeCompare(b.displayName);
    });
}

function programmeMatchesQuery(
  row: AdminProgrammeRecord,
  query: string,
  mode: ProgrammeSearchMode,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  switch (mode) {
    case "name":
      return q
        .split(/\s+/)
        .every((token) => row.name.toLowerCase().includes(token));
    case "code":
      return row.standardCode.toLowerCase().replace(/\s+/g, "").includes(
        q.replace(/\s+/g, ""),
      );
    case "level":
      return String(row.level).includes(q.replace(/[^0-9]/g, ""));
  }
}

function findCohort(
  cohorts: AdminCohortRecord[],
  cohortId: string | null,
): AdminCohortRecord | null {
  if (!cohortId) return null;
  return cohorts.find((c) => c.id === cohortId) ?? null;
}

function formatIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return formatDisplayDate(date);
}

/**
 * One consistent line: employer · cohort · Skills England version · start/progress.
 * Cohort pins the standard version; pending starters show start date only (no Y/W).
 */
function apprenticeMetaLine(
  apprentice: AdminApprenticeEnrolment,
  cohort: AdminCohortRecord | null,
): string {
  const parts: string[] = [apprentice.employerName];

  if (cohort) {
    parts.push(cohort.name);
    if (cohort.standardVersion) {
      parts.push(`v${cohort.standardVersion}`);
    }
  } else if (apprentice.programmeName) {
    parts.push(apprentice.programmeName);
  }

  const startLabel = formatIsoDate(apprentice.startDate);
  const hasStarted =
    Boolean(apprentice.startDate) &&
    calculateProgrammeWeek(apprentice.startDate) != null;

  if (!hasStarted && startLabel) {
    parts.push(`starts ${startLabel}`);
  } else {
    if (startLabel) parts.push(`started ${startLabel}`);
    const position = enrolmentPositionLabel(
      apprentice.startDate,
      apprentice.programmeYear,
      apprentice.programmeWeek,
    );
    const yw = /^Y(\d+) · W(\d+)$/.exec(position);
    if (yw) {
      parts.push(`Y${yw[1]}`, `W${yw[2]}`);
    }
  }

  return parts.join(" · ");
}

/**
 * Apprenticeships — view-only for Administration.
 * Click a programme card to list apprentices on that programme.
 * Programme setup / version edits stay with Management (Jon).
 */
export function AdminProgrammesScreen() {
  const store = useAdminStore();
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<ProgrammeSearchMode>("name");
  const [openProgrammeId, setOpenProgrammeId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const rows = [...store.programmes].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return rows.filter((row) => programmeMatchesQuery(row, query, searchMode));
  }, [query, searchMode, store.programmes]);

  const totalProgrammes = store.programmes.length;
  const activeSearch = SEARCH_MODES.find((m) => m.id === searchMode)!;

  return (
    <ApprenticePageShell
      eyebrow="Administration"
      title="Apprenticeships"
      description="View apprenticeship standards and who is enrolled. Programme setup is managed by Management — this page is read-only."
    >
      <div className={styles.stack}>
        <div className={styles.searchBlock}>
          <div className={styles.searchModeRow}>
            <p className={styles.searchModeLabel}>Search by</p>
            <div
              className={styles.searchModeTabs}
              role="group"
              aria-label="Search programmes by"
            >
              {SEARCH_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={
                    searchMode === mode.id
                      ? styles.searchModeActive
                      : styles.searchModeBtn
                  }
                  aria-pressed={searchMode === mode.id}
                  onClick={() => setSearchMode(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <p className={styles.searchResultCount}>
              {query.trim()
                ? `Showing ${filtered.length} of ${totalProgrammes}`
                : `${totalProgrammes} programme${totalProgrammes === 1 ? "" : "s"}`}
            </p>
          </div>
          <label className={styles.searchField}>
            <span>Search programmes</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeSearch.placeholder}
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className={styles.empty}>No programmes match this search.</p>
        ) : (
          <div className={styles.employerList}>
            {filtered.map((row) => {
              const linked = apprenticesForProgramme(store.enrolments, row);
              const open = openProgrammeId === row.id;
              const tone = linked.length > 0 ? "green" : "amber";
              const apprenticeLabel =
                linked.length === 0
                  ? "No apprentices enrolled"
                  : linked.length === 1
                    ? "1 apprentice"
                    : `${linked.length} apprentices`;
              return (
                <article
                  key={row.id}
                  className={styles.employerCard}
                  data-tone={tone}
                  data-open={open ? "true" : "false"}
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  aria-controls={`programme-apprentices-${row.id}`}
                  aria-label={`${open ? "Collapse" : "Expand"} ${row.name} — ${apprenticeLabel}`}
                  onClick={() =>
                    setOpenProgrammeId((current) =>
                      current === row.id ? null : row.id,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOpenProgrammeId((current) =>
                        current === row.id ? null : row.id,
                      );
                    }
                  }}
                >
                  <div className={styles.employerCardHeader}>
                    <div className={styles.employerCardMain}>
                      <strong className={styles.employerName}>{row.name}</strong>
                      <span>
                        {row.standardCode} · Level {row.level}
                        {row.durationMonths
                          ? ` · ${row.durationMonths} months`
                          : ""}
                      </span>
                      <span>
                        {row.awardingBody || "Awarding body not set"}
                        {row.route ? ` · ${row.route}` : ""}
                      </span>
                      <span>{apprenticeLabel}</span>
                    </div>
                  </div>

                  {open ? (
                    <div
                      className={styles.employerCardBody}
                      id={`programme-apprentices-${row.id}`}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {row.summary ? (
                        <p className={styles.muted}>{row.summary}</p>
                      ) : null}

                      <div className={styles.linkedApprentices}>
                        <div className={styles.linkedApprenticesHead}>
                          <h3>Apprentices on this programme</h3>
                          <span className={styles.searchResultCount}>
                            {linked.length}
                          </span>
                        </div>
                        {linked.length === 0 ? (
                          <p className={styles.empty}>
                            No apprentices enrolled on this programme yet.
                          </p>
                        ) : (
                          <ul className={styles.linkedApprenticeList}>
                            {linked.map((apprentice) => {
                              const cohort = findCohort(
                                store.cohorts,
                                apprentice.cohortId,
                              );
                              return (
                                <li key={apprentice.id}>
                                  <div className={styles.linkedApprenticeRow}>
                                    <div className={styles.linkedApprenticeMain}>
                                      <strong>{apprentice.displayName}</strong>
                                      <span>
                                        {apprenticeMetaLine(apprentice, cohort)}
                                      </span>
                                    </div>
                                    <ApprenticeStatusChip
                                      tone={
                                        apprentice.status === "active"
                                          ? "green"
                                          : apprentice.status === "pending_start" ||
                                              apprentice.status === "draft"
                                            ? "amber"
                                            : "neutral"
                                      }
                                    >
                                      {apprentice.status.replace("_", " ")}
                                    </ApprenticeStatusChip>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>

                      {row.skillsEnglandUrl ? (
                        <div className={styles.formActions}>
                          <a
                            href={row.skillsEnglandUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.secondaryBtn}
                          >
                            Open Skills England
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </ApprenticePageShell>
  );
}
