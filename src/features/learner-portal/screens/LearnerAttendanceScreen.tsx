"use client";

import { useMemo, useState } from "react";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "../components/LearnerPageShell";
import { Shareable } from "../components/portal-share/Shareable";
import {
  ALEX_ATTENDANCE_BREAKDOWN,
  ALEX_ATTENDANCE_DAYS,
  ALEX_PROFILE,
  summariseAlexAttendance,
  summariseMissedLearning,
  type LearnerAttendanceStatus,
  type LearnerMissedLearningItem,
} from "../domain/mock-learner";
import styles from "./learner-pages.module.css";
import Link from "next/link";

type ChipTone = "neutral" | "green" | "amber" | "red" | "blue" | "navy";

function tone(status: LearnerAttendanceStatus): ChipTone {
  switch (status) {
    case "attended":
      return "green";
    case "late":
      return "amber";
    case "authorised":
      return "navy";
    case "unauthorised":
    case "absent":
      return "red";
    case "college_closed":
      return "neutral";
  }
}

function label(status: LearnerAttendanceStatus): string {
  switch (status) {
    case "attended":
      return "Attended";
    case "late":
      return "Late";
    case "authorised":
      return "Authorised absence";
    case "unauthorised":
      return "Unauthorised absence";
    case "absent":
      return "Absent";
    case "college_closed":
      return "College closed";
  }
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dayKey(day: (typeof ALEX_ATTENDANCE_DAYS)[number]): string {
  return `${day.date}|${day.session}`;
}

function buildConicGradient(
  slices: Array<{ count: number; color: string }>,
  total: number,
): string {
  if (total <= 0) return "var(--color-grey-100)";
  let cursor = 0;
  const stops: string[] = [];
  for (const slice of slices) {
    if (slice.count <= 0) continue;
    const start = (cursor / total) * 360;
    cursor += slice.count;
    const end = (cursor / total) * 360;
    stops.push(`${slice.color} ${start}deg ${end}deg`);
  }
  return stops.length > 0
    ? `conic-gradient(from -90deg, ${stops.join(", ")})`
    : "var(--color-grey-100)";
}

export function LearnerAttendanceScreen() {
  const summary = useMemo(() => summariseAlexAttendance(), []);
  const mixSlices = useMemo(
    () => ALEX_ATTENDANCE_BREAKDOWN.filter((item) => item.count > 0),
    [],
  );
  const mixTotal = useMemo(
    () => mixSlices.reduce((sum, item) => sum + item.count, 0),
    [mixSlices],
  );
  const mixPieBackground = useMemo(
    () => buildConicGradient(mixSlices, mixTotal),
    [mixSlices, mixTotal],
  );

  const outcomeSlices = useMemo(() => {
    const attended = ALEX_ATTENDANCE_BREAKDOWN.filter(
      (item) => item.status === "attended" || item.status === "late",
    ).reduce((sum, item) => sum + item.count, 0);
    const missed = ALEX_ATTENDANCE_BREAKDOWN.filter(
      (item) =>
        item.status === "authorised" ||
        item.status === "unauthorised" ||
        item.status === "absent",
    ).reduce((sum, item) => sum + item.count, 0);
    return [
      {
        id: "attended",
        label: "Lessons attended",
        hint: "Includes late arrivals",
        count: attended,
        color: "var(--color-green-600)",
      },
      {
        id: "missed",
        label: "Lessons missed",
        hint: "Authorised, unauthorised & absent",
        count: missed,
        color: "var(--color-red-500)",
      },
    ] as const;
  }, []);
  const outcomeTotal = useMemo(
    () => outcomeSlices.reduce((sum, item) => sum + item.count, 0),
    [outcomeSlices],
  );
  const outcomePieBackground = useMemo(
    () => buildConicGradient([...outcomeSlices], outcomeTotal),
    [outcomeSlices, outcomeTotal],
  );
  const attendedPercent =
    outcomeTotal === 0
      ? 0
      : Math.round((outcomeSlices[0].count / outcomeTotal) * 100);

  const missedLearning = useMemo(() => summariseMissedLearning(), []);
  const missedPieBackground = useMemo(
    () =>
      buildConicGradient(
        missedLearning.slices.map((slice) => ({
          count: slice.count,
          color: slice.color,
        })),
        missedLearning.total,
      ),
    [missedLearning],
  );

  function missedKindLabel(kind: LearnerMissedLearningItem["kind"]): string {
    switch (kind) {
      case "module":
        return "Module";
      case "task":
        return "Task";
      case "workshop":
        return "Workshop";
    }
  }

  function missedCatchUpTone(
    status: LearnerMissedLearningItem["catchUpStatus"],
  ): ChipTone {
    switch (status) {
      case "done":
        return "green";
      case "in_progress":
        return "amber";
      case "needed":
        return "red";
    }
  }

  function missedCatchUpLabel(
    status: LearnerMissedLearningItem["catchUpStatus"],
  ): string {
    switch (status) {
      case "done":
        return "Caught up";
      case "in_progress":
        return "Catch-up started";
      case "needed":
        return "Needs catch-up";
    }
  }

  const [statusFilter, setStatusFilter] = useState<"all" | LearnerAttendanceStatus>(
    "all",
  );
  const [dateQuery, setDateQuery] = useState("");
  const [daysOpen, setDaysOpen] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const filterOptions = useMemo(() => {
    const present = new Set(ALEX_ATTENDANCE_DAYS.map((day) => day.status));
    return ALEX_ATTENDANCE_BREAKDOWN.filter((item) => present.has(item.status));
  }, []);

  const filteredDays = useMemo(() => {
    const query = dateQuery.trim().toLowerCase();
    return ALEX_ATTENDANCE_DAYS.filter((day) => {
      if (statusFilter !== "all" && day.status !== statusFilter) return false;
      if (!query) return true;

      const formatted = formatDate(day.date).toLowerCase();
      const slashDate = day.date.split("-").reverse().join("/");
      const haystack = [
        day.date,
        slashDate,
        formatted,
        day.dayName,
        day.session,
        label(day.status),
        day.note ?? "",
        ...(day.missedItems ?? []).flatMap((item) => [
          item.title,
          item.detail,
          item.moduleCode ?? "",
        ]),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [statusFilter, dateQuery]);

  const presetCounts = useMemo(() => {
    const counts: Record<"all" | LearnerAttendanceStatus, number> = {
      all: ALEX_ATTENDANCE_DAYS.length,
      attended: 0,
      late: 0,
      authorised: 0,
      unauthorised: 0,
      absent: 0,
      college_closed: 0,
    };
    for (const day of ALEX_ATTENDANCE_DAYS) {
      counts[day.status] += 1;
    }
    return counts;
  }, []);

  function shortPresetLabel(status: LearnerAttendanceStatus): string {
    switch (status) {
      case "attended":
        return "Attended";
      case "late":
        return "Late";
      case "authorised":
        return "Authorised";
      case "unauthorised":
        return "Unauthorised";
      case "absent":
        return "Absent";
      case "college_closed":
        return "College closed";
    }
  }

  return (
    <LearnerPageShell
      title="Attendance"
      description={`College days are ${ALEX_PROFILE.collegeDays}. Overall attendance is ${ALEX_PROFILE.attendancePercent}%.`}
    >
      <div className={`${styles.stack} ${styles.attendanceRoot}`}>
        <div className={styles.grid}>
          <div className={styles.glance} data-tone="green">
            <p className={styles.glanceLabel}>Attendance</p>
            <p className={styles.glanceValue}>
              {ALEX_PROFILE.attendancePercent}%
            </p>
            <p className={styles.glanceHint}>
              {summary.present} of {summary.expected} expected sessions
            </p>
          </div>
          <div className={styles.glance} data-tone="navy">
            <p className={styles.glanceLabel}>Pattern</p>
            <p className={styles.glanceValueSmall}>
              {ALEX_PROFILE.collegeDays}
            </p>
            <p className={styles.glanceHint}>Expected on campus</p>
          </div>
          <div className={styles.glance} data-tone="amber">
            <p className={styles.glanceLabel}>Catalogued</p>
            <p className={styles.glanceValue}>{summary.catalogued}</p>
            <p className={styles.glanceHint}>
              Sessions including college closures
            </p>
          </div>
        </div>

        <section className={styles.attendanceChartCard}>
          <div className={styles.attendanceChartHead}>
            <h2 className={styles.sectionTitle}>Attendance at a glance</h2>
            <p className={styles.attendanceChartCopy}>
              Year-to-date college sessions — and what you need to catch up when
              you missed a day (college closures excluded from missed).
            </p>
          </div>

          <div className={styles.attendanceChartGrid}>
            <Shareable
              as="article"
              kind="view"
              href="/learner/attendance"
              title="Attendance overall mix"
              detail={`${ALEX_PROFILE.attendancePercent}% overall · year-to-date college sessions`}
              area="Attendance"
              actionLabel="Open chart"
              className={styles.attendanceChartPanel}
            >
              <h3 className={styles.attendanceChartPanelTitle}>
                Overall mix
              </h3>
              <div className={styles.attendanceChartBody}>
                <div
                  className={styles.attendancePie}
                  style={{ background: mixPieBackground }}
                  role="img"
                  aria-label={`Attendance mix pie chart: ${ALEX_PROFILE.attendancePercent}% overall`}
                >
                  <div className={styles.attendancePieHole}>
                    <strong>{ALEX_PROFILE.attendancePercent}%</strong>
                    <span>Overall</span>
                  </div>
                </div>

                <ul className={styles.attendanceLegend}>
                  {mixSlices.map((item) => (
                    <li
                      key={item.status}
                      className={styles.attendanceLegendItem}
                    >
                      <span
                        className={styles.attendanceSwatch}
                        style={{ background: item.color }}
                        aria-hidden
                      />
                      <span className={styles.attendanceLegendLabel}>
                        {item.label}
                        {!item.countsTowardPercent ? (
                          <em> · not in %</em>
                        ) : null}
                      </span>
                      <strong className={styles.attendanceLegendCount}>
                        {item.count}
                      </strong>
                    </li>
                  ))}
                </ul>
              </div>
            </Shareable>

            <Shareable
              as="article"
              kind="view"
              href="/learner/attendance"
              title="Lessons attended vs missed"
              detail={`${attendedPercent}% attended · ${outcomeSlices.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(" · ")}`}
              area="Attendance"
              actionLabel="Open chart"
              className={styles.attendanceChartPanel}
            >
              <h3 className={styles.attendanceChartPanelTitle}>
                Lessons attended vs missed
              </h3>
              <div className={styles.attendanceChartBody}>
                <div
                  className={styles.attendancePie}
                  style={{ background: outcomePieBackground }}
                  role="img"
                  aria-label={`Attended versus missed: ${attendedPercent}% attended`}
                >
                  <div
                    className={styles.attendancePieHole}
                    data-tone="split"
                  >
                    <strong>{attendedPercent}%</strong>
                    <span>Attended</span>
                  </div>
                </div>

                <ul className={styles.attendanceLegend}>
                  {outcomeSlices.map((item) => (
                    <li key={item.id} className={styles.attendanceLegendItem}>
                      <span
                        className={styles.attendanceSwatch}
                        style={{ background: item.color }}
                        aria-hidden
                      />
                      <span className={styles.attendanceLegendMain}>
                        <strong>{item.label}</strong>
                        <span>{item.hint}</span>
                      </span>
                      <strong className={styles.attendanceLegendCount}>
                        {item.count}
                      </strong>
                    </li>
                  ))}
                </ul>
              </div>
            </Shareable>

            <Shareable
              as="article"
              kind="view"
              href="/learner/attendance"
              title="Missed while you were away"
              detail={`${missedLearning.stillNeeded} still need catch-up`}
              area="Attendance"
              actionLabel="Open catch-up overview"
              className={`${styles.attendanceChartPanel} ${styles.attendanceMissedPanel}`}
            >
              <div className={styles.attendanceMissedHead}>
                <h3 className={styles.attendanceChartPanelTitle}>
                  Missed while you were away
                </h3>
                <p className={styles.attendanceMissedCopy}>
                  Modules, tasks and workshop slots from days you were not in
                  college — catch these up so you do not fall behind.
                </p>
              </div>

              <div className={styles.attendanceMissedBody}>
                <div className={styles.attendanceChartBody}>
                  <div
                    className={styles.attendancePie}
                    style={{ background: missedPieBackground }}
                    role="img"
                    aria-label={`Missed learning pie: ${missedLearning.stillNeeded} still need catch-up`}
                  >
                    <div
                      className={styles.attendancePieHole}
                      data-tone="missed"
                    >
                      <strong>{missedLearning.stillNeeded}</strong>
                      <span>To catch up</span>
                    </div>
                  </div>

                  <ul className={styles.attendanceLegend}>
                    {missedLearning.slices.map((item) => (
                      <li
                        key={item.kind}
                        className={styles.attendanceLegendItem}
                      >
                        <span
                          className={styles.attendanceSwatch}
                          style={{ background: item.color }}
                          aria-hidden
                        />
                        <span className={styles.attendanceLegendLabel}>
                          {item.label}
                        </span>
                        <strong className={styles.attendanceLegendCount}>
                          {item.count}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </div>

                <ul className={styles.attendanceMissedList}>
                  {missedLearning.items.map((item) => (
                    <Shareable
                      key={item.id}
                      as="li"
                      kind={
                        item.catchUpStatus === "done" ? "view" : "action"
                      }
                      href={item.href}
                      title={item.title}
                      detail={`${missedKindLabel(item.kind)}${item.moduleCode ? ` · ${item.moduleCode}` : ""} — ${item.detail}`}
                      area="Attendance catch-up"
                      actionLabel={
                        item.catchUpStatus === "done"
                          ? "Open item"
                          : "Open to catch up"
                      }
                    >
                      <Link
                        href={item.href}
                        className={styles.attendanceMissedLink}
                      >
                        <span className={styles.attendanceMissedLinkMain}>
                          <strong>{item.title}</strong>
                          <span>
                            {missedKindLabel(item.kind)}
                            {item.moduleCode ? ` · ${item.moduleCode}` : null}
                            {" — "}
                            {item.detail}
                          </span>
                        </span>
                        <span className={styles.attendanceMissedLinkEnd}>
                          <LearnerStatusChip
                            tone={missedCatchUpTone(item.catchUpStatus)}
                          >
                            {missedCatchUpLabel(item.catchUpStatus)}
                          </LearnerStatusChip>
                          <span className={styles.linkish}>Open →</span>
                        </span>
                      </Link>
                    </Shareable>
                  ))}
                </ul>
              </div>
            </Shareable>
          </div>
        </section>

        <section className={styles.attendanceDayStub}>
          <button
            type="button"
            className={styles.attendanceDayStubToggle}
            aria-expanded={daysOpen}
            onClick={() => setDaysOpen((open) => !open)}
          >
            <span className={styles.attendanceDayStubMain}>
              <strong>Recent college days</strong>
              <span>
                {ALEX_ATTENDANCE_DAYS.length} sessions · tap a day for notes
              </span>
            </span>
            <span className={styles.attendanceDayStubHint}>
              {daysOpen ? "Hide" : "Show"}
              <span aria-hidden>{daysOpen ? "▾" : "▸"}</span>
            </span>
          </button>

          {daysOpen ? (
            <div className={styles.attendanceDayCard}>
              <div className={styles.attendanceToolbar}>
                <label className={styles.attendanceSearchField}>
                  <span>Search dates</span>
                  <input
                    type="search"
                    value={dateQuery}
                    onChange={(event) => {
                      setDateQuery(event.target.value);
                      setExpandedKey(null);
                    }}
                    placeholder="e.g. 14 Jul, 2026-07-14, Monday…"
                    aria-label="Search college days by date"
                  />
                </label>

                <div className={styles.attendancePresetBlock}>
                  <p className={styles.attendancePresetLabel}>Quick filters</p>
                  <div
                    className={styles.attendancePresetRow}
                    role="group"
                    aria-label="Filter by attendance outcome"
                  >
                    <button
                      type="button"
                      className={
                        statusFilter === "all"
                          ? styles.attendancePresetActive
                          : styles.attendancePreset
                      }
                      data-tone="all"
                      aria-pressed={statusFilter === "all"}
                      onClick={() => {
                        setStatusFilter("all");
                        setExpandedKey(null);
                      }}
                    >
                      All ({presetCounts.all})
                    </button>
                    {filterOptions.map((item) => (
                      <button
                        key={item.status}
                        type="button"
                        className={
                          statusFilter === item.status
                            ? styles.attendancePresetActive
                            : styles.attendancePreset
                        }
                        data-tone={tone(item.status)}
                        aria-pressed={statusFilter === item.status}
                        onClick={() => {
                          setStatusFilter(item.status);
                          setExpandedKey(null);
                        }}
                      >
                        {shortPresetLabel(item.status)} ({presetCounts[item.status]})
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className={styles.attendanceResultHint}>
                Showing {filteredDays.length} of {ALEX_ATTENDANCE_DAYS.length}{" "}
                sessions
                {statusFilter !== "all"
                  ? ` · ${shortPresetLabel(statusFilter)}`
                  : null}
                {dateQuery.trim() ? ` · “${dateQuery.trim()}”` : null}
              </p>

              {filteredDays.length === 0 ? (
                <p className={styles.empty}>
                  No college days match this search or filter.
                </p>
              ) : (
                <ul className={styles.attendanceDayList}>
                  {filteredDays.map((day) => {
                    const key = dayKey(day);
                    const open = expandedKey === key;
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          className={styles.attendanceDayToggle}
                          data-tone={tone(day.status)}
                          data-open={open ? "true" : "false"}
                          aria-expanded={open}
                          onClick={() =>
                            setExpandedKey((current) =>
                              current === key ? null : key,
                            )
                          }
                        >
                          <span
                            className={styles.attendanceDayMark}
                            aria-hidden
                          />
                          <span className={styles.attendanceDayMain}>
                            <strong>
                              {day.dayName} · {formatDate(day.date)}
                            </strong>
                            <span>{day.session}</span>
                          </span>
                          <span className={styles.attendanceDayMeta}>
                            <LearnerStatusChip tone={tone(day.status)}>
                              {label(day.status)}
                            </LearnerStatusChip>
                            <span
                              className={styles.attendanceChevron}
                              aria-hidden
                            >
                              {open ? "▾" : "▸"}
                            </span>
                          </span>
                        </button>
                        {open ? (
                          <div
                            className={styles.attendanceDayPanel}
                            data-tone={tone(day.status)}
                          >
                            <p className={styles.attendanceDayNote}>
                              {day.note ?? "No extra notes for this session."}
                            </p>
                            {day.missedItems && day.missedItems.length > 0 ? (
                              <div className={styles.attendanceDayMissed}>
                                <p className={styles.attendanceDayMissedTitle}>
                                  What you missed this day
                                </p>
                                <ul className={styles.attendanceDayMissedList}>
                                  {day.missedItems.map((item) => (
                                    <li key={item.id}>
                                      <Link
                                        href={item.href}
                                        className={styles.attendanceDayMissedLink}
                                      >
                                        <span>
                                          <strong>{item.title}</strong>
                                          <span>
                                            {missedKindLabel(item.kind)}
                                            {item.moduleCode
                                              ? ` · ${item.moduleCode}`
                                              : null}
                                          </span>
                                        </span>
                                        <LearnerStatusChip
                                          tone={missedCatchUpTone(
                                            item.catchUpStatus,
                                          )}
                                        >
                                          {missedCatchUpLabel(item.catchUpStatus)}
                                        </LearnerStatusChip>
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </LearnerPageShell>
  );
}
