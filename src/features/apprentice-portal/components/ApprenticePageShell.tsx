import type { ReactNode } from "react";
import styles from "./ApprenticePageShell.module.css";

export function ApprenticePageShell({
  title,
  description,
  children,
  actions,
  fill = false,
  compactHeader = false,
  hideHeader = false,
  eyebrow = "Apprentice portal",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Grow to fill the portal content area (e.g. Messages). */
  fill?: boolean;
  /** Tighter page header so content (e.g. chat) gets more room. */
  compactHeader?: boolean;
  /** Keep the title for assistive tech without the visible page header. */
  hideHeader?: boolean;
  /** Workspace label above the title (shared screens override this). */
  eyebrow?: string;
}) {
  const rootClass = [
    styles.root,
    fill ? styles.fill : "",
    compactHeader ? styles.compactHeader : "",
    hideHeader ? styles.hideHeader : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      {hideHeader ? (
        <h1 className={styles.srOnly}>{title}</h1>
      ) : (
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
      )}
      {fill ? <div className={styles.fillBody}>{children}</div> : children}
    </div>
  );
}

export function ApprenticeStatusChip({
  children,
  tone = "neutral",
  size = "md",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue" | "navy" | "violet";
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
