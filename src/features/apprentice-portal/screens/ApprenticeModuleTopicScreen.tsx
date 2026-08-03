import Link from "next/link";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import { StepBackButton } from "../components/StepBackButton";
import {
  formatModuleDate,
  getModuleTopic,
  BLANK_MODULES,
} from "../domain/apprentice-profile";
import styles from "./apprentice-pages.module.css";

function topicTone(status: "covered" | "in_progress" | "upcoming") {
  switch (status) {
    case "covered":
      return "green" as const;
    case "in_progress":
      return "blue" as const;
    default:
      return "neutral" as const;
  }
}

function topicLabel(status: "covered" | "in_progress" | "upcoming") {
  switch (status) {
    case "covered":
      return "Covered";
    case "in_progress":
      return "In progress";
    default:
      return "Still to cover";
  }
}

function sectionLabel(section: "covered" | "previouslyCovered" | "upcoming") {
  switch (section) {
    case "covered":
      return "Covered in this module";
    case "previouslyCovered":
      return "Previously covered";
    default:
      return "Still to cover";
  }
}

export function ApprenticeModuleTopicScreen({
  moduleId,
  topicId,
}: {
  moduleId: string;
  topicId: string;
}) {
  const moduleRow = BLANK_MODULES.find((m) => m.id === moduleId);
  if (moduleRow && !moduleRow.released) {
    return (
      <ApprenticePageShell
        title="Module not released"
        description="Your tutor has not released this module yet."
        actions={<StepBackButton parentHref="/apprentice/modules" />}
      >
        <p className={styles.empty}>Outcomes unlock when the module is released.</p>
      </ApprenticePageShell>
    );
  }

  const result = getModuleTopic(moduleId, topicId);

  if (!result) {
    return (
      <ApprenticePageShell
        title="Outcome not found"
        description="That learning outcome is not on this module."
        actions={
          <StepBackButton parentHref={`/apprentice/modules/${moduleId}`} />
        }
      >
        <p className={styles.empty}>Return to the module and pick an outcome again.</p>
      </ApprenticePageShell>
    );
  }

  const { module, topic, section } = result;

  return (
    <ApprenticePageShell
      title={topic.title}
      description={`${module.code} · ${module.title}`}
      actions={
        <>
          <ApprenticeStatusChip tone={topicTone(topic.status)}>
            {topicLabel(topic.status)}
          </ApprenticeStatusChip>
          <StepBackButton
            parentHref={`/apprentice/modules/${moduleId}`}
            label="Back"
          />
        </>
      }
    >
      <nav className={styles.crumb} aria-label="Breadcrumb">
        <Link href="/apprentice/modules">Modules</Link>
        <span aria-hidden>/</span>
        <Link href={`/apprentice/modules/${moduleId}`}>
          {module.code}
        </Link>
        <span aria-hidden>/</span>
        <span>{topic.title}</span>
      </nav>

      <div className={styles.stack}>
        <div className={styles.grid}>
          <div className={styles.glance}>
            <p className={styles.glanceLabel}>Signed off by</p>
            <p className={styles.glanceValueSmall}>
              {topic.signedOffBy ?? "—"}
            </p>
            <p className={styles.glanceHint}>
              {topic.signedOffRole ?? "Awaiting covering staff"}
            </p>
          </div>
          <div className={styles.glance}>
            <p className={styles.glanceLabel}>Date covered</p>
            <p className={styles.glanceValueSmall}>
              {formatModuleDate(topic.coveredAt)}
            </p>
            <p className={styles.glanceHint}>{sectionLabel(section)}</p>
          </div>
          <div className={styles.glance}>
            <p className={styles.glanceLabel}>How it was covered</p>
            <p className={styles.glanceValueSmall}>{topic.method ?? "—"}</p>
            <p className={styles.glanceHint}>Method / activity</p>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Evidence / notes</h2>
          <p className={styles.metaBlock}>
            {[topic.note, topic.evidenceSummary]
              .filter(Boolean)
              .join(" · ") ||
              (topic.status === "upcoming"
                ? "No evidence yet — this outcome has not been covered."
                : "Evidence notes will appear here once sign-off is complete.")}
          </p>
        </section>
      </div>
    </ApprenticePageShell>
  );
}
