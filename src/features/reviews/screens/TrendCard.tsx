"use client";

import { useEffect, useRef, useState } from "react";
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
      <LineChart key={mode} rows={rows} max={max} mark={mark} period={mode} />
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

function periodTitle(row: Point, period: "weeks" | "months", mark: string) {
  const name = period === "weeks" ? `Week of ${row.label}` : row.label;
  return row.current ? `${name} · ${mark}` : name;
}

function LineChart({ rows, max, mark, period }: { rows: Point[]; max: number; mark: string; period: "weeks" | "months" }) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(1, Math.round(node.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const height = 260;
  const labels = rows.map((row) => `${row.label}${row.current ? ` · ${mark}` : ""}`);
  const widest = labels.reduce((size, label) => Math.max(size, label.length), 0);
  const padL = 44;
  const padR = Math.ceil((widest * 8.2) / 2) + 16;
  const padT = 16;
  const padB = 36;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = height - padT - padB;
  const xAt = (index: number) => rows.length <= 1 ? padL + innerW / 2 : padL + (index / (rows.length - 1)) * innerW;
  const yAt = (value: number) => padT + innerH - (value / max) * innerH;
  const ticks = [max, Math.round(max / 2), 0];
  const column = (index: number) => {
    if (rows.length <= 1) return { left: padL, width: Math.max(28, width - padL - padR) };
    const previous = index === 0 ? padL : (xAt(index - 1) + xAt(index)) / 2;
    const next = index === rows.length - 1 ? width - padR : (xAt(index) + xAt(index + 1)) / 2;
    return { left: previous, width: Math.max(28, next - previous) };
  };
  const tipWidth = 216;
  const activeRow = active == null ? null : rows[active];
  const tipLeft = active == null ? 0 : Math.max(8, xAt(active) + 14 + tipWidth <= width - 8 ? xAt(active) + 14 : xAt(active) - 14 - tipWidth);
  return (
    <div
      ref={frame}
      className={styles.lineChartFrame}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (!target.closest("button")) setActive(null);
      }}
    >
      {width > 0 ? (
      <svg className={styles.lineChart} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
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
      {active != null ? <line x1={xAt(active)} x2={xAt(active)} y1={padT} y2={padT + innerH} className={styles.guideLine} /> : null}
      {rows.map((row, index) => SERIES.map((series) => (
        <circle key={`${row.id}-${series.key}`} cx={xAt(index)} cy={yAt(row[series.key])} r={active === index ? 6 : 3.5} fill={series.color} stroke={active === index ? "#fff" : "none"} strokeWidth={active === index ? 2 : 0} />
      )))}
      {rows.map((row, index) => (
        <text key={row.id} x={xAt(index)} y={height - 14} className={row.current ? styles.axisCurrent : styles.axisText} textAnchor="middle">
          {labels[index]}
        </text>
      ))}
      </svg>
      ) : null}
      {width > 0 ? rows.map((row, index) => {
        const slice = column(index);
        const title = periodTitle(row, period, mark);
        return (
          <button
            key={row.id}
            type="button"
            className={styles.hit}
            style={{ left: slice.left, width: slice.width, top: padT, height: height - padT - 2 }}
            aria-label={`${title}. ${SERIES.map((series) => `${series.name} ${row[series.key]}`).join(", ")}`}
            aria-describedby={active === index ? "trend-tip" : undefined}
            onPointerEnter={(event) => { if (event.pointerType === "mouse") setActive(index); }}
            onPointerLeave={(event) => { if (event.pointerType === "mouse") setActive((current) => current === index ? null : current); }}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (event.pointerType !== "mouse") setActive(index);
            }}
            onFocus={() => setActive(index)}
            onBlur={() => setActive((current) => current === index ? null : current)}
          />
        );
      }) : null}
      {activeRow && active != null ? (
        <div id="trend-tip" className={styles.tip} role="tooltip" style={{ left: tipLeft, top: 12 }}>
          <p>{periodTitle(activeRow, period, mark)}</p>
          <ul>
            {SERIES.map((series) => (
              <li key={series.key}>
                <i style={{ background: series.color }} />
                <span>{series.name}</span>
                <b>{activeRow[series.key]}</b>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
