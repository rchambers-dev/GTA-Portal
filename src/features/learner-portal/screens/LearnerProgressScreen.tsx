import Link from "next/link";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "../components/LearnerPageShell";
import { ALEX_MODULES, ALEX_PROFILE } from "../domain/mock-learner";
import styles from "./learner-pages.module.css";

function moduleTone(status: "completed" | "in_progress" | "remaining", released: boolean) {
  if (!released) return "navy" as const;
  switch (status) {
    case "completed":
      return "green" as const;
    case "in_progress":
      return "amber" as const;
    default:
      return "blue" as const;
  }
}

export function LearnerProgressScreen() {
  const profile = ALEX_PROFILE;
  const completed = ALEX_MODULES.filter((m) => m.status === "completed").length;
  const inProgress = ALEX_MODULES.filter((m) => m.status === "in_progress").length;
  const remaining = ALEX_MODULES.filter((m) => m.status === "remaining").length;
  const releasedCount = ALEX_MODULES.filter((m) => m.released).length;
  const behindPlan =
    profile.actualProgressPercent < profile.plannedProgressPercent;
  const gap = Math.max(
    0,
    profile.plannedProgressPercent - profile.actualProgressPercent,
  );

  return (
    <LearnerPageShell
      title="Progress"
      description="Planned versus actual progress on your programme, plus a simple module snapshot."
    >
      <div className={styles.stack}>
        <div className={styles.grid}>
          <div className={styles.glance} data-tone="navy">
            <p className={styles.glanceLabel}>Planned</p>
            <p className={styles.glanceValue}>
              {profile.plannedProgressPercent}%
            </p>
            <p className={styles.glanceHint}>
              Expected by week {profile.programmeWeek}
            </p>
          </div>
          <div
            className={styles.glance}
            data-tone={behindPlan ? "amber" : "green"}
          >
            <p className={styles.glanceLabel}>Actual</p>
            <p className={styles.glanceValue}>
              {profile.actualProgressPercent}%
            </p>
            <p className={styles.glanceHint}>
              {behindPlan
                ? `${gap}% behind plan — focus on OTJ and reflective work`
                : "On or ahead of plan"}
            </p>
          </div>
          <div className={styles.glance} data-tone="blue">
            <p className={styles.glanceLabel}>Modules released</p>
            <p className={styles.glanceValue}>
              {releasedCount}/{ALEX_MODULES.length}
            </p>
            <p className={styles.glanceHint}>Tutor-controlled unlocks</p>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.dashSectionTitle} data-accent="green">
            Overall completion
          </h2>
          <div className={styles.progressCompare}>
            <div className={styles.progressBar} aria-hidden>
              <div
                className={styles.progressFillPlanned}
                style={{ width: `${profile.plannedProgressPercent}%` }}
              />
              <div
                className={styles.progressFill}
                data-tone={behindPlan ? "amber" : "green"}
                style={{ width: `${profile.actualProgressPercent}%` }}
              />
            </div>
            <div className={styles.progressLegend}>
              <span data-tone="navy">
                <i aria-hidden /> Planned {profile.plannedProgressPercent}%
              </span>
              <span data-tone={behindPlan ? "amber" : "green"}>
                <i aria-hidden /> Actual {profile.actualProgressPercent}%
              </span>
            </div>
          </div>
          <div className={styles.progressStats}>
            <span className={styles.progressStat} data-tone="green">
              <strong>{completed}</strong> completed
            </span>
            <span className={styles.progressStat} data-tone="amber">
              <strong>{inProgress}</strong> in progress
            </span>
            <span className={styles.progressStat} data-tone="blue">
              <strong>{remaining}</strong> remaining
            </span>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.dashSectionTitle} data-accent="navy">
            Module snapshot
          </h2>
          <ul className={styles.list}>
            {ALEX_MODULES.map((mod) => {
              const tone = moduleTone(mod.status, mod.released);
              const body = (
                <>
                  <div className={styles.rowMain}>
                    <strong>
                      {mod.code} · {mod.title}
                    </strong>
                    {mod.released ? (
                      <span>
                        {mod.status === "completed"
                          ? "Coverage signed off"
                          : mod.status === "in_progress"
                            ? "In learning now"
                            : "Ready when you are"}
                      </span>
                    ) : (
                      <span>Waiting for tutor release</span>
                    )}
                  </div>
                  <div className={styles.rowEnd}>
                    {mod.released ? (
                      <>
                        <LearnerStatusChip
                          tone={
                            mod.status === "completed"
                              ? "green"
                              : mod.status === "in_progress"
                                ? "amber"
                                : "blue"
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
                      data-tone={tone}
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
