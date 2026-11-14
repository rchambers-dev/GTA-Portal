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
  { key: "released" as const, color: "#1f2a44", name: "Reviews released" },
  { key: "received" as const, color: "#2f80ed", name: "Forms received" },
  { key: "completed" as const, color: "#2e9e5b", name: "Reviews completed" },
  { key: "visits" as const, color: "#7b3fe4", name: "Visits" },
  { key: "callsTeams" as const, color: "#e67e22", name: "Calls/Teams" },
];

export function TrendCard({ weeks, months }: { weeks: Point[]; months: Point[] }) {
  const [mode, setMode] = useState<"weeks" | "months">("weeks");
  const rows = mode === "weeks" ? weeks : months;
  const mark = mode === "weeks" ? "This week" : "This month";
  const max = Math.max(1, ...rows.flatMap((row) => [row.released, row.received, row.completed, row.visits, row.callsTeams]));
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
      <LineChart rows={rows} max={max} mark={mark} period={mode === "weeks" ? "Weekly" : "Monthly"} />
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

function LineChart({ rows, max, mark, period }: { rows: Point[]; max: number; mark: string; period: string }) {
  const width = 720;
  const height = 220;
  const padL = 32;
  const padR = 12;
  const padT = 14;
  const padB = 32;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const xAt = (index: number) => rows.length <= 1 ? padL + innerW / 2 : padL + (index / (rows.length - 1)) * innerW;
  const yAt = (value: number) => padT + innerH - (value / max) * innerH;
  const ticks = [max, Math.round(max / 2), 0];
  return (
    <svg className={styles.lineChart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${period} released, received, completed, visits and calls or Teams`}>
      {ticks.map((tick, index) => {
        const y = yAt(tick);
        return (
          <g key={`${tick}-${index}`}>
            <line x1={padL} x2={width - padR} y1={y} y2={y} className={styles.gridLine} />
            <text x={padL - 6} y={y + 3} className={styles.axisText} textAnchor="end">{tick}</text>
          </g>
        );
      })}
      {SERIES.map((series) => {
        const points = rows.map((row, index) => `${xAt(index)},${yAt(row[series.key])}`).join(" ");
        return <polyline key={series.key} points={points} fill="none" stroke={series.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
      })}
      {rows.map((row, index) => SERIES.map((series) => (
        <circle key={`${row.id}-${series.key}`} cx={xAt(index)} cy={yAt(row[series.key])} r={3.5} fill={series.color}>
          <title>{`${row.label}${row.current ? ` · ${mark}` : ""} · ${series.name}: ${row[series.key]}`}</title>
        </circle>
      )))}
      {rows.map((row, index) => (
        <text key={row.id} x={xAt(index)} y={height - 8} className={row.current ? styles.axisCurrent : styles.axisText} textAnchor="middle">
          {row.label}{row.current ? ` · ${mark}` : ""}
        </text>
      ))}
    </svg>
  );
}
