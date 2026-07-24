import Link from "next/link";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "../components/LearnerPageShell";
import {
  ALEX_LEARNING,
  ALEX_PROFILE,
  getAlexActiveLearningModules,
  learningKindLabel,
  type LearningPlanItem,
  type LearningPlanItemKind,
} from "../domain/mock-learner";
import styles from "./learner-pages.module.css";

function kindTone(kind: LearningPlanItemKind) {
  switch (kind) {
    case "cea":
      return "amber" as const;
    case "otj":
      return "blue" as const;
    case "review":
      return "green" as const;
    default:
      return "neutral" as const;
  }
}

function PlanItem({ item }: { item: LearningPlanItem }) {
  return (
    <li>
      <Link href={item.href} className={styles.rowLink}>
        <div className={styles.rowMain}>
          <strong>{item.title}</strong>
          <span>{item.detail}</span>
        </div>
        <div className={styles.rowEnd}>
          <LearnerStatusChip tone={kindTone(item.kind)}>
            {learningKindLabel(item.kind)}
          </LearnerStatusChip>
          <span className={styles.linkish}>{item.hrefLabel} →</span>
        </div>
      </Link>
    </li>
  );
}

export function LearnerLearningScreen() {
  const activeModules = getAlexActiveLearningModules();

  return (
    <LearnerPageShell
      title="My Learning"
      description={ALEX_LEARNING.purpose}
    >
      <div className={styles.stack}>
        <div className={styles.purposeBox}>
          <p className={styles.purposeLead}>
            <strong>{ALEX_LEARNING.weekLabel}</strong>
            {" · "}
            {ALEX_PROFILE.programmeName}
            {" · "}
            College {ALEX_PROFILE.collegeDays}
          </p>
          <p className={styles.purposeBody}>{ALEX_LEARNING.notes}</p>
          <p className={styles.purposeHint}>
            Modules is your full catalogue. This page is only what you should
            focus on <em>now</em> — college, workplace, CEA tasks, and OTJ.
          </p>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Active modules</h2>
          <p className={styles.meta}>
            Released modules you are currently covering with{" "}
            {ALEX_PROFILE.tutorName}.
          </p>
          {activeModules.length === 0 ? (
            <p className={styles.empty}>No modules in progress right now.</p>
          ) : (
            <ul className={styles.list}>
              {activeModules.map((mod) => (
                <li key={mod.id}>
                  <Link href={`/learner/modules/${mod.id}`} className={styles.rowLink}>
                    <div className={styles.rowMain}>
                      <strong>
                        {mod.code} · {mod.title}
                      </strong>
                      <span>{mod.tutorFocus}</span>
                      <span>
                        {mod.covered.length} covered · {mod.upcoming.length} still
                        to cover
                      </span>
                    </div>
                    <div className={styles.rowEnd}>
                      <LearnerStatusChip tone="blue">In progress</LearnerStatusChip>
                      <span className={styles.linkish}>Open coverage →</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Do this week</h2>
          <p className={styles.meta}>
            Concrete tasks for this focus period. Each one links to where you
            complete it.
          </p>
          <ul className={styles.list}>
            {ALEX_LEARNING.thisWeek.map((item) => (
              <PlanItem key={item.id} item={item} />
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Looking ahead</h2>
          <p className={styles.meta}>
            Next priorities once this week&apos;s plan is under control.
          </p>
          <ul className={styles.list}>
            {ALEX_LEARNING.lookingAhead.map((item) => (
              <PlanItem key={item.id} item={item} />
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Related</h2>
          <div className={styles.shortcuts}>
            <Link className={styles.shortcut} href="/learner/modules">
              All modules
            </Link>
            <Link className={styles.shortcut} href="/learner/cea">
              CEA tasks
            </Link>
            <Link className={styles.shortcut} href="/learner/otj">
              OTJ hours
            </Link>
            <Link className={styles.shortcut} href="/learner/reviews">
              Reviews
            </Link>
          </div>
        </section>
      </div>
    </LearnerPageShell>
  );
}
