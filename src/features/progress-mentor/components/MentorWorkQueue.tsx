import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./MentorWorkQueue.module.css";

export function MentorPageShell({
  eyebrow,
  title,
  description,
  fromLifecycle,
  children,
  toolbar,
}: {
  eyebrow: string;
  title: string;
  description: string;
  fromLifecycle?: boolean;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        {fromLifecycle ? (
          <Link href="/apprentices/lifecycle" className={styles.backLink}>
            ← Back to Lifecycle Board
          </Link>
        ) : null}
      </header>
      {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}
      {children}
    </div>
  );
}

export function MentorTable({
  columns,
  children,
  empty,
}: {
  columns: string[];
  children: ReactNode;
  empty?: boolean;
}) {
  if (empty) {
    return (
      <p className={styles.empty}>No records match the current filters.</p>
    );
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col, index) => (
              <th key={`${col}-${index}`} scope="col">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function StatusChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "orange" | "blue";
}) {
  return <span className={`${styles.chip} ${styles[tone]}`}>{children}</span>;
}

export function ViewTabs({
  tabs,
  active,
  basePath,
  preserve,
  paramKey = "view",
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  basePath: string;
  preserve?: Record<string, string | undefined>;
  /** Query param for the active tab (default `view` for legacy links). */
  paramKey?: string;
}) {
  return (
    <div className={styles.viewTabs} role="tablist">
      {tabs.map((tab) => {
        const params = new URLSearchParams();
        if (preserve) {
          for (const [k, v] of Object.entries(preserve)) {
            if (v) params.set(k, v);
          }
        }
        params.set(paramKey, tab.id);
        const href = `${basePath}?${params.toString()}`;
        return (
          <Link
            key={tab.id}
            href={href}
            className={active === tab.id ? styles.viewTabActive : styles.viewTab}
            role="tab"
            aria-selected={active === tab.id}
          >
            {tab.label}
            {tab.count != null ? (
              <span className={styles.viewCount}>{tab.count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
