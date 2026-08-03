import Link from "next/link";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import { StepBackButton } from "../components/StepBackButton";
import {
  formatModuleDate,
  getModuleDetail,
  BLANK_MODULES,
  BLANK_APPRENTICE_PROFILE,
  type ModuleTopic,
} from "../domain/apprentice-profile";
import styles from "./apprentice-pages.module.css";

function statusTone(status: "completed" | "in_progress" | "remaining") {
  switch (status) {
    case "completed":
      return "green" as const;
    case "in_progress":
      return "blue" as const;
    default:
      return "neutral" as const;
  }
}

function statusLabel(status: "completed" | "in_progress" | "remaining") {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    default:
      return "Remaining";
  }
}

function TopicList({
  moduleId,
  title,
  empty,
  topics,
}: {
  moduleId: string;
  title: string;
  empty: string;
  topics: ModuleTopic[];
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {title}
        <span className={styles.meta}> · {topics.length}</span>
      </h2>
      {topics.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <ul className={styles.list}>
          {topics.map((topic) => (
            <li key={topic.id}>
              <Link
                href={`/apprentice/modules/${moduleId}/${topic.id}`}
                className={styles.rowLink}
              >
                <div className={styles.rowMain}>
                  <strong>{topic.title}</strong>
                  {topic.note ? <span>{topic.note}</span> : null}
                  <span>
                    {topic.signedOffBy
                      ? `Signed off by ${topic.signedOffBy}${
                          topic.signedOffRole ? ` (${topic.signedOffRole})` : ""
                        }`
                      : topic.status === "upcoming"
                        ? "Not signed off yet"
                        : "Sign-off pending"}
                  </span>
                  <span>Covered: {formatModuleDate(topic.coveredAt)}</span>
                </div>
                <div className={styles.rowEnd}>
                  <ApprenticeStatusChip
                    tone={
                      topic.status === "covered"
                        ? "green"
                        : topic.status === "in_progress"
                          ? "blue"
                          : "neutral"
                    }
                  >
                    {topic.status === "covered"
                      ? "Covered"
                      : topic.status === "in_progress"
                        ? "In progress"
                        : "Upcoming"}
                  </ApprenticeStatusChip>
                  <span className={styles.linkish}>Open →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ApprenticeModuleDetailScreen({ moduleId }: { moduleId: string }) {
  const mod = getModuleDetail(moduleId);
  const row = BLANK_MODULES.find((m) => m.id === moduleId);

  if (row && !row.released) {
    return (
      <ApprenticePageShell
        title={`${row.code} · ${row.title}`}
        description="Your tutor has not released this module yet."
        actions={<StepBackButton parentHref="/apprentice/modules" />}
      >
        <p className={styles.note}>
          This module is on your {BLANK_APPRENTICE_PROFILE.programmeName} programme map so you
          can see what is coming next. It will unlock when{" "}
          {BLANK_APPRENTICE_PROFILE.tutorName} releases it for your group.
        </p>
        <p className={styles.empty}>Not released — not clickable from the list.</p>
      </ApprenticePageShell>
    );
  }

  if (!mod) {
    return (
      <ApprenticePageShell
        title="Module not found"
        description="That module is not on your current programme year list."
        actions={<StepBackButton parentHref="/apprentice/modules" />}
      >
        <p className={styles.empty}>Check the modules list and try again.</p>
      </ApprenticePageShell>
    );
  }

  return (
    <ApprenticePageShell
      title={`${mod.code} · ${mod.title}`}
      description={mod.summary}
      actions={
        <>
          <ApprenticeStatusChip tone={statusTone(mod.status)}>
            {statusLabel(mod.status)}
          </ApprenticeStatusChip>
          <StepBackButton parentHref="/apprentice/modules" label="Back" />
        </>
      }
    >
      <nav className={styles.crumb} aria-label="Breadcrumb">
        <Link href="/apprentice/modules">Modules</Link>
        <span aria-hidden>/</span>
        <span>
          {mod.code}
        </span>
      </nav>

      <div className={styles.stack}>
        <div className={styles.grid}>
          <div className={styles.glance}>
            <p className={styles.glanceLabel}>Covered</p>
            <p className={styles.glanceValue}>{mod.covered.length}</p>
            <p className={styles.glanceHint}>Outcomes in this module</p>
          </div>
          <div className={styles.glance}>
            <p className={styles.glanceLabel}>Previously covered</p>
            <p className={styles.glanceValue}>{mod.previouslyCovered.length}</p>
            <p className={styles.glanceHint}>Earlier / carried forward</p>
          </div>
          <div className={styles.glance}>
            <p className={styles.glanceLabel}>Still to cover</p>
            <p className={styles.glanceValue}>{mod.upcoming.length}</p>
            <p className={styles.glanceHint}>Year {mod.year}</p>
          </div>
        </div>

        <TopicList
          moduleId={mod.id}
          title="Covered"
          empty="Nothing marked covered in this module yet."
          topics={mod.covered}
        />
        <TopicList
          moduleId={mod.id}
          title="Previously covered"
          empty="No earlier topics linked to this module."
          topics={mod.previouslyCovered}
        />
        <TopicList
          moduleId={mod.id}
          title="Still to cover"
          empty="All planned outcomes for this module are done."
          topics={mod.upcoming}
        />
      </div>
    </ApprenticePageShell>
  );
}
