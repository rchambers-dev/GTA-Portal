import Link from "next/link";
import type { LearnerCardDto } from "../types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { overallStatusLabel, overallStatusTone } from "../lib/status";
import styles from "./LearnerKanbanCard.module.css";

type Props = {
  learner: LearnerCardDto;
  href: string;
  selected?: boolean;
};

/**
 * Compact board card — status tracker first.
 * Full priority, attendance and evidence detail lives in the learner workspace.
 */
export function LearnerKanbanCard({ learner, href, selected }: Props) {
  return (
    <article className={selected ? styles.cardSelected : styles.card}>
      <Link href={href} className={styles.link}>
        <div className={styles.top}>
          <span className={styles.avatar} aria-hidden>
            {learner.initials}
          </span>
          <div className={styles.identity}>
            <h3 className={styles.name}>{learner.displayName}</h3>
            <p className={styles.programme}>{learner.programmeName}</p>
          </div>
        </div>

        <div className={styles.statusRow}>
          <StatusBadge size="md" tone={overallStatusTone(learner.overallStatus)}>
            {overallStatusLabel(learner.overallStatus)}
          </StatusBadge>
        </div>

        {learner.programmeOverdueLabel ? (
          <p className={styles.overdue}>{learner.programmeOverdueLabel}</p>
        ) : null}
      </Link>
    </article>
  );
}
