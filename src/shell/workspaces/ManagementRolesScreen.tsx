"use client";

import styles from "./ManagementRolesScreen.module.css";

/**
 * Temporary curriculum grants — previously a fiction demo against seeded
 * accounts. Live staff-picker wiring belongs here next; demo flow removed.
 */
export function ManagementRolesScreen() {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>Roles &amp; Responsibilities</h1>
        <p className={styles.lead}>
          Temporary Curriculum Editor grants will be managed against live staff
          profiles. The previous demo account switcher has been removed.
        </p>
      </header>

      <section className={styles.panel}>
        <p className={styles.empty}>
          No temporary responsibilities can be granted here yet. Use
          Administration → Users for live staff roles until this screen is
          reconnected to Supabase profiles.
        </p>
      </section>
    </div>
  );
}
