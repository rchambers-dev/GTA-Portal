"use client";

import { useState } from "react";
import { applyRebalanceAction, previewRebalanceAction, saveWeekLimitsAction } from "./week-limit-actions";
import styles from "./week-limit.module.css";

export type WeekBar = { week: string; before: number; after: number; excluded?: boolean; closed?: string | null };
export type WeekMove = { gtaId: string; name?: string; from: string; to: string; reason: string };
export type WeekPreview = { max?: number; weeks?: WeekBar[]; moves?: WeekMove[] };

function formatDay(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[month - 1]} ${year}`;
}

function reasonLabel(reason: string): string {
  return reason === "closed_day" ? "Closed day" : "Weekly limit";
}

export function WeekLimitPanel({ canWrite }: { canWrite: boolean }) {
  const [maxReviews, setMaxReviews] = useState(25);
  const [earliestWeeks, setEarliest] = useState(8);
  const [latestWeeks, setLatest] = useState(12);
  const [preview, setPreview] = useState<WeekPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const limit = preview?.max ?? maxReviews;
  const moves = preview?.moves ?? [];
  const earlier = moves.filter((move) => move.to < move.from).length;
  const later = moves.length - earlier;

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
          <p className={styles.note}>Booked and locked reviews always count but never move, and first reviews are not moved.</p>
          <button className={styles.primary} type="submit" disabled={!canWrite}>Save limit</button>
        </form>
      </section>
      <section className={styles.card}>
        <h2>Reviews per week</h2>
        <div className={styles.columns}>
          <h3>Now</h3>
          <h3>After closed days and the limit</h3>
          {(preview?.weeks ?? []).map((week) => (
            <div className={styles.pair} key={week.week}>
              <Bar label={formatDay(week.week)} count={week.before} limit={limit} excluded={week.excluded} closed={week.closed} />
              <Bar label={formatDay(week.week)} count={week.after} limit={limit} excluded={week.excluded} closed={week.closed} />
            </div>
          ))}
        </div>
        {!preview ? <p className={styles.note}>Preview the next 16 weeks before anything is moved.</p> : null}
        <div className={styles.summary}>
          <h3>What would move</h3>
          <p>{moves.length} reviews · {earlier} earlier · {later} later</p>
          {moves.length === 0 ? <p className={styles.note}>Nothing would move.</p> : (
            <ul>
              {moves.map((move) => (
                <li key={`${move.gtaId}-${move.from}`}>
                  <strong>{move.name || move.gtaId}</strong>
                  <span>{formatDay(move.from)} → {formatDay(move.to)}</span>
                  <em>{reasonLabel(move.reason)}</em>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={download} disabled={!moves.length}>Download list</button>
          <button type="button" disabled={!canWrite} onClick={() => void previewRebalanceAction().then((result) => {
            if (!result.ok) setMessage(result.formError || "The preview failed.");
            else setPreview(result.preview as WeekPreview);
          })}>Rebalance (preview first)</button>
          <button type="button" className={styles.primary} disabled={!canWrite || !preview} onClick={() => void applyRebalanceAction().then((result) => {
            setMessage(result.ok ? "Reviews were moved." : result.formError || "The moves were not applied.");
            if (result.ok) setPreview(result.preview as WeekPreview);
          })}>Apply moves</button>
        </div>
        {message ? <p role="status">{message}</p> : null}
      </section>
    </div>
  );
}

function Bar({ label, count, limit, excluded, closed }: { label: string; count: number; limit: number; excluded?: boolean; closed?: string | null }) {
  const width = Math.min(100, Math.round((count / Math.max(limit, 1)) * 100));
  return (
    <div>
      <div className={styles.barLabel}><span>{label}</span><span>{count}/{limit}</span></div>
      <div className={styles.track}>
        <div className={count > limit ? styles.fillOver : styles.fill} style={{ width: `${width}%` }} />
        <i className={styles.marker} />
      </div>
      {excluded ? <div className={styles.tag}>Excluded{closed ? ` · ${closed}` : ""}</div> : closed ? <div className={styles.tag}>{closed}</div> : null}
    </div>
  );
}
