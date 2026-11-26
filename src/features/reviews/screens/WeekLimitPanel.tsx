"use client";

import { useState } from "react";
import { applyRebalanceAction, previewRebalanceAction, saveWeekLimitsAction } from "./week-limit-actions";
import styles from "./week-limit.module.css";

export type WeekBar = { week: string; before: number; after: number; excluded?: boolean; closed?: string | null };
export type WeekMove = { gtaId: string; name?: string; from: string; to: string; reason: string };
export type WeekPreview = { max?: number; weeks?: WeekBar[]; moves?: WeekMove[] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDay(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function weekLabel(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `w/c ${day} ${MONTHS[month - 1]}`;
}

function reasonLabel(reason: string): string {
  return reason === "closed_day" ? "Closed day" : "Weekly limit";
}

export function WeekLimitPanel({
  canWrite,
  initialPreview = null,
}: {
  canWrite: boolean;
  initialPreview?: WeekPreview | null;
}) {
  const [maxReviews, setMaxReviews] = useState(initialPreview?.max ?? 25);
  const [earliestWeeks, setEarliest] = useState(8);
  const [latestWeeks, setLatest] = useState(12);
  const [preview, setPreview] = useState<WeekPreview | null>(initialPreview);
  const [message, setMessage] = useState<string | null>(null);
  const limit = preview?.max ?? maxReviews;
  const weeks = preview?.weeks ?? [];
  const moves = preview?.moves ?? [];
  const earlier = moves.filter((move) => move.to < move.from).length;
  const later = moves.length - earlier;
  const over = weeks.filter((week) => week.before > limit).length;
  const closedWeeks = weeks.filter((week) => week.excluded).length;

  function download() {
    const lines = ["Learner,From,To,Reason", ...moves.map((move) => `${move.name || move.gtaId},${move.from},${move.to},${reasonLabel(move.reason)}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "review-rebalance.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <h2>Weekly review limit</h2>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!canWrite) return;
          void saveWeekLimitsAction({ max: maxReviews, earliestWeeks, latestWeeks }).then((result) => {
            setMessage(result.ok ? "Weekly limit saved." : result.formError || "The limit could not be saved.");
          });
        }}>
          <div className={styles.setting}>
            <label htmlFor="max-reviews">Most reviews planned in one week</label>
            <input id="max-reviews" type="number" min={1} value={maxReviews} onChange={(event) => setMaxReviews(Number(event.target.value))} />
          </div>
          <div className={styles.setting}>
            <label htmlFor="earliest-weeks">Earliest a review can move (weeks after the last review)</label>
            <input id="earliest-weeks" type="number" min={1} value={earliestWeeks} onChange={(event) => setEarliest(Number(event.target.value))} />
          </div>
          <div className={styles.setting}>
            <label htmlFor="latest-weeks">Latest a review can move (weeks after the last review)</label>
            <input id="latest-weeks" type="number" min={1} value={latestWeeks} onChange={(event) => setLatest(Number(event.target.value))} />
          </div>
          <p className={styles.note}>Booked and locked reviews always count towards the limit but are never moved. First reviews aren&apos;t moved either: Management gets a flag instead.</p>
          <div className={styles.saveRow}>
            <button className={styles.primary} type="submit" disabled={!canWrite}>Save limit</button>
          </div>
        </form>
      </section>
      <section className={styles.card}>
        <h2>Reviews per week · live, read-only</h2>
        <div className={styles.head}>
          <span>Week</span>
          <span>Now</span>
          <span />
          <span>After closed days and the limit</span>
          <span />
        </div>
        {weeks.map((week) => {
          const note = week.excluded ? "closed" : week.closed || null;
          return (
            <div className={styles.row} key={week.week}>
              <div className={styles.week}>{weekLabel(week.week)}{note ? <em>{note}</em> : null}</div>
              <Bar count={week.before} limit={limit} tone="before" />
              <Bar count={week.after} limit={limit} tone="after" />
            </div>
          );
        })}
        {!preview ? <p className={styles.note}>Preview the next 16 weeks before anything is moved.</p> : null}
        <div className={styles.impact}>
          <strong>What would move</strong>
          <ul>
            <li><b>{moves.length}</b> reviews would move. <b>{earlier}</b> earlier and <b>{later}</b> later.</li>
            {over ? <li><b>{over}</b> {over === 1 ? "week is" : "weeks are"} over the limit of {limit} before the moves.</li> : null}
            {closedWeeks ? <li><b>{closedWeeks}</b> {closedWeeks === 1 ? "week is" : "weeks are"} closed and left empty.</li> : null}
            <li>Nothing booked or locked is moved. First reviews are not moved either.</li>
          </ul>
        </div>
        {moves.length ? (
          <ul className={styles.moves}>
            {moves.map((move) => (
              <li key={`${move.gtaId}-${move.from}`}>
                <span><strong>{move.name || move.gtaId}</strong>: {formatDay(move.from)} → {formatDay(move.to)}</span>
                <em>{reasonLabel(move.reason)}</em>
              </li>
            ))}
          </ul>
        ) : null}
        <div className={styles.actions}>
          <button type="button" onClick={download} disabled={!moves.length}>Download list</button>
          <button type="button" className={styles.primary} disabled={!canWrite} onClick={() => void previewRebalanceAction().then((result) => {
            if (!result.ok) setMessage(result.formError || "The preview failed.");
            else setPreview(result.preview as WeekPreview);
          })}>Rebalance (preview first)</button>
          <button type="button" className={styles.primary} disabled={!canWrite || !preview} onClick={() => void applyRebalanceAction().then((result) => {
            setMessage(result.ok ? "Reviews were moved." : result.formError || "The moves were not applied.");
            if (result.ok) setPreview(result.preview as WeekPreview);
          })}>Apply moves</button>
        </div>
        {message ? <p className={styles.status} role="status">{message}</p> : null}
      </section>
    </div>
  );
}

function Bar({ count, limit, tone }: { count: number; limit: number; tone: "before" | "after" }) {
  const scale = Math.max(limit * 2, 1);
  const width = Math.min(100, (count / scale) * 100);
  const over = count > limit;
  return (
    <>
      <div className={styles.track}>
        <div className={`${styles.bar} ${over ? styles.over : tone === "before" ? styles.before : styles.after}`} style={{ width: `${width}%` }} />
        <i className={styles.marker} />
      </div>
      <div className={over ? `${styles.count} ${styles.countOver}` : styles.count}>{count}/{limit}</div>
    </>
  );
}
