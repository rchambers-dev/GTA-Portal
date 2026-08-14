"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import { useApprenticePortalProfile } from "../hooks/useApprenticePortalProfile";
import type { ApprenticeLearningJourney } from "@/features/programme-delivery/domain/apprentice-learning";
import styles from "./apprentice-pages.module.css";

export function ApprenticeProgressScreen() {
  const { profile, loading: profileLoading } = useApprenticePortalProfile();
  const [journey, setJourney] = useState<ApprenticeLearningJourney | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/apprentice/learning")
      .then(async (res) => {
        const json = (await res.json()) as {
          ok: boolean;
          journey?: ApprenticeLearningJourney;
          error?: string;
        };
        if (cancelled) return;
        if (!json.ok || !json.journey) {
          setError(json.error || "Could not load progress.");
          return;
        }
        setJourney(json.journey);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load progress.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sessions = journey?.blocks.flatMap((b) => b.sessions) ?? [];
  const available = sessions.filter((s) => s.status === "available").length;
  const nextUp = sessions.find((s) => s.status === "coming_up" && s.openable === false);
  const currentBlock =
    journey?.blocks.find((b) =>
      b.sessions.some((s) => s.status === "available" && s.openable),
    ) ??
    journey?.blocks.find((b) => b.unlocked) ??
    journey?.blocks[0];
  const blockTasks = currentBlock?.tasks ?? [];

  if (profileLoading && !journey) {
    return (
      <ApprenticePageShell title="Progress" description="Loading…">
        <p className={styles.meta}>Loading your progress…</p>
      </ApprenticePageShell>
    );
  }

  return (
    <ApprenticePageShell
      title="Progress"
      description="A simple snapshot of where you are. Open My Learning for the full journey."
    >
      <div className={styles.stack}>
        {error ? (
          <p className={styles.note} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.grid}>
          <div className={styles.glance} data-tone="navy">
            <p className={styles.glanceLabel}>Current block</p>
            <p className={styles.glanceValueSmall}>
              {currentBlock?.displayTitle || "—"}
            </p>
            <p className={styles.glanceHint}>
              Week {profile.programmeWeek || journey?.programmeWeek || "—"}
            </p>
          </div>
          <div className={styles.glance} data-tone="green">
            <p className={styles.glanceLabel}>Sessions available</p>
            <p className={styles.glanceValue}>
              {journey ? `${available}/${sessions.length || 0}` : "—"}
            </p>
            <p className={styles.glanceHint}>
              Available means your tutor has released this learning
            </p>
          </div>
          <div className={styles.glance} data-tone="amber">
            <p className={styles.glanceLabel}>Coming up</p>
            <p className={styles.glanceValueSmall}>
              {nextUp ? nextUp.title : "—"}
            </p>
            <p className={styles.glanceHint}>
              {nextUp ? nextUp.codesLine : "No upcoming Session listed"}
            </p>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.dashSectionTitle} data-accent="green">
            My Learning
          </h2>
          <p className={styles.meta}>
            See which Sessions are available and review released learning.
          </p>
          <p>
            <Link href="/apprentice/learning" className={styles.linkish}>
              Open My Learning →
            </Link>
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.dashSectionTitle} data-accent="navy">
            Tasks &amp; evidence
          </h2>
          <p className={styles.meta}>
            These tasks help you demonstrate your learning. Your tutor will let
            you know when each task is ready to complete.
          </p>
          {blockTasks.length > 0 ? (
            <ul className={styles.list}>
              {blockTasks.map((task) => (
                <li key={task.id}>
                  <div className={styles.rowLink}>
                    <div className={styles.rowMain}>
                      <strong>
                        Task {task.taskNumber}: {task.title}
                      </strong>
                    </div>
                    <ApprenticeStatusChip tone="neutral">
                      Coming up
                    </ApprenticeStatusChip>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.meta}>No tasks are listed yet.</p>
          )}
          <p>
            <Link href="/apprentice/tracking" className={styles.linkish}>
              Open Tasks &amp; evidence →
            </Link>
          </p>
        </section>
      </div>
    </ApprenticePageShell>
  );
}
