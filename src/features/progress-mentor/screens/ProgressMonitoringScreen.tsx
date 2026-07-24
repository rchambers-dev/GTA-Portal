"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MENTOR_LEARNERS } from "../data/mentor-caseload";
import {
  MentorPageShell,
  StatusChip,
} from "../components/MentorWorkQueue";
import {
  buildProgressLearnerViews,
  learnerOpenHref,
  nextActionHref,
  priorityBandLabel,
  priorityBandTone,
  sortByOperationalPriority,
  type PriorityBand,
  type PriorityReason,
  type ProgressLearnerView,
} from "../lib/priority-score";
import styles from "./ProgressMonitoringScreen.module.css";

type Props = {
  filters: Record<string, string | undefined>;
  /** Effective permissions of the signed-in user; gates actionable reason links. */
  permissions?: string[];
};

const REASON_TONE_CLASS: Record<PriorityReason["tone"], string> = {
  critical: styles.reasonCritical,
  warning: styles.reasonWarning,
  info: styles.reasonInfo,
  positive: styles.reasonPositive,
};

type SortKey = "priority" | "variance" | "attendance" | "name" | "review";

const SAVED_VIEWS: { id: string; label: string }[] = [
  { id: "priority", label: "My Priority Queue" },
  { id: "behind", label: "Behind Plan" },
  { id: "overdue", label: "Programme Overdue" },
  { id: "attendance", label: "Attendance Risk" },
  { id: "evidence", label: "Missing Evidence" },
  { id: "epa", label: "EPA Soon" },
  { id: "concerns", label: "Employer Concerns" },
  { id: "no-intervention", label: "No Intervention" },
  { id: "ready-review", label: "Ready for Review" },
  { id: "completed", label: "Completed" },
];

function hrefWith(
  base: Record<string, string | undefined>,
  patch: Record<string, string | null>,
): string {
  const params = new URLSearchParams();
  const merged = { ...base, ...patch };
  for (const [key, value] of Object.entries(merged)) {
    if (value != null && value !== "") params.set(key, value);
  }
  const qs = params.toString();
  return qs
    ? `/workspaces/progress-mentor/progress-monitoring?${qs}`
    : "/workspaces/progress-mentor/progress-monitoring";
}

function reviewLabel(status: ProgressLearnerView["reviewStatus"]): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "preparation":
      return "Prep needed";
    case "awaiting_employer":
      return "Awaiting employer";
    case "overdue":
      return "Overdue";
    case "completed":
      return "Completed";
    default:
      return "—";
  }
}

function reviewTone(
  status: ProgressLearnerView["reviewStatus"],
): "green" | "amber" | "red" | "orange" | "blue" | "neutral" {
  switch (status) {
    case "ready":
      return "green";
    case "preparation":
      return "amber";
    case "awaiting_employer":
      return "blue";
    case "overdue":
      return "red";
    case "completed":
      return "neutral";
    default:
      return "neutral";
  }
}

/** Traffic-light tone for progress variance direction. */
function varianceDirectionTone(
  variance: number,
): "green" | "amber" | "red" | "neutral" {
  if (variance > 0) return "green";
  if (variance === 0) return "neutral";
  if (variance > -10) return "amber";
  return "red";
}

/**
 * Traffic-light tone for attendance: green rising, amber starting to slip,
 * red clearly falling or critically low.
 */
function attendanceDirectionTone(
  percent: number | null,
  trend: ProgressLearnerView["attendanceTrend"],
): "green" | "amber" | "red" | "neutral" {
  if (percent == null) return "neutral";
  if (percent < 70) return "red";
  if (trend === "rising") return "green";
  if (trend === "falling") {
    if (percent < 85) return "red";
    return "amber";
  }
  if (trend === "stable") {
    if (percent >= 90) return "green";
    if (percent >= 85) return "amber";
    return "red";
  }
  if (percent >= 90) return "green";
  if (percent >= 85) return "amber";
  return "red";
}

function directionToneClass(
  tone: "green" | "amber" | "red" | "neutral",
): string {
  switch (tone) {
    case "green":
      return styles.toneGreen;
    case "amber":
      return styles.toneAmber;
    case "red":
      return styles.toneRed;
    default:
      return styles.toneNeutral;
  }
}

function interventionTone(
  status: string | null,
): "green" | "amber" | "red" | "orange" | "blue" | "neutral" {
  if (!status) return "neutral";
  if (status === "escalated") return "red";
  if (status === "due_checkpoint") return "orange";
  if (status === "improving") return "green";
  if (status === "active") return "amber";
  return "neutral";
}

function interventionLabel(row: ProgressLearnerView): string {
  if (!row.learner.interventionType) return "None";
  const type = row.learner.interventionType
    .replace(" recovery", "")
    .replace(" improvement", "")
    .replace("Programme-overdue", "Overdue");
  if (!row.interventionStatus) return type;
  const status =
    row.interventionStatus === "due_checkpoint"
      ? "Checkpoint due"
      : row.interventionStatus === "escalated"
        ? "Escalated"
        : row.interventionStatus === "improving"
          ? "Improving"
          : row.interventionStatus === "active"
            ? "Active"
            : row.interventionStatus.replace(/_/g, " ");
  return `${type} · ${status}`;
}

export function ProgressMonitoringScreen({ filters, permissions = [] }: Props) {
  const router = useRouter();
  const canAction = useMemo(
    () => (permission?: string) =>
      !permission || permissions.includes(permission),
    [permissions],
  );
  const fromLifecycle = filters.from === "lifecycle";
  const activeView = filters.view ?? "priority";
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("priority");

  const patchFilters = (patch: Record<string, string | null>) => {
    router.push(hrefWith(filters, patch));
  };

  const allViews = useMemo(
    () => buildProgressLearnerViews(MENTOR_LEARNERS),
    [],
  );

  const summary = useMemo(() => {
    const active = allViews.filter((r) => r.learner.status !== "completed");
    return {
      critical: active.filter((r) => r.priorityBand === "critical").length,
      high: active.filter((r) => r.priorityBand === "high").length,
      overdue: active.filter((r) => r.learner.programmeOverdue).length,
      behind: active.filter((r) => r.variance < -5).length,
      reviewsOverdue: active.filter((r) => r.reviewStatus === "overdue").length,
      missingEvidence: active.filter(
        (r) => r.learner.missingMandatoryEvidence > 0,
      ).length,
      attendanceRisk: active.filter(
        (r) =>
          r.learner.attendancePercent != null &&
          r.learner.attendancePercent < 85,
      ).length,
    };
  }, [allViews]);

  const rows = useMemo(() => {
    let list = [...allViews];

    // Saved views / lifecycle deep-links
    if (filters.status === "active" || activeView !== "completed") {
      if (activeView === "completed") {
        list = list.filter((r) => r.learner.status === "completed");
      } else {
        list = list.filter((r) => r.learner.status !== "completed");
      }
    }

    if (filters.card === "critical" || activeView === "priority") {
      // priority view keeps all active; card critical narrows
    }
    if (filters.card === "critical") {
      list = list.filter((r) => r.priorityBand === "critical");
    }
    if (filters.card === "high") {
      list = list.filter((r) => r.priorityBand === "high");
    }
    if (
      filters.card === "overdue" ||
      filters.programmeStatus === "overdue" ||
      activeView === "overdue"
    ) {
      list = list.filter((r) => r.learner.programmeOverdue);
    }
    if (filters.card === "behind" || activeView === "behind") {
      list = list.filter((r) => r.variance < -5);
    }
    if (filters.card === "reviews" || activeView === "ready-review") {
      if (activeView === "ready-review") {
        list = list.filter(
          (r) =>
            r.reviewStatus === "ready" || r.reviewStatus === "preparation",
        );
      } else if (filters.card === "reviews") {
        list = list.filter((r) => r.reviewStatus === "overdue");
      }
    }
    if (
      filters.card === "evidence" ||
      filters.evidence === "missing-mandatory" ||
      activeView === "evidence"
    ) {
      list = list.filter((r) => r.learner.missingMandatoryEvidence > 0);
    }
    if (filters.card === "attendance" || activeView === "attendance") {
      list = list.filter(
        (r) =>
          r.learner.attendancePercent != null &&
          r.learner.attendancePercent < 85,
      );
    }
    if (activeView === "epa") {
      list = list.filter((r) => r.learner.epaApproaching);
    }
    if (activeView === "concerns") {
      list = list.filter((r) => r.learner.employerConcernStatus !== "none");
    }
    if (activeView === "no-intervention") {
      list = list.filter(
        (r) =>
          !r.learner.interventionId &&
          (r.variance <= -5 || r.learner.programmeOverdue),
      );
    }

    if (filters.year) {
      list = list.filter(
        (r) => String(r.learner.programmeYear) === filters.year,
      );
    }
    if (filters.risk) {
      list = list.filter((r) => r.learner.riskStatus === filters.risk);
    }
    if (filters.band) {
      list = list.filter((r) => r.priorityBand === filters.band);
    }
    if (filters.programme) {
      list = list.filter((r) => r.learner.programmeId === filters.programme);
    }
    if (filters.employer) {
      list = list.filter((r) => r.learner.employerId === filters.employer);
    }
    if (filters.tutor) {
      list = list.filter((r) => r.learner.tutorName === filters.tutor);
    }
    if (filters.activeOnly === "1") {
      list = list.filter((r) => r.learner.status === "active");
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.learner.displayName.toLowerCase().includes(q) ||
          r.learner.employerName.toLowerCase().includes(q) ||
          r.learner.programmeName.toLowerCase().includes(q) ||
          r.learner.tutorName.toLowerCase().includes(q),
      );
    }

    if (sortKey === "priority" || filters.sort === "most-overdue") {
      list = sortByOperationalPriority(list);
    } else if (sortKey === "variance") {
      list = [...list].sort((a, b) => a.variance - b.variance);
    } else if (sortKey === "attendance") {
      list = [...list].sort(
        (a, b) =>
          (a.learner.attendancePercent ?? 999) -
          (b.learner.attendancePercent ?? 999),
      );
    } else if (sortKey === "name") {
      list = [...list].sort((a, b) =>
        a.learner.displayName.localeCompare(b.learner.displayName),
      );
    } else if (sortKey === "review") {
      list = [...list].sort((a, b) => {
        const rank = (s: ProgressLearnerView["reviewStatus"]) =>
          s === "overdue"
            ? 0
            : s === "preparation"
              ? 1
              : s === "awaiting_employer"
                ? 2
                : s === "ready"
                  ? 3
                  : 4;
        return rank(a.reviewStatus) - rank(b.reviewStatus);
      });
    }

    return list;
  }, [allViews, filters, activeView, search, sortKey]);

  const attentionQueue = useMemo(() => {
    return sortByOperationalPriority(
      allViews.filter(
        (r) =>
          r.learner.status !== "completed" &&
          (r.priorityBand === "critical" || r.priorityBand === "high"),
      ),
    ).slice(0, 8);
  }, [allViews]);

  const programmes = useMemo(
    () =>
      Array.from(
        new Map(
          MENTOR_LEARNERS.map((l) => [l.programmeId, l.programmeName]),
        ).entries(),
      ),
    [],
  );
  const employers = useMemo(
    () =>
      Array.from(
        new Map(
          MENTOR_LEARNERS.map((l) => [l.employerId, l.employerName]),
        ).entries(),
      ),
    [],
  );
  const tutors = useMemo(
    () =>
      Array.from(new Set(MENTOR_LEARNERS.map((l) => l.tutorName))).sort(),
    [],
  );

  const cardFilters = [
    {
      id: "critical",
      label: "Critical learners",
      value: summary.critical,
      tone: "red" as const,
      href: hrefWith(filters, { card: "critical", view: null }),
    },
    {
      id: "high",
      label: "High priority",
      value: summary.high,
      tone: "orange" as const,
      href: hrefWith(filters, { card: "high", view: null }),
    },
    {
      id: "overdue",
      label: "Programme overdue",
      value: summary.overdue,
      tone: "red" as const,
      href: hrefWith(filters, { card: "overdue", view: null }),
    },
    {
      id: "behind",
      label: "Behind planned progress",
      value: summary.behind,
      tone: "amber" as const,
      href: hrefWith(filters, { card: "behind", view: null }),
    },
    {
      id: "reviews",
      label: "Reviews overdue",
      value: summary.reviewsOverdue,
      tone: "orange" as const,
      href: hrefWith(filters, { card: "reviews", view: null }),
    },
    {
      id: "evidence",
      label: "Missing evidence",
      value: summary.missingEvidence,
      tone: "amber" as const,
      href: hrefWith(filters, { card: "evidence", view: null }),
    },
    {
      id: "attendance",
      label: "Attendance below threshold",
      value: summary.attendanceRisk,
      tone: "orange" as const,
      href: hrefWith(filters, { card: "attendance", view: null }),
    },
  ];

  return (
    <MentorPageShell
      eyebrow="Progress Mentor · Progress Monitoring"
      title="Progress Monitoring"
      description="Operational command centre — who needs attention first, why, and what to do next."
      fromLifecycle={fromLifecycle}
    >
      <section className={styles.summaryGrid} aria-label="Operational summary">
        {cardFilters.map((card) => {
          const active = filters.card === card.id;
          return (
            <Link
              key={card.id}
              href={active ? hrefWith(filters, { card: null }) : card.href}
              className={`${styles.summaryCard} ${styles[`tone_${card.tone}`]} ${active ? styles.summaryCardActive : ""}`}
            >
              <strong>{card.value}</strong>
              <span>{card.label}</span>
            </Link>
          );
        })}
      </section>

      <section className={styles.queueSection} aria-label="Priority queue">
        <div className={styles.queueHeader}>
          <div>
            <h2 className={styles.sectionTitle}>
              Learners requiring immediate attention
            </h2>
            <p className={styles.sectionCopy}>
              Top priority learners by operational score — worst first.
            </p>
          </div>
          <Link
            href={hrefWith(filters, { card: null, view: "priority" })}
            className={styles.clearLink}
          >
            View full priority list
          </Link>
        </div>
        <div className={styles.queueGrid}>
          {attentionQueue.map((row) => (
            <article
              key={row.learner.learnerId}
              className={`${styles.queueCard} ${styles[`band_${row.priorityBand}`]}`}
            >
              <header className={styles.queueCardHeader}>
                <div className={styles.queueIdentity}>
                  <h3>{row.learner.displayName}</h3>
                  <p className={styles.queueMeta}>
                    {row.programmeShort}
                    <span aria-hidden>·</span>
                    {row.learner.employerName}
                  </p>
                </div>
                <div className={styles.scoreBadge}>
                  <span className={styles.scoreValue}>{row.priorityScore}</span>
                  <span className={styles.scoreBand}>
                    {priorityBandLabel(row.priorityBand)}
                  </span>
                </div>
              </header>

              <div className={styles.reasonChips}>
                {row.reasons.map((reason) => {
                  const toneClass =
                    REASON_TONE_CLASS[reason.tone] ?? styles.reasonInfo;
                  const actionable = Boolean(
                    reason.href && canAction(reason.permission),
                  );
                  if (actionable && reason.href) {
                    return (
                      <Link
                        key={reason.label}
                        href={reason.href}
                        className={`${styles.reasonChip} ${toneClass} ${styles.reasonChipLink}`}
                        title={`Open to action: ${reason.label}`}
                      >
                        {reason.label}
                        <span aria-hidden className={styles.reasonChipArrow}>
                          →
                        </span>
                      </Link>
                    );
                  }
                  return (
                    <span
                      key={reason.label}
                      className={`${styles.reasonChip} ${toneClass}`}
                    >
                      {reason.label}
                    </span>
                  );
                })}
              </div>

              <div className={styles.queueFooter}>
                <p className={styles.recommended}>
                  Next: <strong>{row.nextActionLabel}</strong>
                </p>
                <div className={styles.queueActions}>
                  <Link
                    href={learnerOpenHref(row)}
                    className={styles.primaryAction}
                  >
                    Open learner
                  </Link>
                  <Link
                    href={nextActionHref(row)}
                    className={styles.secondaryAction}
                  >
                    {row.nextActionLabel}
                  </Link>
                  <Link
                    href={
                      row.learner.employerConcernStatus !== "none"
                        ? `/employer-concerns?from=progress-monitoring&learner=${row.learner.learnerId}`
                        : `/learners/${row.learner.learnerId}?tab=employer&from=progress-monitoring`
                    }
                    className={styles.secondaryAction}
                  >
                    {row.learner.employerConcernStatus !== "none"
                      ? "Concern"
                      : "Employer"}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.savedViews} role="tablist" aria-label="Saved views">
        {SAVED_VIEWS.map((view) => (
          <Link
            key={view.id}
            href={hrefWith(filters, {
              view: view.id,
              card: null,
              programmeStatus: null,
              evidence: null,
            })}
            className={
              activeView === view.id ? styles.savedViewActive : styles.savedView
            }
            role="tab"
            aria-selected={activeView === view.id}
          >
            {view.label}
          </Link>
        ))}
      </div>

      <div className={styles.filters}>
        <input
          className={styles.search}
          type="search"
          placeholder="Search learner, employer, programme…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.select}
          value={filters.year ?? "all"}
          onChange={(e) =>
            patchFilters({
              year: e.target.value === "all" ? null : e.target.value,
            })
          }
        >
          <option value="all">All years</option>
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
        </select>
        <select
          className={styles.select}
          value={filters.programme ?? "all"}
          onChange={(e) =>
            patchFilters({
              programme: e.target.value === "all" ? null : e.target.value,
            })
          }
        >
          <option value="all">All programmes</option>
          {programmes.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={filters.employer ?? "all"}
          onChange={(e) =>
            patchFilters({
              employer: e.target.value === "all" ? null : e.target.value,
            })
          }
        >
          <option value="all">All employers</option>
          {employers.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={filters.tutor ?? "all"}
          onChange={(e) =>
            patchFilters({
              tutor: e.target.value === "all" ? null : e.target.value,
            })
          }
        >
          <option value="all">All tutors</option>
          {tutors.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={filters.band ?? "all"}
          onChange={(e) =>
            patchFilters({
              band: e.target.value === "all" ? null : e.target.value,
            })
          }
        >
          <option value="all">All risk levels</option>
          {(
            [
              "critical",
              "high",
              "medium",
              "low",
              "on_track",
            ] as PriorityBand[]
          ).map((band) => (
            <option key={band} value={band}>
              {priorityBandLabel(band)}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="priority">Sort: Priority score</option>
          <option value="variance">Sort: Worst variance</option>
          <option value="attendance">Sort: Lowest attendance</option>
          <option value="review">Sort: Review urgency</option>
          <option value="name">Sort: Name</option>
        </select>
        <label className={styles.activeOnly}>
          <input
            type="checkbox"
            checked={filters.activeOnly === "1" || filters.status === "active"}
            onChange={(e) =>
              patchFilters({
                activeOnly: e.target.checked ? "1" : null,
                status: e.target.checked ? "active" : null,
              })
            }
          />
          Active only
        </label>
        {(filters.card ||
          filters.year ||
          filters.programme ||
          filters.employer ||
          filters.tutor ||
          filters.band ||
          filters.activeOnly) && (
          <Link
            href={hrefWith(
              { from: filters.from, view: activeView },
              {
                card: null,
                year: null,
                programme: null,
                employer: null,
                tutor: null,
                band: null,
                activeOnly: null,
                programmeStatus: null,
                evidence: null,
              },
            )}
            className={styles.clearLink}
          >
            Clear filters
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty} role="status">
          No learners match this filter.
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Priority</th>
                <th scope="col">Learner</th>
                <th scope="col">Risk</th>
                <th scope="col">Planned</th>
                <th scope="col">Actual</th>
                <th scope="col">Variance</th>
                <th scope="col">Attendance</th>
                <th scope="col">Review</th>
                <th scope="col">Intervention</th>
                <th scope="col">Next action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const l = row.learner;
                return (
                  <tr key={l.learnerId}>
                    <td>
                      <StatusChip tone={priorityBandTone(row.priorityBand)}>
                        {priorityBandLabel(row.priorityBand)} {row.priorityScore}
                      </StatusChip>
                    </td>
                    <td>
                      <div className={styles.learnerCell}>
                        <Link
                          className={styles.learnerLink}
                          href={learnerOpenHref(row)}
                        >
                          {l.displayName}
                        </Link>
                        <span
                          className={styles.programmeBadge}
                          title={l.programmeName}
                        >
                          {row.programmeShort}
                        </span>
                        {l.employerConcernStatus !== "none" ? (
                          <Link
                            href={`/employer-concerns?from=progress-monitoring&learner=${l.learnerId}`}
                            className={styles.concernIcon}
                            title={`Employer concern: ${l.employerConcernStatus}`}
                          >
                            ⚠
                          </Link>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <StatusChip tone={priorityBandTone(row.priorityBand)}>
                        {priorityBandLabel(row.priorityBand)}
                      </StatusChip>
                    </td>
                    <td>
                      <div className={styles.progressMeter}>
                        <strong className={styles.toneNeutral}>
                          {l.plannedProgressPercent}%
                        </strong>
                        <div
                          className={styles.progressTrack}
                          role="img"
                          aria-label={`Planned progress ${l.plannedProgressPercent}%`}
                        >
                          <span
                            className={styles.progressFillPlanned}
                            style={{
                              width: `${Math.min(100, Math.max(0, l.plannedProgressPercent))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.progressMeter}>
                        <strong
                          className={directionToneClass(
                            varianceDirectionTone(row.variance),
                          )}
                        >
                          {l.actualProgressPercent}%
                        </strong>
                        <div
                          className={styles.progressTrack}
                          role="img"
                          aria-label={`Actual progress ${l.actualProgressPercent}%`}
                        >
                          <span
                            className={
                              row.variance <= -10
                                ? styles.progressFillCritical
                                : row.variance < 0
                                  ? styles.progressFillBehind
                                  : row.variance > 0
                                    ? styles.progressFillAhead
                                    : styles.progressFillOnPlan
                            }
                            style={{
                              width: `${Math.min(100, Math.max(0, l.actualProgressPercent))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div
                        className={`${styles.directionCell} ${directionToneClass(varianceDirectionTone(row.variance))}`}
                      >
                        <strong>
                          {row.variance > 0 ? `+${row.variance}` : row.variance}%
                        </strong>
                        <span>
                          {row.variance < 0
                            ? "▼ Behind"
                            : row.variance > 0
                              ? "▲ Ahead"
                              : "On plan"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/learners/${l.learnerId}?tab=attendance&from=progress-monitoring`}
                        className={`${styles.directionCell} ${styles.attendanceLink} ${directionToneClass(
                          attendanceDirectionTone(
                            l.attendancePercent,
                            row.attendanceTrend,
                          ),
                        )}`}
                      >
                        <strong>
                          {l.attendancePercent != null
                            ? `${l.attendancePercent}%`
                            : "—"}
                        </strong>
                        <span>
                          {row.attendanceTrend === "falling"
                            ? "↓ Falling"
                            : row.attendanceTrend === "rising"
                              ? "↑ Rising"
                              : row.attendanceTrend === "stable"
                                ? "→ Stable"
                                : "No trend"}
                        </span>
                      </Link>
                    </td>
                    <td>
                      {row.reviewStatus === "none" ? (
                        "—"
                      ) : (
                        <Link
                          href={
                            row.reviewId
                              ? `/reviews/${row.reviewId}?from=progress-monitoring`
                              : `/learners/${l.learnerId}?tab=reviews&from=progress-monitoring`
                          }
                        >
                          <StatusChip tone={reviewTone(row.reviewStatus)}>
                            {reviewLabel(row.reviewStatus)}
                          </StatusChip>
                        </Link>
                      )}
                    </td>
                    <td>
                      {row.interventionId ? (
                        <Link
                          href={`/interventions/${row.interventionId}?from=progress-monitoring`}
                        >
                          <StatusChip
                            tone={interventionTone(row.interventionStatus)}
                          >
                            {interventionLabel(row)}
                          </StatusChip>
                        </Link>
                      ) : (
                        <StatusChip tone="neutral">None</StatusChip>
                      )}
                    </td>
                    <td>
                      <Link
                        href={nextActionHref(row)}
                        className={styles.nextAction}
                      >
                        {row.nextActionLabel}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </MentorPageShell>
  );
}
