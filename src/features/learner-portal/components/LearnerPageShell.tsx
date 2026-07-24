import type { ReactNode } from "react";
import styles from "./LearnerPageShell.module.css";

export function LearnerPageShell({
  title,
  description,
  children,
  actions,
  fill = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Grow to fill the portal content area (e.g. Messages). */
  fill?: boolean;
}) {
  return (
    <div className={fill ? `${styles.root} ${styles.fill}` : styles.root}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Learner portal</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      {fill ? <div className={styles.fillBody}>{children}</div> : children}
    </div>
  );
}

export function LearnerStatusChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue" | "navy";
}) {
  return <span className={`${styles.chip} ${styles[tone]}`}>{children}</span>;
}
