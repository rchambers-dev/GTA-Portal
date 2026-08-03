import Link from "next/link";
import type { ApprenticeCardDto } from "../types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { overallStatusLabel, overallStatusTone } from "../lib/status";
import styles from "./ApprenticeKanbanCard.module.css";

type Props = {
  apprentice: ApprenticeCardDto;
  href: string;
  selected?: boolean;
};

/**
 * Compact board card — status tracker first.
 * Full priority, attendance and evidence detail lives in the apprentice workspace.
 */
export function ApprenticeKanbanCard({ apprentice, href, selected }: Props) {
  return (
    <article className={selected ? styles.cardSelected : styles.card}>
      <Link href={href} className={styles.link}>
        <div className={styles.top}>
          <span className={styles.avatar} aria-hidden>
            {apprentice.initials}
          </span>
          <div className={styles.identity}>
            <h3 className={styles.name}>{apprentice.displayName}</h3>
            <p className={styles.programme}>{apprentice.programmeName}</p>
          </div>
        </div>

        <div className={styles.statusRow}>
          <StatusBadge size="md" tone={overallStatusTone(apprentice.overallStatus)}>
            {overallStatusLabel(apprentice.overallStatus)}
          </StatusBadge>
        </div>

        {apprentice.programmeOverdueLabel ? (
          <p className={styles.overdue}>{apprentice.programmeOverdueLabel}</p>
        ) : null}
      </Link>
    </article>
  );
}
