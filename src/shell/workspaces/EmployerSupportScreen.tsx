"use client";

import styles from "./EmployerSupportScreen.module.css";

const ACTIONS = [
  {
    id: "ask-gta",
    title: "Ask GTA",
    description: "General questions about apprenticeship delivery, reviews, or employer obligations.",
  },
  {
    id: "raise-concern",
    title: "Raise a Concern",
    description:
      "Raise a concern about apprentice welfare or workplace issues. GTA handles this first — the learner is not contacted directly.",
  },
  {
    id: "request-support",
    title: "Request Support",
    description: "Request GTA support for training arrangements, attendance, or progress issues.",
  },
  {
    id: "clarify-progress",
    title: "Clarify Learner Progress",
    description: "Request clarification on progress summaries visible to employers.",
  },
] as const;

export function EmployerSupportScreen() {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>Employer Support &amp; Concerns</h1>
        <p className={styles.lead}>
          Concerns and sensitive issues are routed to GTA first. Internal case notes and
          safeguarding detail are never shown in employer views.
        </p>
      </header>

      <div className={styles.grid}>
        {ACTIONS.map((action) => (
          <button key={action.id} type="button" className={styles.card}>
            <span className={styles.cardTitle}>{action.title}</span>
            <span className={styles.cardBody}>{action.description}</span>
            <span className={styles.cardCta}>Open mock workflow</span>
          </button>
        ))}
      </div>

      <section className={styles.cases} aria-label="Employer-visible cases">
        <h2 className={styles.sectionTitle}>Your open cases (employer view)</h2>
        <div className={styles.caseRow}>
          <div>
            <p className={styles.caseTitle}>Progress clarification — Alex Morgan</p>
            <p className={styles.caseMeta}>Submitted 12 Jul 2026 · Awaiting GTA response</p>
          </div>
          <span className={styles.status}>With GTA</span>
        </div>
        <p className={styles.hiddenNote}>
          Internal GTA note (hidden from employer): employer concern logged — mentor assigned.
        </p>
      </section>
    </div>
  );
}
