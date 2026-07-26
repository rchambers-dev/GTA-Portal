"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "../components/LearnerPageShell";
import {
  ALEX_LEARNING,
  ALEX_PROFILE,
  learningKindLabel,
  type LearningPlanItem,
  type LearningPlanItemKind,
} from "../domain/mock-learner";
import { AUTOCARE_BLOCKS, AUTOCARE_STANDARD } from "@/features/programme-delivery/domain/autocare-blocks";
import { tasksForBlock } from "@/features/programme-delivery/domain/autocare-tasks";
import {
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  statusLabel,
  statusTone,
  subscribeTaskStore,
} from "@/features/programme-delivery/domain/task-submission-store";
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

/**
 * My Learning — focus plan for Autocare blocks / college tasks / OTJ.
 * Lesson plans are tutor-only; apprentices work practicals + reflections.
 */
export function LearnerLearningScreen() {
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
    <LearnerPageShell
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
                      href={`/learner/college-tasks/${task.id}`}
                      className={styles.rowLink}
                    >
                      <div className={styles.rowMain}>
                        <strong>{task.title}</strong>
                        <span>
                          {task.evidenceRef} · {task.kind} · ~
                          {task.estimatedMinutes} min
                        </span>
                      </div>
                      <div className={styles.rowEnd}>
                        <LearnerStatusChip tone={statusTone(sub.status)}>
                          {statusLabel(sub.status)}
                        </LearnerStatusChip>
                        <span className={styles.linkish}>Open →</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className={styles.meta} style={{ marginTop: "0.75rem" }}>
            <Link className={styles.linkish} href="/learner/college-tasks">
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
            <Link className={styles.shortcut} href="/learner/college-tasks">
              College tasks
            </Link>
            <Link className={styles.shortcut} href="/learner/otj">
              OTJ hours
            </Link>
            <Link className={styles.shortcut} href="/learner/reviews">
              Reviews
            </Link>
            <Link className={styles.shortcut} href="/learner/progress">
              Progress
            </Link>
          </div>
        </section>
      </div>
    </LearnerPageShell>
  );
}
