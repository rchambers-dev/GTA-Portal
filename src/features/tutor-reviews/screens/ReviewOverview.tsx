"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { EmailAttemptRow, ReportCard, TrackerRow, TutorReviewRound } from "../domain/repository";
import { roundKpis, roundSchedule, tutorResponseRates } from "../domain/dashboard";
import { londonToday } from "../domain/email";
import { TestLinkPanel } from "./EmailPanel";
import styles from "./tutor-reviews.module.css";

export function ReviewOverview({
  round,
  rounds,
  onSelect,
  toolbar,
  testPath,
  tracker,
  reports,
  concernCount,
  attempts,
  tutors,
  onOpenEmail,
  onEditQuestions,
}: {
  round: TutorReviewRound;
  rounds: TutorReviewRound[];
  onSelect: (id: string) => void;
  toolbar: ReactNode;
  testPath: string | null;
  tracker: TrackerRow[];
  reports: ReportCard[];
  concernCount: number;
  attempts: EmailAttemptRow[];
  tutors: { id: string; name: string }[];
  onOpenEmail: () => void;
  onEditQuestions: () => void;
}) {
  const today = londonToday();
  const schedule = roundSchedule(round.opensOn, round.closesOn, today);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "submitted" | "waiting" | "no-email">("all");
  const [showAll, setShowAll] = useState(false);
  const failed = attempts.filter((attempt) => attempt.status === "failed" || attempt.status === "bounced").length;
  const figures = roundKpis({
    people: tracker.map((row) => ({ tutorName: row.tutorName, invited: row.invited, submitted: row.submitted, email: row.email })),
    failedEmails: failed,
    concerns: concernCount,
  });
  const rates = tutorResponseRates(
    tracker.map((row) => ({ tutorName: row.tutorName, invited: row.invited, submitted: row.submitted, email: row.email })),
    tutors.map((tutor) => tutor.name),
  );
  const scoreRows = (tutors.length ? tutors : reports.map((report) => ({ id: report.tutorId, name: report.tutorName }))).map((tutor) => {
    const report = reports.find((item) => item.tutorId === tutor.id);
    return {
      tutorId: tutor.id,
      tutorName: tutor.name,
      responseCount: report?.responseCount ?? 0,
      hidden: report?.hidden !== false,
      previousLabel: report?.previousLabel ?? null,
    };
  });
  const filtered = useMemo(() => tracker.filter((row) => {
    const haystack = `${row.apprenticeId} ${row.name} ${row.tutorName}`.toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (filter === "submitted") return row.submitted;
    if (filter === "waiting") return !row.submitted;
    if (filter === "no-email") return !row.email?.trim();
    return true;
  }), [tracker, query, filter]);
  const visible = showAll ? filtered : filtered.slice(0, 6);

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.headerRow}>
          <h2 className={styles.roundTitle}>{round.label}</h2>
          <div className={styles.pills}>
            {rounds.map((item) => (
              <button key={item.id} type="button" className={item.id === round.id ? styles.pillOn : styles.pillButton} onClick={() => onSelect(item.id)}>{item.label}</button>
            ))}
          </div>
        </div>
        <p className={styles.statusLine}>
          <span className={styles.statusBadge}>{round.status}</span>
          <span>{schedule.range}</span>
          <span>
            {schedule.count == null ? schedule.suffix : <><strong>{schedule.count} {schedule.count === 1 ? "day" : "days"}</strong> {schedule.suffix}</>}
          </span>
        </p>
        <div className={styles.toolbar}>
          {toolbar}
          <a className={styles.secondary} href={`/tutor-review/preview/${round.id}`}>Preview form</a>
          <button type="button" className={styles.secondary} onClick={onEditQuestions}>Edit questions</button>
        </div>
        <div className={styles.testStrip}>
          <TestLinkPanel roundId={round.id} path={testPath} />
        </div>
      </section>

      <div className={styles.kpis}>
        <Kpi label="Invited" value={String(figures.invited)} detail={`of ${tracker.length} apprentices`} />
        <Kpi label="Submitted" value={String(figures.submitted)} detail="unique responses" />
        <Kpi label="Response rate" value={figures.responseRate == null ? "0%" : `${figures.responseRate}%`} detail={`${figures.submitted} of ${figures.invited} invited`} />
        <Kpi label="No email" value={String(figures.noEmail)} detail="need an address adding" tone={figures.noEmail > 0 ? "amber" : undefined} />
        <Kpi label="Failed emails" value={String(figures.failedEmails)} detail="bounced or rejected" tone={figures.failedEmails > 0 ? "red" : undefined} />
        <Kpi label="Concerns to read" value={String(concernCount)} detail="written answers flagged" tone={concernCount > 0 ? "red" : undefined} />
      </div>

      <div className={styles.dashGrid}>
        <section className={styles.card}>
          <h3>Response rate by tutor</h3>
          {rates.length ? rates.map((row) => (
            <div key={row.tutorName} className={styles.barRow}>
              <span>{row.tutorName}</span>
              <div className={styles.barTrack}><span style={{ width: `${row.rate}%` }} /></div>
              <strong>{row.rate}%</strong>
            </div>
          )) : <p className={styles.muted}>No active tutors yet.</p>}
        </section>
        <section className={styles.card}>
          <h3>Tutor scores</h3>
          <p className={styles.muted}>Averages and Yes percentages stay hidden until a tutor has 3 responses.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Tutor</th><th>N</th><th>Average</th><th>Profile</th><th>Vs previous</th></tr></thead>
              <tbody>
                {scoreRows.length ? scoreRows.map((row) => (
                  <tr key={row.tutorId}>
                    <td>{row.tutorName}</td>
                    <td>{row.responseCount}</td>
                    <td colSpan={3}>{row.hidden ? "Hidden until 3 responses" : row.previousLabel ?? "—"}</td>
                  </tr>
                )) : <tr><td colSpan={5}>No active tutors yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className={styles.card}>
          <h3>Needs attention</h3>
          <div className={styles.attention}>
            <button type="button" className={styles.attentionCard} onClick={onOpenEmail}>
              <span>Failed or bounced emails</span>
              <strong className={failed > 0 ? styles.toneRed : styles.toneMuted}>{failed}</strong>
            </button>
            <button type="button" className={styles.attentionCard} onClick={() => { setFilter("no-email"); setShowAll(false); }}>
              <span>No email on file</span>
              <strong className={figures.noEmail > 0 ? styles.toneAmber : styles.toneMuted}>{figures.noEmail}</strong>
            </button>
            <button type="button" className={styles.attentionCard} onClick={() => setFilter("all")}>
              <span>Concerns to read</span>
              <strong className={concernCount > 0 ? styles.toneRed : styles.toneMuted}>{concernCount}</strong>
            </button>
          </div>
        </section>
        <section className={styles.card}>
          <h3>Tracker</h3>
          <div className={styles.toolbar}>
            <input className={styles.search} value={query} onChange={(event) => { setQuery(event.target.value); setShowAll(false); }} placeholder="Search learners" aria-label="Search learners" />
            {([
              ["all", "All"],
              ["submitted", "Submitted"],
              ["waiting", "Not submitted"],
              ["no-email", "No email"],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" className={filter === id ? styles.pillOn : styles.pillButton} onClick={() => { setFilter(id); setShowAll(false); }}>{label}</button>
            ))}
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>ID</th><th>Learner</th><th>Tutor</th><th>Status</th><th>Last activity</th></tr></thead>
              <tbody>
                {visible.length ? visible.map((row) => (
                  <tr key={row.apprenticeId}>
                    <td>{row.apprenticeId}</td>
                    <td>{row.name}</td>
                    <td>{row.tutorName}</td>
                    <td><span className={statusClass(row)}>{statusText(row)}</span></td>
                    <td>{activity(row.updatedAt)}</td>
                  </tr>
                )) : <tr><td colSpan={5}>No apprentices match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
          {!showAll && filtered.length > visible.length ? (
            <button type="button" className={styles.linkButton} onClick={() => setShowAll(true)}>View all {filtered.length} apprentices</button>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "amber" | "red" }) {
  return (
    <article className={styles.kpi}>
      <p>{label}</p>
      <strong className={tone === "amber" ? styles.toneAmber : tone === "red" ? styles.toneRed : undefined}>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function statusText(row: TrackerRow) {
  if (!row.email?.trim()) return "No email";
  if (row.submitted) return "Submitted";
  if (row.invited) return "Not submitted";
  return "Not invited";
}

function statusClass(row: TrackerRow) {
  if (!row.email?.trim()) return styles.pillAmber;
  if (row.submitted) return styles.pillGreen;
  return styles.pillMuted;
}

function activity(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
