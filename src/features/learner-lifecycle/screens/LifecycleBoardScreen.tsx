import type { LifecycleBoardDto } from "../types";
import { SummaryMetricCard } from "../components/SummaryMetricCard";
import { LifecycleBoardView } from "./LifecycleBoardView";
import { metricHref } from "@/features/progress-mentor/lib/metric-links";
import styles from "./LifecycleBoardScreen.module.css";

type Props = {
  board: LifecycleBoardDto;
  selectedLearnerId?: string | null;
};

/**
 * Permanent feature screen — weekly lifecycle board shell.
 * Metric cards deep-link into Progress Mentor filtered work queues.
 */
export function LifecycleBoardScreen({ board, selectedLearnerId }: Props) {
  const q = board.query;

  return (
    <div className={styles.root}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Weekly Learner Lifecycle</p>
          <h1 className={styles.title}>Learner Lifecycle Board</h1>
        </div>
        <p className={styles.viewing}>{board.viewingLabel}</p>
      </header>

      <section className={styles.metrics} aria-label="Summary metrics">
        {board.metrics.map((metric) => (
          <SummaryMetricCard
            key={metric.key}
            metric={metric}
            active={q.metric === metric.key}
            href={metricHref(metric.key, q.year)}
          />
        ))}
      </section>

      <LifecycleBoardView board={board} selectedLearnerId={selectedLearnerId} />
    </div>
  );
}

