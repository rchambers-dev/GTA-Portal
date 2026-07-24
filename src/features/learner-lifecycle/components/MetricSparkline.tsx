"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import styles from "./MetricSparkline.module.css";

type Props = {
  values: number[];
  trend: "up" | "down" | "flat";
  tone: "neutral" | "amber" | "red" | "green";
  label: string;
};

const WIDTH = 96;
const HEIGHT = 40;
const PAD_X = 4;
const PAD_Y = 6;

type Point = { x: number; y: number };

/** Catmull-Rom → cubic Bezier for a natural, non-wiggly curve */
function buildCurvePath(points: Point[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * Compact sparkline — smooth curve, soft fill, solid end marker.
 * Colour comes from tone; keep layout quiet so the KPI number stays primary.
 */
export function MetricSparkline({ values, trend, tone, label }: Props) {
  const reactId = useId().replace(/:/g, "");
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  // Extra headroom so the line never clips the top/bottom
  const yMin = min - range * 0.12;
  const yMax = max + range * 0.12;
  const yRange = yMax - yMin;

  const points = values.map((value, index) => ({
    x: PAD_X + (index / (values.length - 1)) * (WIDTH - PAD_X * 2),
    y: HEIGHT - PAD_Y - ((value - yMin) / yRange) * (HEIGHT - PAD_Y * 2),
  }));

  const linePath = buildCurvePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  const areaPath = `${linePath} L ${last.x} ${HEIGHT} L ${first.x} ${HEIGHT} Z`;
  const gradientId = `spark-fill-${reactId}`;

  return (
    <div
      className={cn(styles.root, styles[tone])}
      role="img"
      aria-label={`${label}: trend ${trend === "up" ? "rising" : trend === "down" ? "falling" : "steady"}`}
    >
      <svg
        className={styles.chart}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path className={styles.area} d={areaPath} fill={`url(#${gradientId})`} />
        <path
          className={styles.line}
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle className={styles.dot} cx={last.x} cy={last.y} r="3.25" fill="currentColor" />
      </svg>
    </div>
  );
}
