import Link from "next/link";
import type { SummaryMetricDto } from "../types";
import { cn } from "@/lib/utils";
import { MetricSparkline } from "./MetricSparkline";
import styles from "./SummaryMetricCard.module.css";

type Props = {
  metric: SummaryMetricDto;
  href: string;
  active?: boolean;
};

function TrendArrow({ trend }: { trend: SummaryMetricDto["trend"] }) {
  return (
    <svg
      className={styles.trendArrow}
      viewBox="0 0 10 10"
      width="10"
      height="10"
      aria-hidden
    >
      {trend === "up" ? (
        <path
          d="M1 7 L5 3 L9 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : trend === "down" ? (
        <path
          d="M1 3 L5 7 L9 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M1.5 5 H8.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function SummaryMetricCard({ metric, href, active }: Props) {
  return (
    <Link
      href={href}
      className={cn(styles.card, styles[metric.tone], active && styles.active)}
      aria-current={active ? "true" : undefined}
    >
      <p className={styles.label}>{metric.label}</p>
      <div className={styles.mainRow}>
        <div className={styles.figures}>
          <p className={styles.value}>{metric.value}</p>
          {metric.deltaLabel ? (
            <p className={styles.delta}>
              <TrendArrow trend={metric.trend} />
              {metric.deltaLabel}
            </p>
          ) : null}
        </div>
        <MetricSparkline
          values={metric.sparkline}
          trend={metric.trend}
          tone={metric.tone}
          label={metric.label}
        />
      </div>
      {metric.breakdown && metric.breakdown.length > 0 ? (
        <ul className={styles.breakdown}>
          {metric.breakdown.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {metric.actionLabel ? (
        <p className={styles.actionLabel}>{metric.actionLabel}</p>
      ) : null}
    </Link>
  );
}
