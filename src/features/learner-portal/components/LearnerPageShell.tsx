import type { ReactNode } from "react";
import styles from "./LearnerPageShell.module.css";

export function LearnerPageShell({
  title,
  description,
  children,
  actions,
  fill = false,
  compactHeader = false,
  eyebrow = "Learner portal",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Grow to fill the portal content area (e.g. Messages). */
  fill?: boolean;
  /** Tighter page header so content (e.g. chat) gets more room. */
  compactHeader?: boolean;
  /** Workspace label above the title (shared screens override this). */
  eyebrow?: string;
}) {
  const rootClass = [
    styles.root,
    fill ? styles.fill : "",
    compactHeader ? styles.compactHeader : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          {description ? (
            <p className={styles.description}>{description}</p>
          ) : null}
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
  size = "md",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue" | "navy";
  size?: "md" | "lg";
}) {
  return (
    <span
      className={`${styles.chip} ${styles[tone]}${size === "lg" ? ` ${styles.chipLg}` : ""}`}
    >
      {children}
    </span>
  );
}
