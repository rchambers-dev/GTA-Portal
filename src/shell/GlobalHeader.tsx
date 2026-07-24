"use client";

import { DevAccountSwitcher } from "./demo/DevAccountSwitcher";
import { useDemoSession } from "./demo/DemoSessionProvider";
import styles from "./GlobalHeader.module.css";

/**
 * TEMPORARY standalone header.
 * Replace with portal header on integration.
 */
export function GlobalHeader() {
  const { session } = useDemoSession();
  const account = session?.account;
  if (!account) return null;

  return (
    <header className={styles.header}>
      <label className={styles.search}>
        <span className={styles.visuallyHidden}>Search</span>
        <input
          type="search"
          placeholder="Search learners, employers, programmes…"
          disabled
          aria-disabled="true"
          title="Global search will connect to portal search later"
        />
      </label>

      <div className={styles.actions}>
        <button type="button" className={styles.iconBtn} aria-label="Notifications (preview)">
          <span className={styles.iconGlyph} aria-hidden>
            N
          </span>
          <span className={styles.badge}>12</span>
        </button>
        <button type="button" className={styles.iconBtn} aria-label="Flags (preview)">
          <span className={styles.iconGlyph} aria-hidden>
            F
          </span>
          <span className={`${styles.badge} ${styles.badgeAmber}`}>9</span>
        </button>
        <div className={styles.user}>
          <DevAccountSwitcher currentAccount={account} />
        </div>
      </div>
    </header>
  );
}
