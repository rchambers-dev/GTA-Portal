"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import type { LearnerSessionView } from "@/features/programme-delivery/domain/learner-session-view";
import styles from "./apprentice-pages.module.css";

function formatDelivered(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ApprenticeSessionDetailScreen({ sessionId }: { sessionId: string }) {
  const [view, setView] = useState<LearnerSessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [extractNote, setExtractNote] = useState("");
  const [extractText, setExtractText] = useState("");
  const [extractLoading, setExtractLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(
      `/api/apprentice/learning/sessions/${encodeURIComponent(sessionId)}`,
    )
      .then(async (res) => {
        const json = (await res.json()) as {
          ok: boolean;
          session?: LearnerSessionView;
          error?: string;
        };
        if (cancelled) return;
        if (!json.ok || !json.session) {
          setError(json.error || "Session not found.");
          setLoading(false);
          return;
        }
        setView(json.session);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load Session.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function openResource(resourceId: string) {
    setOpenId(resourceId);
    setExtractLoading(true);
    setExtractNote("");
    setExtractText("");
    try {
      const res = await fetch(
        `/api/apprentice/learning/resources/${encodeURIComponent(resourceId)}`,
      );
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        note?: string;
        extractText?: string;
        binaryAvailableInApp?: boolean;
      };
      if (!json.ok) throw new Error(json.error || "Could not open resource.");
      setExtractNote(json.note || "");
      setExtractText(json.extractText || "");
    } catch (err) {
      setExtractNote(
        err instanceof Error ? err.message : "Could not open resource.",
      );
    } finally {
      setExtractLoading(false);
    }
  }

  if (loading) {
    return (
      <ApprenticePageShell title="Session" description="Loading…">
        <p className={styles.note}>Loading Session…</p>
      </ApprenticePageShell>
    );
  }

  if (error || !view) {
    return (
      <ApprenticePageShell title="Session" description="Unavailable">
        <p className={styles.note} role="alert">
          {error || "Session not found."}
        </p>
        <p>
          <Link href="/apprentice/learning" className={styles.linkish}>
            ← My Learning
          </Link>
        </p>
      </ApprenticePageShell>
    );
  }

  const tone =
    view.status === "completed"
      ? "green"
      : view.status === "current"
        ? "amber"
        : "neutral";

  return (
    <ApprenticePageShell title={view.title} description={view.codesLine}>
      <div className={styles.stack}>
        <p>
          <Link href="/apprentice/learning" className={styles.linkish}>
            ← My Learning
          </Link>
        </p>

        <div className={styles.purposeBox}>
          <p className={styles.purposeLead}>{view.title}</p>
          <p className={styles.purposeBody}>{view.codesLine}</p>
          <ApprenticeStatusChip tone={tone}>{view.statusLabel}</ApprenticeStatusChip>
          {view.deliveredAt ? (
            <p className={styles.meta}>
              Delivered {formatDelivered(view.deliveredAt)}
            </p>
          ) : null}
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What you learned</h2>
          <p className={styles.note} style={{ whiteSpace: "pre-wrap" }}>
            {view.learningInformation}
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Activity / practice</h2>
          <p className={styles.note} style={{ whiteSpace: "pre-wrap" }}>
            {view.activityPractice}
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {view.status === "completed" ? "Review learning" : "Learning materials"}
          </h2>
          {view.status === "completed" && view.hasApprovedLearning ? (
            <p className={styles.meta}>
              You can come back to this Session any time to recap what you
              covered.
            </p>
          ) : null}
          {view.materials.length === 0 ? (
            <p className={styles.note}>
              No extra learning materials have been added for this Session yet.
            </p>
          ) : (
            <ul className={styles.list}>
              {view.materials.map((m) => (
                <li key={m.id}>
                  <div className={styles.rowLink}>
                    <div className={styles.rowMain}>
                      <strong>{m.title}</strong>
                      <span>{m.purposeLabel}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.linkish}
                      onClick={() => void openResource(m.id)}
                    >
                      {view.status === "completed"
                        ? "Review resource"
                        : "Open resource"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {openId ? (
            <div className={styles.purposeBox} style={{ marginTop: "1rem" }}>
              {extractLoading ? (
                <p className={styles.note}>Opening resource…</p>
              ) : (
                <>
                  <p className={styles.meta}>{extractNote}</p>
                  {extractText ? (
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        fontSize: "0.9rem",
                        margin: 0,
                      }}
                    >
                      {extractText}
                    </pre>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tasks &amp; evidence</h2>
          <p className={styles.note}>
            Formal tasks for this block are listed separately. They are not the
            same as the activity you do in this Session.
          </p>
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
