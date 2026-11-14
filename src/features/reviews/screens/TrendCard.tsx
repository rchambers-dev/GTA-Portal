"use client";

import { useState } from "react";
import styles from "./analytics.module.css";

type Point = {
  id: string;
  label: string;
  current: boolean;
  released: number;
  received: number;
  completed: number;
  visits: number;
  callsTeams: number;
  behind: boolean;
};

const SERIES = [
  { key: "released" as const, className: styles.rel, name: "Reviews released" },
  { key: "received" as const, className: styles.rec, name: "Forms received" },
  { key: "completed" as const, className: styles.comp, name: "Reviews completed" },
  { key: "visits" as const, className: styles.vis, name: "Visits" },
  { key: "callsTeams" as const, className: styles.call, name: "Calls/Teams" },
];

export function TrendCard({ weeks, months }: { weeks: Point[]; months: Point[] }) {
  const [mode, setMode] = useState<"weeks" | "months">("weeks");
  const rows = mode === "weeks" ? weeks : months;
  const mark = mode === "weeks" ? "This week" : "This month";
  const max = Math.max(1, ...rows.flatMap((row) => [row.released, row.received, row.completed, row.visits, row.callsTeams]));
  const ticks = [max, Math.ceil(max / 2), 0];
  return (
    <section className={styles.card}>
      <div className={styles.trendHead}>
        <h2>{mode === "weeks" ? "Weekly trend" : "Monthly trend"}</h2>
        <div className={styles.toggle} role="group" aria-label="Trend period">
          <button type="button" aria-pressed={mode === "weeks"} onClick={() => setMode("weeks")}>Weeks</button>
          <button type="button" aria-pressed={mode === "months"} onClick={() => setMode("months")}>Months</button>
        </div>
      </div>
      <p className={styles.legend}>
        <i className={styles.rel} />Reviews released
        <i className={styles.rec} />Forms received
        <i className={styles.comp} />Reviews completed
        <i className={styles.vis} />Visits
        <i className={styles.call} />Calls/Teams
      </p>
      <div className={styles.chart}>
        <div className={styles.axis} aria-hidden="true">
          {ticks.map((tick) => <span key={tick}>{tick}</span>)}
        </div>
        <div className={styles.plot} role="img" aria-label={`${mode === "weeks" ? "Weekly" : "Monthly"} released, received, completed, visits and calls or Teams`}>
          {[0, 50, 100].map((line) => <span key={line} className={styles.grid} style={{ bottom: `${line}%` }} />)}
          {rows.map((row) => (
            <div key={row.id} className={row.current && row.behind ? `${styles.cluster} ${styles.behind}` : row.current ? `${styles.cluster} ${styles.currentWeek}` : styles.cluster}>
              {SERIES.map((item) => {
                const value = row[item.key];
                return <i key={item.key} className={item.className} title={`${item.name}: ${value}`} style={{ height: value ? `${Math.round((value / max) * 100)}%` : 0, minHeight: value ? 2 : 0 }} />;
              })}
              <span>{row.label}{row.current ? ` · ${mark}` : ""}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.trendScroll}>
        <table className={styles.weekTable}>
          <thead>
            <tr>
              <th>{mode === "weeks" ? "Week" : "Month"}</th>
              <th><i className={styles.rel} />Released</th>
              <th><i className={styles.rec} />Received</th>
              <th><i className={styles.comp} />Completed</th>
              <th><i className={styles.vis} />Visits</th>
              <th><i className={styles.call} />Calls/Teams</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.behind ? styles.behindRow : undefined}>
                <td>{row.label}{row.current ? ` · ${mark}` : ""}</td>
                <td>{row.released}</td>
                <td>{row.received}</td>
                <td>{row.completed}</td>
                <td>{row.visits}</td>
                <td>{row.callsTeams}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
