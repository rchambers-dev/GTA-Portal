"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { Select } from "@/components/ui/Select";
import { usePortalSession } from "@/shell/session/PortalSessionProvider";
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
  };
  learningStatus: "upcoming" | "available" | "completed";
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
  learnerVisibleResources: Array<{
    id: string;
    title: string;
    filename: string;
  }>;
};

type Bundle = {
  ok: boolean;
  error?: string;
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
  visibilityProof?: {
    sessionKey: string;
    resourceTitles: string[];
    includesTutorLessonPlan: boolean;
    tutorOnlyCount: number;
  };
  notes?: Record<string, string>;
};

/**
 * Block 1 tutor delivery pilot — planned Session journey + sign-off.
 * Not competence certification. Not Task completion.
 */
export function TutorBlock1DeliveryScreen() {
  const { session: portalSession } = usePortalSession();
  const admin = useAdminStore();
  const apprenticesById = useMemo(() => {
    const map = new Map(
      admin.apprentices.map((a) => [a.id, a] as const),
    );
    return map;
  }, [admin.apprentices]);

  const enrolments = useMemo(
    () =>
      admin.enrolments
        .filter((e) => e.apprenticeId && e.gtaProgrammeVersionId)
        .slice()
        .sort((a, b) =>
          (a.displayName || "").localeCompare(b.displayName || ""),
        ),
    [admin.enrolments],
  );

  const testEnrolments = enrolments.filter((e) => {
    const ap = e.apprenticeId
      ? apprenticesById.get(e.apprenticeId)
      : undefined;
    const ref = ap?.apprenticeReference || "";
    const name = e.displayName || ap?.displayName || "";
    return ref.startsWith("TEST-") || /TEST|DEMO/i.test(name);
  });

  const [enrolmentId, setEnrolmentId] = useState("");
  const selected =
    testEnrolments.find((e) => e.id === enrolmentId) ??
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
  const [laneView, setLaneView] = useState<"tutor" | "learner">("tutor");
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
        `/api/delivery/block1?apprenticeProgrammeId=${encodeURIComponent(selected.id)}&audience=${laneView === "learner" ? "learner" : "tutor"}`,
      );
      const json = (await res.json()) as Bundle;
      if (!json.ok) throw new Error(json.error || "Load failed");
      setBundle(json);
      setSelectedSessionId((prev) => {
        if (prev && json.sessions?.some((s) => s.session.id === prev)) {
          return prev;
        }
        return json.sessions?.[0]?.session.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [selected?.id, laneView]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected?.id) setEnrolmentId(selected.id);
  }, [selected?.id]);

  const selectedLane = bundle?.sessions?.find(
    (s) => s.session.id === selectedSessionId,
  );

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
      eyebrow="Tutor · Block 1 pilot"
      title="Session delivery"
      description="Confirm planned learning Sessions were delivered for a TEST apprentice. This is not competence, Task pass, OTJ, or attendance."
    >
      <div className={styles.root}>
        <div className={styles.purpose}>
          <p className={styles.purposeLead}>
            <Link href="/staff/programme-delivery">← Programme delivery</Link>
          </p>
          <label className={styles.blockMeta} style={{ display: "grid", gap: 6 }}>
            <span>TEST / DEMO apprentice enrolment</span>
            <Select
              value={selected?.id || ""}
              onChange={setEnrolmentId}
              options={
                testEnrolments.length === 0
                  ? [
                      {
                        value: "",
                        label: "No TEST enrolments — run Phase 2B seed",
                      },
                    ]
                  : testEnrolments.map((e) => {
                      const ap = e.apprenticeId
                        ? apprenticesById.get(e.apprenticeId)
                        : undefined;
                      return {
                        value: e.id,
                        label: `${e.displayName} · ${ap?.apprenticeReference || e.apprenticeId}`,
                      };
                    })
              }
            />
          </label>
          <div className={styles.chipRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              data-active={laneView === "tutor" ? "true" : "false"}
              onClick={() => setLaneView("tutor")}
            >
              Tutor delivery
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              data-active={laneView === "learner" ? "true" : "false"}
              onClick={() => setLaneView("learner")}
            >
              Learner lane preview
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {error ? (
          <p className={styles.purposeNote} role="alert">
            {error}
          </p>
        ) : null}

        {bundle?.apprentice ? (
          <p className={styles.purposeNote}>
            {bundle.apprentice.isTest ? "SAFE TEST RECORD · " : ""}
            {bundle.apprentice.displayName} ({bundle.apprentice.apprenticeReference})
            · programme week {bundle.enrolment?.programmeWeek}
          </p>
        ) : null}

        {bundle?.visibilityProof ? (
          <p className={styles.purposeNote}>
            Visibility proof (W001 learner view): titles=
            {bundle.visibilityProof.resourceTitles.join(", ") || "(none)"} ·
            includes tutor lesson plan=
            {String(bundle.visibilityProof.includesTutorLessonPlan)} ·
            tutor-only attachments on session=
            {bundle.visibilityProof.tutorOnlyCount}
          </p>
        ) : null}

        <div className={styles.blocksList}>
          <h2 className={styles.sectionTitle}>
            Block 1 · {bundle?.block?.title || "Foundation Skills"}
          </h2>
          <p className={styles.blockMeta}>
            Weeks {bundle?.block?.weekStart}–{bundle?.block?.weekEnd} ·{" "}
            {bundle?.block?.plannedOtjHours} planned eligible OTJ · learning
            completed ≠ Task completed
          </p>

          <ul className={styles.taskList}>
            {(bundle?.sessions || []).map((row) => (
              <li key={row.session.id}>
                <button
                  type="button"
                  className={styles.taskRow}
                  data-active={
                    selectedSessionId === row.session.id ? "true" : "false"
                  }
                  onClick={() => setSelectedSessionId(row.session.id)}
                >
                  <span>
                    <strong>
                      {row.session.sessionKey} · Week {row.session.calendarWeek}
                      {row.session.foundationSkillCode
                        ? ` · ${row.session.foundationSkillCode}`
                        : ""}
                    </strong>
                    <span className={styles.blockMeta}>
                      {" "}
                      {row.session.title}
                    </span>
                  </span>
                  <ApprenticeStatusChip
                    label={
                      row.learningStatus === "completed"
                        ? "Completed"
                        : row.learningStatusLabel
                    }
                    tone={
                      row.learningStatus === "completed"
                        ? "success"
                        : row.learningStatus === "available"
                          ? "info"
                          : "neutral"
                    }
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {selectedLane && laneView === "tutor" ? (
          <section className={styles.purpose}>
            <h2 className={styles.sectionTitle}>
              SESSION {selectedLane.session.sessionKey} · Week{" "}
              {selectedLane.session.calendarWeek}
              {selectedLane.session.foundationSkillCode
                ? ` · ${selectedLane.session.foundationSkillCode}`
                : ""}
            </h2>
            <p className={styles.purposeBody}>
              <strong>Focus:</strong> {selectedLane.session.title}
            </p>

            <h3 className={styles.purposeLabel}>Planned learning</h3>
            {selectedLane.session.learningObjectivesReview.status ===
            "candidate_for_review" ? (
              <div className={styles.purposeNote}>
                <strong>
                  CANDIDATE FROM SOURCE — NOT YET APPROVED CONTROLLED LEARNING
                  OBJECTIVE.
                </strong>
                <ul>
                  {(
                    selectedLane.session.learningObjectivesReview.lessonAims ||
                    []
                  ).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className={styles.blockMeta}>
                No candidate aims on this Session.
              </p>
            )}

            <h3 className={styles.purposeLabel}>Tutor delivery materials</h3>
            <TutorMaterialTitles
              programmeVersionId={bundle?.enrolment?.programmeVersionId || ""}
              attachmentResourceIds={selectedLane.tutorMaterialAttachments.map(
                (a) => a.resourceId,
              )}
              onViewSource={(id) => void openSource(id)}
            />
            {selectedLane.tutorMaterialAttachments.length === 0 ? (
              <p className={styles.blockMeta}>None attached.</p>
            ) : null}

            <h3 className={styles.purposeLabel}>Learner materials</h3>
            {selectedLane.learnerVisibleResources.length === 0 ? (
              <p className={styles.blockMeta}>
                No learner materials are currently approved for this Session.
              </p>
            ) : (
              <ul className={styles.objectives}>
                {selectedLane.learnerVisibleResources.map((r) => (
                  <li key={r.id}>
                    {r.title} (Learner visible)
                  </li>
                ))}
              </ul>
            )}

            <h3 className={styles.purposeLabel}>Activity / practice</h3>
            <p className={styles.blockMeta}>
              See View source on the lesson plan for candidate day activities.
              No controlled Practice record is required to sign off delivery.
            </p>

            <h3 className={styles.purposeLabel}>Task checkpoints</h3>
            <p className={styles.blockMeta}>
              Tasks are Block-level evidence/assessment checkpoints and remain
              independent. Signing off this Session does not complete a Task.
              Exact Session→Task release links are not authored (S7 deferred).
            </p>

            {selectedLane.delivery ? (
              <div className={styles.autosaveBar} data-state="saved">
                <p className={styles.autosaveText}>
                  Learning completed ·{" "}
                  {new Date(selectedLane.delivery.deliveredAt).toLocaleString(
                    "en-GB",
                  )}{" "}
                  · Tutor {selectedLane.delivery.signedOffByName}
                  {selectedLane.delivery.note
                    ? ` · Note: ${selectedLane.delivery.note}`
                    : ""}
                </p>
                <p className={styles.blockMeta}>
                  Sign-off cannot be casually undone in tutor UI. Authorised
                  amendment is a future requirement.
                </p>
              </div>
            ) : (
              <div className={styles.startActions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => setConfirmOpen(true)}
                >
                  Sign off Session delivered
                </button>
              </div>
            )}
          </section>
        ) : null}

        {selectedLane && laneView === "learner" ? (
          <section className={styles.purpose}>
            <h2 className={styles.sectionTitle}>
              Learner lane preview · {selectedLane.session.sessionKey}
            </h2>
            <ApprenticeStatusChip
              label={
                selectedLane.learningStatus === "completed"
                  ? "Completed"
                  : selectedLane.learningStatusLabel
              }
              tone={
                selectedLane.learningStatus === "completed"
                  ? "success"
                  : "info"
              }
            />
            {selectedLane.delivery ? (
              <p className={styles.purposeBody}>
                Completed{" "}
                {new Date(selectedLane.delivery.deliveredAt).toLocaleDateString(
                  "en-GB",
                )}{" "}
                · Tutor {selectedLane.delivery.signedOffByName}
              </p>
            ) : null}
            <h3 className={styles.purposeLabel}>Review learning</h3>
            {selectedLane.learnerVisibleResources.length === 0 ? (
              <p className={styles.blockMeta}>
                No learner learning/revision materials have been approved for
                this Session yet.
              </p>
            ) : (
              <ul className={styles.objectives}>
                {selectedLane.learnerVisibleResources.map((r) => (
                  <li key={r.id}>{r.title}</li>
                ))}
              </ul>
            )}
            <p className={styles.blockMeta}>
              Tutor-only materials (including FS lesson plans) never appear
              here.
            </p>
          </section>
        ) : null}

        {confirmOpen && selectedLane && bundle?.apprentice ? (
          <section className={styles.purpose} role="dialog">
            <h2 className={styles.sectionTitle}>Confirm Session delivered</h2>
            <p className={styles.purposeBody}>
              Session: {selectedLane.session.sessionKey} ·{" "}
              {selectedLane.session.title}
            </p>
            <p className={styles.purposeBody}>
              Apprentice: {bundle.apprentice.displayName} (
              {bundle.apprentice.apprenticeReference})
            </p>
            <label className={styles.blockMeta}>
              Delivery date
              <input
                type="date"
                value={deliveredAt}
                onChange={(e) => setDeliveredAt(e.target.value)}
              />
            </label>
            <p className={styles.blockMeta}>
              Tutor: {portalSession.account.name}
            </p>
            <label className={styles.blockMeta}>
              Optional note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </label>
            <p className={styles.purposeNote}>
              This records that the planned learning Session was delivered for
              this apprentice. It does not mean Pass, Competent, or Assessment
              complete.
            </p>
            <div className={styles.chipRow}>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={saving}
                onClick={() => void confirmSignOff()}
              >
                {saving ? "Saving…" : "Confirm Session delivered"}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        {extractText ? (
          <section className={styles.purpose}>
            <div className={styles.chipRow}>
              <h3 className={styles.sectionTitle}>Source extract</h3>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setExtractText(null)}
              >
                Close
              </button>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.82rem" }}>
              {extractText}
            </pre>
          </section>
        ) : null}

        {bundle?.notes?.s4Conflict ? (
          <p className={styles.blockMeta}>{bundle.notes.s4Conflict}</p>
        ) : null}
      </div>
    </ApprenticePageShell>
  );
}

function TutorMaterialTitles({
  programmeVersionId,
  attachmentResourceIds,
  onViewSource,
}: {
  programmeVersionId: string;
  attachmentResourceIds: string[];
  onViewSource: (id: string) => void;
}) {
  const [titles, setTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!programmeVersionId || attachmentResourceIds.length === 0) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/management/programme-definition/resources?programmeVersionId=${encodeURIComponent(programmeVersionId)}`,
      );
      const json = (await res.json()) as {
        ok: boolean;
        resources?: Array<{ id: string; title: string; filename: string }>;
      };
      if (cancelled || !json.ok) return;
      const map: Record<string, string> = {};
      for (const r of json.resources || []) {
        map[r.id] = r.title || r.filename;
      }
      setTitles(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [programmeVersionId, attachmentResourceIds]);

  if (!attachmentResourceIds.length) return null;
  return (
    <ul className={styles.objectives}>
      {attachmentResourceIds.map((id) => (
        <li key={id}>
          <strong>{titles[id] || "Tutor material"}</strong>
          <div className={styles.blockMeta}>Tutor delivery · Tutor only</div>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => onViewSource(id)}
          >
            View source
          </button>
        </li>
      ))}
    </ul>
  );
}
