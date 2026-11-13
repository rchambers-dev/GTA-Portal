"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { ConcernItem, EmailAttemptRow, ReportCard, TrackerRow, TutorReviewRound } from "../domain/repository";
import { daysUntil, roundKpis, tutorResponseRates } from "../domain/dashboard";
import { londonToday } from "../domain/email";
import styles from "./tutor-reviews.module.css";

export function ReviewOverview({
  round,
  rounds,
  onSelect,
  actions,
  tracker,
  reports,
  concerns,
  attempts,
  onOpenEmail,
  onEditQuestions,
}: {
  round: TutorReviewRound;
  rounds: TutorReviewRound[];
  onSelect: (id: string) => void;
  actions: ReactNode;
  tracker: TrackerRow[];
  reports: ReportCard[];
  concerns: ConcernItem[];
  attempts: EmailAttemptRow[];
  onOpenEmail: () => void;
  onEditQuestions: () => void;
}) {
  const today = londonToday();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "submitted" | "waiting" | "no-email">("all");
  const [page, setPage] = useState(0);
  const failed = attempts.filter((attempt) => attempt.status === "failed" || attempt.status === "bounced");
  const figures = roundKpis({
    people: tracker.map((row) => ({ tutorName: row.tutorName, invited: row.invited, submitted: row.submitted, email: row.email })),
    failedEmails: failed.length,
    concerns: concerns.length,
  });
  const rates = tutorResponseRates(tracker.map((row) => ({ tutorName: row.tutorName, invited: row.invited, submitted: row.submitted, email: row.email })));
  const filtered = useMemo(() => tracker.filter((row) => {
    const haystack = `${row.name} ${row.tutorName} ${row.email ?? ""}`.toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (filter === "submitted") return row.submitted;
    if (filter === "waiting") return row.invited && !row.submitted;
    if (filter === "no-email") return row.invited && !row.email?.trim();
    return true;
  }), [tracker, query, filter]);
  const pageSize = 8;
  const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.pills}>
          {rounds.map((item) => (
            <button key={item.id} type="button" className={item.id === round.id ? styles.pillOn : styles.pillButton} onClick={() => onSelect(item.id)}>{item.label}</button>
          ))}
        </div>
        <h2>{round.label}</h2>
        <p className={styles.muted}>{round.status} · {round.opensOn} – {round.closesOn} · {daysUntil(today, round.opensOn, round.closesOn)}</p>
        <div className={styles.actions}>
          {actions}
          <a className={styles.secondary} href={`/tutor-review/preview/${round.id}`}>Preview form</a>
          <button type="button" className={styles.secondary} onClick={onEditQuestions}>Edit questions</button>
        </div>
      </section>
      <div className={styles.kpis}>
        <Kpi label="Invited" value={String(figures.invited)} />
        <Kpi label="Submitted" value={String(figures.submitted)} />
        <Kpi label="Response rate" value={figures.responseRate == null ? "—" : `${figures.responseRate}%`} />
        <Kpi label="No email" value={String(figures.noEmail)} />
        <Kpi label="Failed emails" value={String(figures.failedEmails)} />
        <Kpi label="Concerns to read" value={String(figures.concerns)} />
      </div>
      <section className={styles.card}>
        <h3>Response rate by tutor</h3>
        {rates.length ? rates.map((row) => (
          <div key={row.tutorName} className={styles.barRow}>
            <span>{row.tutorName}</span>
            <div className={styles.barTrack}><span style={{ width: `${row.rate}%` }} /></div>
            <strong>{row.rate}%</strong>
          </div>
        )) : <p className={styles.muted}>No invites for this round yet.</p>}
      </section>
      <section className={styles.card}>
        <h3>Tutor scores</h3>
        {reports.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Tutor</th><th>N</th><th>Ratings</th><th>Yes / No</th><th>Vs previous</th></tr></thead>
              <tbody>
                {reports.map((report) => {
                  const ratings = report.questions.filter((question) => question.kind === "rating_1_5" && question.average != null);
                  const yeses = report.questions.filter((question) => question.kind === "yes_no" && question.yesPercent != null);
                  const average = ratings.length ? ratings.reduce((sum, question) => sum + (question.average ?? 0), 0) / ratings.length : null;
                  const yes = yeses.length ? Math.round(yeses.reduce((sum, question) => sum + (question.yesPercent ?? 0), 0) / yeses.length) : null;
                  return (
                    <tr key={report.tutorId}>
                      <td>{report.tutorName}</td>
                      <td>{report.responseCount}</td>
                      <td>{report.hidden ? "Hidden until 3 responses" : average == null ? "—" : `${average.toFixed(1)} / 5`}</td>
                      <td>{report.hidden ? "—" : yes == null ? "—" : `${yes}% yes`}</td>
                      <td>{report.hidden || !report.previousLabel ? "—" : report.previousLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className={styles.muted}>No tutor scores yet. Averages appear after a tutor has at least 3 responses.</p>}
      </section>
      <section className={styles.card}>
        <h3>Needs attention</h3>
        {failed.length || figures.noEmail || concerns.length ? (
          <ul className={styles.counts}>
            {failed.length ? <li><button type="button" className={styles.linkButton} onClick={onOpenEmail}>{failed.length} failed or bounced {failed.length === 1 ? "email" : "emails"}</button></li> : null}
            {figures.noEmail ? <li><button type="button" className={styles.linkButton} onClick={() => { setFilter("no-email"); setPage(0); }}>{figures.noEmail} with no email address</button></li> : null}
            {concerns.map((item, index) => <li key={`${item.tutorName}-${index}`}><strong>{item.tutorName}</strong> — {item.text}</li>)}
          </ul>
        ) : <p className={styles.muted}>Nothing needs attention on this round.</p>}
      </section>
      <section className={styles.card}>
        <h3>Tracker</h3>
        <div className={styles.actions}>
          <input className={styles.search} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search learners" aria-label="Search learners" />
          {(["all", "submitted", "waiting", "no-email"] as const).map((item) => (
            <button key={item} type="button" className={filter === item ? styles.pillOn : styles.pillButton} onClick={() => { setFilter(item); setPage(0); }}>{item === "waiting" ? "Not submitted" : item === "no-email" ? "No email" : item === "all" ? "All" : "Submitted"}</button>
          ))}
        </div>
        {visible.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Learner</th><th>Tutor</th><th>Status</th></tr></thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.apprenticeId}>
                    <td>{row.name}</td>
                    <td>{row.tutorName}</td>
                    <td>{!row.email?.trim() && row.invited ? "No email" : row.submitted ? "Submitted" : row.invited ? "Not submitted" : "Not invited"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className={styles.muted}>No learners match this filter.</p>}
        {filtered.length > pageSize ? (
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</button>
            <button type="button" className={styles.secondary} disabled={(page + 1) * pageSize >= filtered.length} onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.kpi}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
