"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import { useApprenticePortalProfile } from "../hooks/useApprenticePortalProfile";
import {
  learningKindLabel,
  type LearningPlanItem,
  type LearningPlanItemKind,
} from "../domain/apprentice-profile";
import {
  AUTOCARE_BLOCKS,
  AUTOCARE_STANDARD,
} from "@/features/programme-delivery/domain/autocare-blocks";
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

export function ApprenticeLearningScreen() {
  const { profile } = useApprenticePortalProfile();
  const apprenticeId = profile.apprenticeId || "live-apprentice";
  const onGroups = profile.deliverySpine !== "blocks";
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
        profile.programmeWeek >= b.weekStart &&
        profile.programmeWeek <= b.weekEnd,
    ) ?? AUTOCARE_BLOCKS[0];

  const blockTasks = tasksForBlock(currentBlock.id);
  const learningPlan: LearningPlanItem[] = [];

  const spineLabel =
    profile.standardVersion != null
      ? `v${String(profile.standardVersion).replace(/^v/i, "")} · ${
          onGroups ? "Groups" : "Blocks"
        }`
      : onGroups
        ? "Groups"
        : "Blocks";

  return (
    <ApprenticePageShell
      title="My Learning"
      description={`${profile.programmeName} · Week ${profile.programmeWeek}. ${
        onGroups
          ? "Personal tracking groups and OTJ."
          : "College practicals, block reflections, and OTJ."
      }`}
    >
      <div className={styles.stack}>
        <div className={styles.purposeBox}>
          <p className={styles.purposeLead}>
            <strong>
              {profile.programmeName}
            </strong>
            {" · "}
            {spineLabel}
            {" · "}
            Week {profile.programmeWeek}
          </p>
          <p className={styles.purposeBody}>
            College {profile.collegeDays}
            {profile.cohortName ? ` · ${profile.cohortName}` : ""}.
          </p>
        </div>

        {onGroups ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Personal tracking</h2>
            <p className={styles.note}>
              You are on the groups delivery spine. Open personal tracking for
              groups and workplace tasks released by your tutor.
            </p>
            <p>
              <Link href="/apprentice/tracking" className={styles.linkish}>
                Open personal tracking →
              </Link>
            </p>
          </section>
        ) : (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>This block · college tasks</h2>
            {blockTasks.length === 0 ? (
              <p className={styles.note}>
                No college tasks mapped to this block yet.
              </p>
            ) : (
              <ul className={styles.list}>
                {blockTasks.map((task) => {
                  const submission = getTaskSubmission(task.id, apprenticeId);
                  return (
                    <li key={task.id}>
                      <Link
                        href={`/apprentice/tracking/${task.id}`}
                        className={styles.rowLink}
                      >
                        <div className={styles.rowMain}>
                          <strong>{task.title}</strong>
                          <span className={styles.meta}>
                            {taskKindLabel(task.kind)}
                          </span>
                        </div>
                        <ApprenticeStatusChip tone={statusTone(submission.status)}>
                          {statusLabel(submission.status)}
                        </ApprenticeStatusChip>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Focus plan</h2>
          {learningPlan.length === 0 ? (
            <p className={styles.note}>
              Your focus plan will build here as tasks, OTJ, and reviews are
              logged.
            </p>
          ) : (
            <ul className={styles.list}>
              {learningPlan.map((item) => (
                <PlanItem key={item.id} item={item} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </ApprenticePageShell>
  );
}
