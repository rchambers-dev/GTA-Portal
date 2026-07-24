import Link from "next/link";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "../components/LearnerPageShell";
import { ALEX_MODULES, ALEX_PROFILE } from "../domain/mock-learner";
import styles from "./learner-pages.module.css";

export function LearnerProgressScreen() {
  const profile = ALEX_PROFILE;
  const completed = ALEX_MODULES.filter((m) => m.status === "completed").length;
  const inProgress = ALEX_MODULES.filter((m) => m.status === "in_progress").length;
  const remaining = ALEX_MODULES.filter((m) => m.status === "remaining").length;
  const releasedCount = ALEX_MODULES.filter((m) => m.released).length;

  return (
    <LearnerPageShell
      title="Progress"
      description="Planned versus actual progress on your programme, plus a simple module snapshot."
    >
      <div className={styles.stack}>
        <div className={styles.grid}>
          <div className={styles.glance}>
            <p className={styles.glanceLabel}>Planned</p>
            <p className={styles.glanceValue}>{profile.plannedProgressPercent}%</p>
            <p className={styles.glanceHint}>Expected by week {profile.programmeWeek}</p>
          </div>
          <div className={styles.glance}>
            <p className={styles.glanceLabel}>Actual</p>
            <p className={styles.glanceValue}>{profile.actualProgressPercent}%</p>
            <p className={styles.glanceHint}>
              {profile.actualProgressPercent < profile.plannedProgressPercent
                ? "Slightly behind plan — focus on OTJ and reflective work"
                : "On or ahead of plan"}
            </p>
          </div>
          <div className={styles.glance}>
            <p className={styles.glanceLabel}>Modules released</p>
            <p className={styles.glanceValue}>
              {releasedCount}/{ALEX_MODULES.length}
            </p>
            <p className={styles.glanceHint}>Tutor-controlled unlocks</p>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Overall completion</h2>
          <div className={styles.progressBar} aria-hidden>
            <div
              className={styles.progressFill}
              style={{ width: `${profile.actualProgressPercent}%` }}
            />
          </div>
          <p className={styles.meta}>
            {completed} completed · {inProgress} in progress · {remaining} remaining
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Module snapshot</h2>
          <ul className={styles.list}>
            {ALEX_MODULES.map((mod) => {
              const body = (
                <>
                  <div className={styles.rowMain}>
                    <strong>
                      {mod.code} · {mod.title}
                    </strong>
                    {mod.released ? null : <span>Waiting for tutor release</span>}
                  </div>
                  <div className={styles.rowEnd}>
                    {mod.released ? (
                      <>
                        <LearnerStatusChip
                          tone={
                            mod.status === "completed"
                              ? "green"
                              : mod.status === "in_progress"
                                ? "blue"
                                : "neutral"
                          }
                        >
                          {mod.status === "completed"
                            ? "Done"
                            : mod.status === "in_progress"
                              ? "Active"
                              : "Todo"}
                        </LearnerStatusChip>
                        <span className={styles.linkish}>Open coverage →</span>
                      </>
                    ) : (
                      <LearnerStatusChip tone="neutral">Locked</LearnerStatusChip>
                    )}
                  </div>
                </>
              );

              return (
                <li key={mod.id}>
                  {mod.released ? (
                    <Link
                      href={`/learner/modules/${mod.id}`}
                      className={styles.rowLink}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div
                      className={`${styles.rowLink} ${styles.rowLocked}`}
                      aria-disabled="true"
                    >
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </LearnerPageShell>
  );
}
