import Link from "next/link";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "../components/LearnerPageShell";
import {
  ALEX_MODULES,
  ALEX_PROFILE,
  formatModuleDate,
  getAlexModuleDetail,
  getAlexModulesByYear,
  type LearnerModuleRow,
} from "../domain/mock-learner";
import styles from "./learner-pages.module.css";

function statusTone(status: LearnerModuleRow["status"]) {
  switch (status) {
    case "completed":
      return "green" as const;
    case "in_progress":
      return "blue" as const;
    default:
      return "neutral" as const;
  }
}

function statusLabel(status: LearnerModuleRow["status"]) {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    default:
      return "Remaining";
  }
}

function ModuleRow({ mod }: { mod: LearnerModuleRow }) {
  const detail = getAlexModuleDetail(mod.id);
  const coveredCount = detail?.covered.length ?? 0;
  const previousCount = detail?.previouslyCovered.length ?? 0;
  const upcomingCount = detail?.upcoming.length ?? 0;

  const body = (
    <>
      <div className={styles.rowMain}>
        <strong>
          {mod.code} · {mod.title}
        </strong>
        <span>Year {mod.year}</span>
        {mod.released ? (
          <>
            <span>
              Released by {mod.releasedBy} · {formatModuleDate(mod.releasedAt)}
            </span>
            <span>
              {coveredCount} covered · {previousCount} previously · {upcomingCount}{" "}
              still to cover
            </span>
          </>
        ) : (
          <span>
            Visible on your programme map — your tutor will release this when you
            reach it
          </span>
        )}
      </div>
      <div className={styles.rowEnd}>
        {mod.released ? (
          <>
            <LearnerStatusChip tone={statusTone(mod.status)}>
              {statusLabel(mod.status)}
            </LearnerStatusChip>
            <span className={styles.linkish}>View coverage →</span>
          </>
        ) : (
          <>
            <LearnerStatusChip tone="neutral">Not released</LearnerStatusChip>
            <span className={styles.lockedHint}>Locked</span>
          </>
        )}
      </div>
    </>
  );

  if (!mod.released) {
    return (
      <div
        className={`${styles.rowLink} ${styles.rowLocked}`}
        aria-disabled="true"
        title="Your tutor has not released this module yet"
      >
        {body}
      </div>
    );
  }

  return (
    <Link href={`/learner/modules/${mod.id}`} className={styles.rowLink}>
      {body}
    </Link>
  );
}

export function LearnerModulesScreen() {
  const groups = getAlexModulesByYear();
  const releasedCount = ALEX_MODULES.filter((m) => m.released).length;

  return (
    <LearnerPageShell
      title="Modules"
      description={`All ${ALEX_MODULES.length} modules on ${ALEX_PROFILE.programmeName}. ${releasedCount} released by your tutor — the rest stay visible but locked until released.`}
    >
      <div className={styles.stack}>
        {groups.map((group) => (
          <section key={group.year} className={styles.section}>
            <h2 className={styles.sectionTitle}>{group.label}</h2>
            <ul className={styles.list}>
              {group.modules.map((mod) => (
                <li key={mod.id}>
                  <ModuleRow mod={mod} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </LearnerPageShell>
  );
}
