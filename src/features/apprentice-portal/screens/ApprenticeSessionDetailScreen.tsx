"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import type { LearnerSessionView } from "@/features/programme-delivery/domain/learner-session-view";
import { ResourcePreviewViewer } from "@/features/programme-delivery/components/ResourcePreviewViewer";
import styles from "./apprentice-pages.module.css";

function formatReleased(iso: string | null): string {
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
  const [viewerId, setViewerId] = useState<string | null>(null);
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

  const tone = view.status === "available" ? "green" : "neutral";
  const allMaterials = [...view.materials, ...view.reviewMaterials];
  const opened = allMaterials.find((m) => m.id === openId) ?? null;
  const viewing = allMaterials.find((m) => m.id === viewerId) ?? null;

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
          {view.releasedAt ? (
            <p className={styles.meta}>
              Available since {formatReleased(view.releasedAt)}
            </p>
          ) : null}
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What you will learn</h2>
          <p className={styles.note} style={{ whiteSpace: "pre-wrap" }}>
            {view.learningInformation}
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Learning materials</h2>
          <p className={styles.meta}>These are the materials for this lesson.</p>
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
                      <span>{m.kindLabel}</span>
                      <strong>{m.title}</strong>
                      {m.previewUnavailableNote ? (
                        <span className={styles.meta}>{m.previewUnavailableNote}</span>
                      ) : null}
                      {m.unavailableNote ? (
                        <span className={styles.meta}>{m.unavailableNote}</span>
                      ) : null}
                    </div>
                    {m.openMode === "preview" ? (
                      <button
                        type="button"
                        className={styles.linkish}
                        onClick={() => setViewerId(m.id)}
                      >
                        {m.openLabel}
                      </button>
                    ) : m.openMode === "download" ? (
                      <a
                        className={styles.linkish}
                        href={`/api/apprentice/learning/resources/${encodeURIComponent(m.id)}/file?download=1`}
                      >
                        {m.openLabel}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={styles.linkish}
                        onClick={() => void openResource(m.id)}
                      >
                        {m.openLabel}
                      </button>
                    )}
                    {m.downloadLabel ? (
                      <a
                        className={styles.linkish}
                        href={`/api/apprentice/learning/resources/${encodeURIComponent(m.id)}/file?download=1`}
                      >
                        {m.downloadLabel}
                      </a>
                    ) : null}
                    {m.extractAvailable && m.openMode !== "extract" ? (
                      <button
                        type="button"
                        className={styles.linkish}
                        onClick={() => void openResource(m.id)}
                      >
                        {m.extractLabel || "View extract"}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {viewing ? (
            viewing.viewerKind === "pdf" || viewing.viewerKind === "video" ? (
              <div style={{ marginTop: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                  <strong>{viewing.title}</strong>
                  <button
                    type="button"
                    className={styles.linkish}
                    onClick={() => setViewerId(null)}
                  >
                    Close
                  </button>
                </div>
                {viewing.viewerKind === "pdf" ? (
                  <iframe
                    title={viewing.title}
                    src={`/api/apprentice/learning/resources/${encodeURIComponent(viewing.id)}/file`}
                    style={{ width: "100%", minHeight: "70vh", border: 0, marginTop: "0.75rem" }}
                  />
                ) : (
                  <video
                    controls
                    src={`/api/apprentice/learning/resources/${encodeURIComponent(viewing.id)}/file`}
                    style={{ width: "100%", marginTop: "0.75rem" }}
                  />
                )}
              </div>
            ) : (
              <ResourcePreviewViewer
                title={viewing.title}
                previewApi={`/api/apprentice/learning/resources/${encodeURIComponent(viewing.id)}/preview`}
                slideApiBase={`/api/apprentice/learning/resources/${encodeURIComponent(viewing.id)}/preview/slides`}
                onClose={() => setViewerId(null)}
              />
            )
          ) : null}
          {openId ? (
            <div className={styles.purposeBox} style={{ marginTop: "1rem" }}>
              {extractLoading ? (
                <p className={styles.note}>Opening resource…</p>
              ) : (
                <>
                  {opened ? (
                    <p className={styles.purposeLead}>
                      <strong>{opened.title}</strong>
                    </p>
                  ) : null}
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

        {view.reviewMaterials.length > 0 ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Review materials</h2>
            <p className={styles.meta}>
              These were released later for revision and recap.
            </p>
            <ul className={styles.list}>
              {view.reviewMaterials.map((m) => (
                <li key={m.id}>
                  <div className={styles.rowLink}>
                    <div className={styles.rowMain}>
                      <span>{m.kindLabel}</span>
                      <strong>{m.title}</strong>
                    </div>
                    {m.openMode === "preview" ? (
                      <button
                        type="button"
                        className={styles.linkish}
                        onClick={() => setViewerId(m.id)}
                      >
                        {m.openLabel}
                      </button>
                    ) : m.openMode === "download" ? (
                      <a
                        className={styles.linkish}
                        href={`/api/apprentice/learning/resources/${encodeURIComponent(m.id)}/file?download=1`}
                      >
                        {m.openLabel}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={styles.linkish}
                        onClick={() => void openResource(m.id)}
                      >
                        {m.openLabel}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Activity / practice</h2>
          <p className={styles.note} style={{ whiteSpace: "pre-wrap" }}>
            {view.activityPractice}
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Review this learning</h2>
          <p className={styles.meta}>
            You can return to these materials at any time. Access stays available
            after the Session — you do not need to complete anything extra.
          </p>
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
