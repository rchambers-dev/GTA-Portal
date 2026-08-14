"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { Select } from "@/components/ui/Select";
import { usePortalSession } from "@/shell/session/PortalSessionProvider";
import {
  approvedLearnerCopy,
  type LearnerFacingContent,
} from "@/features/programme-definition/domain/learner-facing-content";
import styles from "./programme-delivery.module.css";

type LaneSession = {
  session: {
    id: string;
    sessionKey: string;
    calendarWeek: number;
    title: string;
    foundationSkillCode: string | null;
    publishStatus: "draft" | "published";
    learningObjectivesReview: {
      status: string;
      lessonAims?: string[];
      byTheEnd?: string[];
      sourceLabel?: string;
    };
    learnerFacingContent?: LearnerFacingContent;
  };
  learningStatus: "upcoming" | "current" | "completed";
  learningStatusLabel: string;
  delivery: {
    deliveredAt: string;
    signedOffByName: string;
    note: string;
  } | null;
  tutorMaterialAttachments: Array<{
    id: string;
    resourceId: string;
    role: string;
    audience: string;
  }>;
  tutorDeliveryResources?: Array<{
    id: string;
    title: string;
    filename: string;
  }>;
  learnerVisibleResources: Array<{
    id: string;
    title: string;
    filename: string;
  }>;
};

type Bundle = {
  ok: boolean;
  error?: string;
  blockNumber?: number;
  apprentice?: {
    id: string;
    displayName: string;
    apprenticeReference: string;
    isTest: boolean;
  };
  enrolment?: {
    id: string;
    programmeVersionId: string;
    programmeWeek: number;
  };
  block?: { title: string; weekStart: number; weekEnd: number; plannedOtjHours: number };
  sessions?: LaneSession[];
  nextSession?: {
    id: string;
    sessionKey: string;
    title: string;
    calendarWeek: number;
  } | null;
  notes?: Record<string, string>;
};

function chipTone(
  status: LaneSession["learningStatus"],
): "green" | "amber" | "neutral" {
  if (status === "completed") return "green";
  if (status === "current") return "amber";
  return "neutral";
}

function statusLabel(row: LaneSession): string {
  if (row.learningStatus === "completed") return "Delivered";
  if (row.learningStatus === "current") return "Next to deliver";
  return "Later";
}

/**
 * Tutor Session delivery for Block 1 or Block 2.
 * Not competence, Task completion, OTJ, or attendance.
 */
export function TutorBlock1DeliveryScreen({
  blockNumber = 1,
}: {
  blockNumber?: 1 | 2;
}) {
  const { session: portalSession } = usePortalSession();
  const searchParams = useSearchParams();
  const requestedEnrolment = searchParams.get("enrolment")?.trim() || "";
  const admin = useAdminStore();
  const apprenticesById = useMemo(() => {
    const map = new Map(admin.apprentices.map((a) => [a.id, a] as const));
    return map;
  }, [admin.apprentices]);

  const testEnrolments = useMemo(
    () =>
      admin.enrolments
        .filter((e) => e.apprenticeId && e.gtaProgrammeVersionId)
        .filter((e) => {
          const ap = e.apprenticeId
            ? apprenticesById.get(e.apprenticeId)
            : undefined;
          const ref = ap?.apprenticeReference || "";
          const name = e.displayName || ap?.displayName || "";
          return ref.startsWith("TEST-") || /TEST|DEMO/i.test(name);
        })
        .slice()
        .sort((a, b) =>
          (a.displayName || "").localeCompare(b.displayName || ""),
        ),
    [admin.enrolments, apprenticesById],
  );

  const [enrolmentId, setEnrolmentId] = useState("");
  const selected =
    testEnrolments.find((e) => e.id === enrolmentId) ??
    testEnrolments.find((e) => e.id === requestedEnrolment) ??
    testEnrolments[0] ??
    null;

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState("");
  const [deliveredAt, setDeliveredAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);
  const [showLearnerView, setShowLearnerView] = useState(false);
  const [extractText, setExtractText] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selected?.id) {
      setBundle(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/delivery/block1?block=${blockNumber}&apprenticeProgrammeId=${encodeURIComponent(selected.id)}`,
      );
      const json = (await res.json()) as Bundle;
      if (!json.ok) throw new Error(json.error || "Load failed");
      setBundle(json);
      setSelectedSessionId((prev) => {
        if (prev && json.sessions?.some((s) => s.session.id === prev)) {
          return prev;
        }
        return (
          json.sessions?.find((s) => s.learningStatus === "current")?.session
            .id ??
          json.sessions?.[0]?.session.id ??
          null
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [selected?.id, blockNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected?.id) setEnrolmentId(selected.id);
  }, [selected?.id]);

  const selectedLane = bundle?.sessions?.find(
    (s) => s.session.id === selectedSessionId,
  );
  const approved = selectedLane
    ? approvedLearnerCopy(selectedLane.session.learnerFacingContent)
    : null;

  async function openSource(resourceId: string) {
    if (!bundle?.enrolment?.programmeVersionId) return;
    const res = await fetch(
      `/api/management/programme-definition/resources/extract?programmeVersionId=${encodeURIComponent(bundle.enrolment.programmeVersionId)}&resourceId=${encodeURIComponent(resourceId)}`,
    );
    const json = (await res.json()) as {
      ok: boolean;
      extractText?: string;
      note?: string;
      error?: string;
    };
    if (!json.ok) {
      setExtractText(json.error || "Could not open source");
      return;
    }
    setExtractText(
      `${json.note || ""}\n\n${json.extractText || "(empty extract)"}`,
    );
  }

  async function confirmSignOff() {
    if (!selectedLane || !bundle?.enrolment || !bundle.apprentice) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/delivery/session-signoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          programmeVersionId: bundle.enrolment.programmeVersionId,
          sessionId: selectedLane.session.id,
          apprenticeId: bundle.apprentice.id,
          apprenticeProgrammeId: bundle.enrolment.id,
          spineItemId: null,
          deliveredAt: new Date(deliveredAt).toISOString(),
          signedOffBy: portalSession.account.id || null,
          signedOffByName: portalSession.account.name || "Tutor",
          note,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Sign-off failed");
      setConfirmOpen(false);
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-off failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ApprenticePageShell
      eyebrow={`Tutor · Block ${blockNumber}`}
      title={`Block ${blockNumber} Sessions`}
      description="Choose a Session on the left. Use your materials, then confirm it was delivered."
    >
      <div className={styles.root}>
        <div className={styles.toolbar}>
          <Link href="/staff/programme-delivery" className={styles.back}>
            ← Programme delivery
          </Link>
          <label className={styles.blockMeta} style={{ display: "grid", gap: 6, minWidth: "16rem" }}>
            <span>Learner</span>
            <Select
              value={selected?.id || ""}
              onChange={setEnrolmentId}
              options={
                testEnrolments.length === 0
                  ? [{ value: "", label: "No test learner available" }]
                  : testEnrolments.map((e) => ({
                      value: e.id,
                      label: e.displayName,
                    }))
              }
            />
          </label>
        </div>

        {error ? (
          <p className={styles.purposeNote} role="alert">
            {error}
          </p>
        ) : null}

        {loading && !bundle ? (
          <p className={styles.empty}>Loading Sessions…</p>
        ) : (
          <div className={styles.deliveryLayout}>
            <div>
              <h2 className={styles.sectionTitle}>
                Weeks {bundle?.block?.weekStart ?? "—"}–
                {bundle?.block?.weekEnd ?? "—"}
              </h2>
              <p className={styles.blockMeta}>
                {bundle?.apprentice?.displayName || "Learner"}
                {bundle?.enrolment?.programmeWeek
                  ? ` · week ${bundle.enrolment.programmeWeek}`
                  : ""}
              </p>
              <ul className={styles.sessionList}>
                {(bundle?.sessions || []).map((row) => (
                  <li key={row.session.id}>
                    <button
                      type="button"
                      className={styles.sessionRow}
                      data-active={
                        selectedSessionId === row.session.id ? "true" : "false"
                      }
                      onClick={() => {
                        setSelectedSessionId(row.session.id);
                        setConfirmOpen(false);
                        setExtractText(null);
                        setShowLearnerView(false);
                      }}
                    >
                      <span className={styles.sessionRowMain}>
                        <strong>
                          {row.session.sessionKey} · Week{" "}
                          {row.session.calendarWeek}
                        </strong>
                        <span className={styles.blockMeta}>
                          {row.session.title}
                        </span>
                      </span>
                      <ApprenticeStatusChip tone={chipTone(row.learningStatus)}>
                        {statusLabel(row)}
                      </ApprenticeStatusChip>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {selectedLane ? (
              <section className={styles.sessionDetail}>
                <div>
                  <p className={styles.purposeLabel}>
                    {selectedLane.session.sessionKey}
                  </p>
                  <h2 className={styles.sectionTitle}>
                    {selectedLane.session.title}
                  </h2>
                  <ApprenticeStatusChip
                    tone={chipTone(selectedLane.learningStatus)}
                  >
                    {statusLabel(selectedLane)}
                  </ApprenticeStatusChip>
                </div>

                <div className={styles.chipRow}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    data-active={showLearnerView ? "false" : "true"}
                    onClick={() => setShowLearnerView(false)}
                  >
                    Your materials
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    data-active={showLearnerView ? "true" : "false"}
                    onClick={() => setShowLearnerView(true)}
                  >
                    What the learner sees
                  </button>
                </div>

                {showLearnerView ? (
                  <>
                    {approved ? (
                      <>
                        <p className={styles.purposeBody}>
                          <strong>{approved.summary}</strong>
                        </p>
                        <p
                          className={styles.purposeLead}
                          style={{ whiteSpace: "pre-wrap" }}
                        >
                          {approved.learningContent}
                        </p>
                      </>
                    ) : (
                      <p className={styles.blockMeta}>
                        No approved learner copy for this Session yet.
                      </p>
                    )}
                    <h3 className={styles.purposeLabel}>Learner resources</h3>
                    {selectedLane.learnerVisibleResources.length === 0 ? (
                      <p className={styles.blockMeta}>
                        Nothing learner-visible is attached yet.
                      </p>
                    ) : (
                      <ul className={styles.objectives}>
                        {selectedLane.learnerVisibleResources.map((r) => (
                          <li key={r.id}>{r.title}</li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className={styles.purposeLabel}>Tutor materials</h3>
                    <TutorMaterialTitles
                      resources={selectedLane.tutorDeliveryResources || []}
                      attachmentResourceIds={selectedLane.tutorMaterialAttachments.map(
                        (a) => a.resourceId,
                      )}
                      onViewSource={(id) => void openSource(id)}
                    />
                    {selectedLane.tutorMaterialAttachments.length === 0 ? (
                      <p className={styles.blockMeta}>
                        No tutor lesson plan is attached to this Session.
                      </p>
                    ) : null}
                    {extractText ? (
                      <div>
                        <div className={styles.chipRow}>
                          <h3 className={styles.purposeLabel}>Extract</h3>
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            onClick={() => setExtractText(null)}
                          >
                            Close
                          </button>
                        </div>
                        <pre
                          style={{
                            whiteSpace: "pre-wrap",
                            fontSize: "0.82rem",
                          }}
                        >
                          {extractText}
                        </pre>
                      </div>
                    ) : null}
                  </>
                )}

                {selectedLane.delivery ? (
                  <div className={styles.autosaveBar} data-state="saved">
                    <p className={styles.autosaveText}>
                      Session delivered ·{" "}
                      {new Date(
                        selectedLane.delivery.deliveredAt,
                      ).toLocaleDateString("en-GB")}{" "}
                      · {selectedLane.delivery.signedOffByName}
                    </p>
                  </div>
                ) : confirmOpen ? (
                  <div>
                    <h3 className={styles.sectionTitle}>
                      Confirm this Session was delivered
                    </h3>
                    <p className={styles.purposeLead}>
                      This only records that the planned learning happened. It
                      does not pass a Task or mark the apprentice competent.
                    </p>
                    <label className={styles.blockMeta}>
                      Delivery date
                      <input
                        type="date"
                        value={deliveredAt}
                        onChange={(e) => setDeliveredAt(e.target.value)}
                      />
                    </label>
                    <label className={styles.blockMeta}>
                      Optional note
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                      />
                    </label>
                    <div className={styles.chipRow}>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        disabled={saving}
                        onClick={() => void confirmSignOff()}
                      >
                        {saving ? "Saving…" : "Confirm delivered"}
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => setConfirmOpen(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Confirm Session delivered
                  </button>
                )}
              </section>
            ) : (
              <p className={styles.empty}>Choose a Session from the list.</p>
            )}
          </div>
        )}

        {bundle?.notes?.s4Conflict ? (
          <p className={styles.blockMeta}>{bundle.notes.s4Conflict}</p>
        ) : null}
      </div>
    </ApprenticePageShell>
  );
}

function TutorMaterialTitles({
  resources,
  attachmentResourceIds,
  onViewSource,
}: {
  resources: Array<{ id: string; title: string; filename: string }>;
  attachmentResourceIds: string[];
  onViewSource: (id: string) => void;
}) {
  const byId = useMemo(() => {
    const map: Record<string, { title: string; filename: string }> = {};
    for (const r of resources) {
      map[r.id] = {
        title: r.title || r.filename,
        filename: r.filename || "",
      };
    }
    return map;
  }, [resources]);

  if (!attachmentResourceIds.length) return null;
  return (
    <ul className={styles.objectives}>
      {attachmentResourceIds.map((id) => {
        const meta = byId[id];
        return (
          <li key={id}>
            <strong>{meta?.title || "Tutor material"}</strong>
            <div className={styles.chipRow} style={{ marginTop: 6 }}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => onViewSource(id)}
              >
                Open lesson plan extract
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
