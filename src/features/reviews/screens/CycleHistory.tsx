"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apprenticeLearnerPath } from "@/features/administration/domain/apprentice-tutor";
import { coverageTone, percent, type AnalyticsFilters, type Pace, type Urgency } from "../domain/analytics";
import type { loadAnalytics } from "../domain/analytics-repository";
import styles from "./analytics.module.css";

type Row = Awaited<ReturnType<typeof loadAnalytics>>["page"]["history"][number];

function href(workspace: "administration" | "management", filters: AnalyticsFilters, view: string, cycle: number) {
  const params = new URLSearchParams();
  params.set("cycle", String(cycle));
  if (filters.tutorId !== "all") params.set("tutor", filters.tutorId);
  if (filters.programmeId !== "all") params.set("programme", filters.programmeId);
  if (filters.employerId !== "all") params.set("employer", filters.employerId);
  if (view !== "reviews") params.set("view", view);
  return `/${workspace}/reviews/analytics?${params.toString()}`;
}

function paceText(pace: Pace): string {
  if (pace === "on-pace") return "On pace";
  if (pace === "slightly-behind") return "Slightly behind";
  return "Behind";
}

function barTone(row: Row): Urgency {
  if (row.current) {
    if (row.pace === "slightly-behind") return "amber";
    if (row.pace === "behind") return "red";
    return "green";
  }
  return coverageTone(row.coverage);
}

function textTone(tone: Urgency) {
  if (tone === "red") return styles.redText;
  if (tone === "amber") return styles.amberText;
  if (tone === "green") return styles.greenText;
  return undefined;
}

function paceChip(row: Row) {
  if (row.current && row.pace) {
    const tone = barTone(row);
    return <span className={`${styles.chip} ${toneClass(tone)}`}>{paceText(row.pace)}</span>;
  }
  if (row.missed == null) return "—";
  if (row.missed === 0) return <span className={`${styles.chip} ${styles.green}`}>Complete</span>;
  const tone = coverageTone(row.coverage);
  return <span className={`${styles.chip} ${toneClass(tone)}`}>Short by {row.missed}</span>;
}

function toneClass(tone: Urgency) {
  if (tone === "red") return styles.red;
  if (tone === "amber") return styles.amber;
  if (tone === "green") return styles.green;
  return styles.neutral;
}

export function CycleHistory({
  workspace,
  filters,
  view,
  rows,
}: {
  workspace: "administration" | "management";
  filters: AnalyticsFilters;
  view: string;
  rows: Row[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  if (!rows.length) return null;
  return (
    <div className={styles.history}>
      <h3>Cycle history</h3>
      <div className={`${styles.cycleRow} ${styles.cycleHead}`}>
        <span>Cycle</span><span>Due</span><span>Reviewed</span><span>Coverage</span><span>Missed</span><span>Pace</span><span>Release to completed</span><span>Visits / calls / Teams</span>
      </div>
      {rows.map((row) => {
        const expanded = open === row.number;
        const destination = href(workspace, filters, view, row.number);
        return (
          <div key={row.number}>
            <div
              className={filters.cycle === row.number ? `${styles.cycleRow} ${styles.cycleOn}` : styles.cycleRow}
              role="link"
              tabIndex={0}
              onClick={() => router.push(destination)}
              onKeyDown={(event) => {
                if (event.key === "Enter") router.push(destination);
              }}
            >
              <span><strong>Cycle {row.number}</strong>{row.current ? " · In progress" : ""}<small>{row.dates}</small></span>
              <span>{row.due}</span>
              <span>{row.reviewed}</span>
              <span className={styles.coverageCell}>
                <span className={styles.track}><i className={toneClass(barTone(row))} style={{ width: `${row.coverage ? Math.round(row.coverage * 100) : 0}%` }} /></span>
                <span className={textTone(barTone(row))}>{percent(row.coverage)}</span>
              </span>
              <span>
                {row.missed == null ? "—" : (
                  <button
                    type="button"
                    className={styles.missedButton}
                    aria-expanded={expanded}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpen(expanded ? null : row.number);
                    }}
                  >
                    {row.missed}
                    <span aria-hidden="true">{expanded ? "▾" : "›"}</span>
                  </button>
                )}
              </span>
              <span>{paceChip(row)}</span>
              <span>{row.releaseToCompleted == null ? "—" : `${row.releaseToCompleted}d`}</span>
              <span>{row.visits} / {row.calls} / {row.teams}</span>
            </div>
            {expanded ? <MissedPanel workspace={workspace} row={row} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function MissedPanel({ workspace, row }: { workspace: "administration" | "management"; row: Row }) {
  return (
    <div className={styles.missedPanel}>
      <h4>By tutor</h4>
      {row.byTutor.length === 0 ? <p className={styles.muted}>No missed learners.</p> : (
        <div className={styles.tutorSummary}>
          {row.byTutor.map((tutor) => (
            <span key={tutor.name}>{tutor.name} <strong>{tutor.count}</strong></span>
          ))}
        </div>
      )}
      {row.missedLearners.length === 0 ? null : (
        <div className={styles.missedList}>
          <div className={`${styles.missedPerson} ${styles.cycleHead}`}><span>Learner</span><span>GTA ID</span><span>Tutor</span><span>Employer</span></div>
          {row.missedLearners.map((learner) => (
            <div key={learner.gtaId} className={styles.missedPerson}>
              <Link href={apprenticeLearnerPath(workspace, learner.gtaId)}>{learner.name}</Link>
              <span>{learner.gtaId}</span>
              <span>{learner.tutor}</span>
              <span>{learner.employer}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
