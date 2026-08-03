"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import {
  ALEX_LEARNING,
  ALEX_PROFILE,
  learningKindLabel,
  type LearningPlanItem,
  type LearningPlanItemKind,
} from "../domain/mock-apprentice";
import { AUTOCARE_BLOCKS, AUTOCARE_STANDARD } from "@/features/programme-delivery/domain/autocare-blocks";
import { tasksForBlock } from "@/features/programme-delivery/domain/autocare-tasks";
import { taskKindLabel } from "@/features/programme-delivery/domain/task-schema";
import {
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  statusLabel,
  statusTone,
  subscribeTaskStore,
} from "@/features/programme-delivery/domain/task-submission-store";
import styles from "./apprentice-pages.module.css";

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
          <ApprenticeStatusChip tone={kindTone(item.kind)}>
            {learningKindLabel(item.kind)}
          </ApprenticeStatusChip>
          <span className={styles.linkish}>{item.hrefLabel} →</span>
        </div>
      </Link>
    </li>
  );
}

/**
 * My Learning — focus plan for Autocare blocks / college tasks / OTJ.
 * Lesson plans are tutor-only; apprentices work practicals + reflections.
 */
export function ApprenticeLearningScreen() {
  useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );

  const currentBlock =
    AUTOCARE_BLOCKS.find(
      (b) =>
        b.kind === "training" &&
        b.weekStart != null &&
        b.weekEnd != null &&
        ALEX_PROFILE.programmeWeek >= b.weekStart &&
        ALEX_PROFILE.programmeWeek <= b.weekEnd,
    ) ?? AUTOCARE_BLOCKS[0];

  const blockTasks = tasksForBlock(currentBlock.id);

  return (
    <ApprenticePageShell
      title="My Learning"
      description="Your Autocare plan this week — college practicals, block reflections, and OTJ. Lesson plans stay with your tutor."
    >
      <div className={styles.stack}>
        <div className={styles.purposeBox}>
          <p className={styles.purposeLead}>
            <strong>
              Week {ALEX_PROFILE.programmeWeek}
            </strong>
            {" · "}
            {AUTOCARE_STANDARD.label} · {AUTOCARE_STANDARD.code}{" "}
            {AUTOCARE_STANDARD.version}
            {" · "}
            College {ALEX_PROFILE.collegeDays}
          </p>
          <p className={styles.purposeBody}>{ALEX_LEARNING.notes}</p>
          <p className={styles.purposeHint}>
            Preferred: complete tasks in the portal. If you could not get on at
            college, upload every PDF needed for that day — each to its own
            task.
          </p>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Current block · Block {currentBlock.id}
          </h2>
          <p className={styles.meta}>
            {currentBlock.name}
            {currentBlock.weekStart != null
              ? ` · Weeks ${currentBlock.weekStart}–${currentBlock.weekEnd}`
              : ""}
            {" · "}
            {currentBlock.plannedOtjHours} hrs planned OTJ
          </p>
          {blockTasks.length === 0 ? (
            <p className={styles.empty}>
              Practical tasks for this block are not in the portal yet.
            </p>
          ) : (
            <ul className={styles.list}>
              {blockTasks.map((task) => {
                const sub = getTaskSubmission(task.id);
                return (
                  <li key={task.id}>
                    <Link
                      href={`/apprentice/college-tasks/${task.id}`}
                      className={styles.rowLink}
                    >
                      <div className={styles.rowMain}>
                        <strong>{task.title}</strong>
                        <span>
                          {task.evidenceRef} · {taskKindLabel(task.kind)} · ~
                          {task.estimatedMinutes} min
                        </span>
                      </div>
                      <div className={styles.rowEnd}>
                        <ApprenticeStatusChip tone={statusTone(sub.status)}>
                          {statusLabel(sub.status)}
                        </ApprenticeStatusChip>
                        <span className={styles.linkish}>Open →</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className={styles.meta} style={{ marginTop: "0.75rem" }}>
            <Link className={styles.linkish} href="/apprentice/college-tasks">
              All blocks and college tasks →
            </Link>
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Do this week</h2>
          <p className={styles.meta}>
            Concrete priorities for this focus period.
          </p>
          <ul className={styles.list}>
            {ALEX_LEARNING.thisWeek.map((item) => (
              <PlanItem key={item.id} item={item} />
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Looking ahead</h2>
          <ul className={styles.list}>
            {ALEX_LEARNING.lookingAhead.map((item) => (
              <PlanItem key={item.id} item={item} />
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Related</h2>
          <div className={styles.shortcuts}>
            <Link className={styles.shortcut} href="/apprentice/college-tasks">
              College tasks
            </Link>
            <Link className={styles.shortcut} href="/apprentice/otj">
              OTJ hours
            </Link>
            <Link className={styles.shortcut} href="/apprentice/reviews">
              Reviews
            </Link>
            <Link className={styles.shortcut} href="/apprentice/progress">
              Progress
            </Link>
          </div>
        </section>
      </div>
    </ApprenticePageShell>
  );
}
