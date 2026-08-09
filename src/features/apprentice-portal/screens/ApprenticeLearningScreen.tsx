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
  tasksForDeliveryBlock,
} from "@/features/programme-delivery/domain/published-delivery-catalogue";
import { usePublishedDeliveryCatalogue } from "@/features/programme-delivery/domain/use-published-delivery-catalogue";
import { taskKindLabel } from "@/features/programme-delivery/domain/task-schema";
import {
  getTaskServerSnapshot,
  getTaskSnapshot,
  getTaskSubmission,
  resolveTaskStoreApprenticeId,
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
  const { profile, loading: profileLoading } = useApprenticePortalProfile();
  const apprenticeId = resolveTaskStoreApprenticeId(profile.apprenticeId);
  const onGroups = profile.deliverySpine !== "blocks";
  useSyncExternalStore(
    subscribeTaskStore,
    getTaskSnapshot,
    getTaskServerSnapshot,
  );

  const { catalogue, loading: catalogueLoading } = usePublishedDeliveryCatalogue(
    {
      programmeVersionId: profile.gtaProgrammeVersionId,
      apprenticeId: profile.apprenticeId || null,
      enabled: !profileLoading && !onGroups,
    },
  );

  const taskedBlocks =
    catalogue.status === "ready"
      ? catalogue.blocks.filter(
          (b) => tasksForDeliveryBlock(catalogue, b.spineItemId).length > 0,
        )
      : [];
  const currentBlock =
    taskedBlocks.find(
      (b) =>
        b.weekStart != null &&
        b.weekEnd != null &&
        profile.programmeWeek >= b.weekStart &&
        profile.programmeWeek <= b.weekEnd,
    ) ?? taskedBlocks[0];
  const blockTasks = currentBlock
    ? tasksForDeliveryBlock(catalogue, currentBlock.spineItemId)
    : [];
  const learningPlan: LearningPlanItem[] = [];

  const spineLabel =
    profile.standardVersion != null
      ? `v${String(profile.standardVersion).replace(/^v/i, "")} · ${
          onGroups ? "Groups" : "Blocks"
        }`
      : onGroups
        ? "Groups"
        : "Blocks";

  if (!onGroups && (profileLoading || catalogueLoading)) {
    return (
      <ApprenticePageShell title="My Learning" description="Loading…">
        <p className={styles.note}>Loading published college tasks…</p>
      </ApprenticePageShell>
    );
  }

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
              {catalogue.programmeTitle || profile.programmeName}
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
        ) : catalogue.status !== "ready" ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>College tasks not ready</h2>
            <p className={styles.note}>{catalogue.message}</p>
          </section>
        ) : (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>This block · college tasks</h2>
            {blockTasks.length === 0 ? (
              <p className={styles.note}>
                No published college tasks mapped to this block yet.
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
                            {currentBlock
                              ? ` · Block ${currentBlock.displayOrdinal}`
                              : ""}
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
