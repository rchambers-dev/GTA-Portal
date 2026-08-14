"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import type { ApprenticeLearningJourney } from "@/features/programme-delivery/domain/apprentice-learning";
import styles from "./apprentice-pages.module.css";

function chipTone(
  status: "coming_up" | "available",
): "green" | "neutral" {
  if (status === "available") return "green";
  return "neutral";
}

export function ApprenticeLearningScreen() {
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
          setError(json.error || "Could not load My Learning.");
          setLoading(false);
          return;
        }
        setJourney(json.journey);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load My Learning.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <ApprenticePageShell title="My Learning" description="Loading…">
        <p className={styles.note}>Loading your learning journey…</p>
      </ApprenticePageShell>
    );
  }

  if (error || !journey) {
    return (
      <ApprenticePageShell title="My Learning" description="Unavailable">
        <p className={styles.note} role="alert">
          {error || "Your learning journey is not available yet."}
        </p>
      </ApprenticePageShell>
    );
  }

  const focusBlock =
    journey.blocks.find((b) =>
      b.sessions.some((s) => s.status === "available" && s.openable),
    ) ??
    journey.blocks.find((b) => b.unlocked) ??
    journey.blocks[0];

  return (
    <ApprenticePageShell
      title="My Learning"
      description="Follow your learning journey. Sessions become available when your tutor releases them. You can come back to released learning any time."
    >
      <div className={styles.stack}>
        {journey.isTest ? (
          <p className={styles.note}>Training record · {journey.displayName}</p>
        ) : null}

        {journey.blocks.map((block) => {
          const isFocus = focusBlock?.spineItemId === block.spineItemId;
          return (
            <section key={block.spineItemId} className={styles.section}>
              <h2 className={styles.dashSectionTitle} data-accent="navy">
                {block.displayTitle}
              </h2>
              <p className={styles.meta}>
                {block.weekStart != null && block.weekEnd != null
                  ? `Weeks ${block.weekStart}–${block.weekEnd}`
                  : ""}
                {block.plannedOtjHours > 0
                  ? `${block.weekStart != null ? " · " : ""}${block.plannedOtjHours} planned off-the-job training hours`
                  : ""}
              </p>

              {!block.unlocked ? (
                <p className={styles.note}>
                  Coming up
                  {block.weekStart != null
                    ? ` — this Block opens from week ${block.weekStart}`
                    : ""}
                  . You can see the Sessions that are planned; the learning
                  content opens when this part of your programme starts.
                </p>
              ) : null}

              {block.sessions.length === 0 ? (
                <p className={styles.note}>
                  Sessions for this part of your programme are not listed yet.
                </p>
              ) : (
                <ul className={styles.list}>
                  {block.sessions.map((session) => {
                    const tone =
                      session.status === "available" ? "green" : "navy";
                    const body = (
                      <>
                        <div className={styles.rowMain}>
                          <strong>{session.title}</strong>
                          <span>
                            {session.codesLine}
                            {session.reviewLearning ? " · Review learning" : ""}
                          </span>
                        </div>
                        <div className={styles.rowEnd}>
                          <ApprenticeStatusChip
                            tone={
                              session.openable
                                ? chipTone(session.status)
                                : "neutral"
                            }
                          >
                            {session.openable
                              ? session.statusLabel
                              : "Coming up"}
                          </ApprenticeStatusChip>
                          {session.openable ? (
                            <span className={styles.linkish}>Open →</span>
                          ) : null}
                        </div>
                      </>
                    );
                    return (
                      <li key={session.id}>
                        {session.openable ? (
                          <Link
                            href={`/apprentice/learning/${session.id}`}
                            className={styles.rowLink}
                            data-tone={tone}
                          >
                            {body}
                          </Link>
                        ) : (
                          <div
                            className={`${styles.rowLink} ${styles.rowLocked}`}
                            data-tone="navy"
                          >
                            {body}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {isFocus ? (
                <div className={styles.purposeBox} style={{ marginTop: "1rem" }}>
                  <p className={styles.purposeLead}>Tasks &amp; evidence</p>
                  <p className={styles.purposeBody}>
                    These tasks help you demonstrate your learning during this
                    block. Your tutor will let you know when each task is ready
                    to complete.
                  </p>
                  <ul className={styles.list}>
                    {block.tasks.map((task) => (
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
                  <p>
                    <Link href="/apprentice/tracking" className={styles.linkish}>
                      Open all Tasks &amp; evidence →
                    </Link>
                  </p>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </ApprenticePageShell>
  );
}
