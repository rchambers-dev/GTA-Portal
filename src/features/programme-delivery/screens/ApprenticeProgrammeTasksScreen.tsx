"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import type { ApprenticeLearningJourney } from "../domain/apprentice-learning";
import styles from "./programme-delivery.module.css";

export function ApprenticeProgrammeTasksScreen() {
  const [journey, setJourney] = useState<ApprenticeLearningJourney | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
          setError(json.error || "Could not load Tasks.");
          setLoading(false);
          return;
        }
        setJourney(json.journey);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load Tasks.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <ApprenticePageShell
        title="Tasks & evidence"
        description="Loading your tasks…"
      >
        <p className={styles.purposeBody}>Loading…</p>
      </ApprenticePageShell>
    );
  }

  if (error || !journey) {
    return (
      <ApprenticePageShell title="Tasks & evidence" description="Unavailable">
        <p className={styles.purposeBody} role="alert">
          {error || "Your tasks are not available yet."}
        </p>
      </ApprenticePageShell>
    );
  }

  return (
    <ApprenticePageShell
      title="Tasks & evidence"
      description="These tasks help you demonstrate your learning. Your tutor will let you know when each task is ready to complete."
    >
      <div className={styles.root}>
        <p className={styles.purposeBody}>
          <Link href="/apprentice/learning">← My Learning</Link>
        </p>
        <div className={styles.blockList}>
          {journey.blocks.map((block) => (
            <article key={block.spineItemId} className={styles.blockCard}>
              <h2 className={styles.blockTitle}>{block.displayTitle}</h2>
              {block.tasks.length === 0 ? (
                <p className={styles.blockMeta}>
                  No tasks are listed for this block yet.
                </p>
              ) : (
                <ul className={styles.taskList}>
                  {block.tasks.map((task) => (
                    <li key={task.id}>
                      <div className={styles.taskRow}>
                        <div className={styles.taskMain}>
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
              )}
            </article>
          ))}
        </div>
      </div>
    </ApprenticePageShell>
  );
}
