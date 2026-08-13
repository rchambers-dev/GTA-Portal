"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import type { ApprenticeLearningJourney } from "@/features/programme-delivery/domain/apprentice-learning";
import styles from "./apprentice-pages.module.css";

function formatDelivered(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function chipTone(
  status: "completed" | "current" | "upcoming",
): "green" | "amber" | "neutral" {
  if (status === "completed") return "green";
  if (status === "current") return "amber";
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
    journey.blocks.find((b) => b.sessions.some((s) => s.status === "current")) ??
    journey.blocks[0];

  return (
    <ApprenticePageShell
      title="My Learning"
      description="Follow your learning journey, see what is coming next and return to completed Sessions to review your learning."
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

              {block.sessions.length === 0 ? (
                <p className={styles.note}>
                  Sessions for this part of your programme are not listed yet.
                </p>
              ) : (
                <ul className={styles.list}>
                  {block.sessions.map((session) => (
                    <li key={session.id}>
                      <Link
                        href={`/apprentice/learning/${session.id}`}
                        className={styles.rowLink}
                        data-tone={
                          session.status === "completed"
                            ? "green"
                            : session.status === "current"
                              ? "amber"
                              : "navy"
                        }
                      >
                        <div className={styles.rowMain}>
                          <strong>{session.title}</strong>
                          <span>
                            {session.codesLine}
                            {session.status === "completed" && session.deliveredAt
                              ? ` · ${formatDelivered(session.deliveredAt)}`
                              : ""}
                            {session.reviewLearning ? " · Review learning" : ""}
                          </span>
                        </div>
                        <div className={styles.rowEnd}>
                          <ApprenticeStatusChip tone={chipTone(session.status)}>
                            {session.statusLabel}
                          </ApprenticeStatusChip>
                          <span className={styles.linkish}>Open →</span>
                        </div>
                      </Link>
                    </li>
                  ))}
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
