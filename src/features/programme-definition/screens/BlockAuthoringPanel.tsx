"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import adminStyles from "@/features/administration/screens/admin-pages.module.css";
import type { SpineItem } from "../domain/types";
import type { ProgrammeSessionRecord } from "../domain/programme-sessions";
import type { LearnerFacingContent } from "../domain/learner-facing-content";
import { approvedLearnerCopy } from "../domain/learner-facing-content";
import type { GtaCourseTaskRecord } from "@/features/programme-delivery/domain/gta-course-tasks";
import type {
  LearnerReleaseTiming,
  ProgrammeResourceAttachmentRecord,
  ProgrammeResourceRecord,
  ResourceAudience,
  ResourceRole,
} from "../domain/programme-resources";
import {
  labelResourceAudience,
  labelLearnerReleaseTiming,
  labelResourceRole,
  LEARNER_RELEASE_TIMINGS,
  RESOURCE_AUDIENCES,
  RESOURCE_ROLES,
  suggestedAudienceForRole,
} from "../domain/programme-resources";
import styles from "./programme-builder.module.css";

type TabId =
  | "overview"
  | "sessions"
  | "materials"
  | "tasks"
  | "preview";

type Props = {
  programmeVersionId: string;
  block: SpineItem;
  onClose: () => void;
};

function blockNumberOf(item: SpineItem): number | null {
  const raw = item.metadata?.blockNumber;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

function weekStartOf(item: SpineItem): number | null {
  const raw = item.metadata?.weekStart;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && Number.isFinite(Number(raw))) return Number(raw);
  return null;
}

function weekEndOf(item: SpineItem): number | null {
  const raw = item.metadata?.weekEnd;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && Number.isFinite(Number(raw))) return Number(raw);
  return null;
}

function authoringStatusLabel(status: "draft" | "published"): string {
  return status === "published" ? "Ready for delivery" : "Draft";
}

const ROLE_OPTIONS: { value: ResourceRole; label: string }[] = [
  { value: "TUTOR_DELIVERY", label: "Tutor delivery" },
  { value: "LEARNER_LEARNING", label: "Learner learning" },
  { value: "LEARNER_REVISION", label: "Reference" },
  { value: "PRACTICE", label: "Activity / practice" },
  { value: "ASSESSMENT_PREP", label: "Assessment preparation" },
  { value: "CONTROLLED_FORM", label: "Controlled form" },
];

const AUDIENCE_OPTIONS: { value: ResourceAudience; label: string }[] = [
  { value: "TUTOR_ONLY", label: "Tutor only" },
  { value: "LEARNER_VISIBLE", label: "Learner visible" },
];

const LEARNER_RELEASE_TIMING_OPTIONS: {
  value: LearnerReleaseTiming;
  label: string;
}[] = [
  { value: "WITH_SESSION", label: "With Session" },
  { value: "REVIEW_LATER", label: "Release later for review" },
];

export function BlockAuthoringPanel({
  programmeVersionId,
  block,
  onClose,
}: Props) {
  const [tab, setTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ProgrammeSessionRecord[]>([]);
  const [tasks, setTasks] = useState<GtaCourseTaskRecord[]>([]);
  const [resources, setResources] = useState<ProgrammeResourceRecord[]>([]);
  const [attachments, setAttachments] = useState<
    ProgrammeResourceAttachmentRecord[]
  >([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const [attachResourceId, setAttachResourceId] = useState("");
  const [attachSessionId, setAttachSessionId] = useState("");
  const [attachRole, setAttachRole] = useState<ResourceRole>("TUTOR_DELIVERY");
  const [attachAudience, setAttachAudience] =
    useState<ResourceAudience>("TUTOR_ONLY");
  const [attachLearnerReleaseTiming, setAttachLearnerReleaseTiming] =
    useState<LearnerReleaseTiming>("WITH_SESSION");
  const [attachSort, setAttachSort] = useState(10);

  const [placeSessionByAtt, setPlaceSessionByAtt] = useState<
    Record<string, string>
  >({});

  const [extractOpen, setExtractOpen] = useState(false);
  const [extractTitle, setExtractTitle] = useState("");
  const [extractNote, setExtractNote] = useState("");
  const [extractText, setExtractText] = useState("");
  const [candidateActivities, setCandidateActivities] = useState<string[]>([]);
  const [extractLoading, setExtractLoading] = useState(false);
  const [learnerSummary, setLearnerSummary] = useState("");
  const [learnerLearning, setLearnerLearning] = useState("");
  const [learnerActivity, setLearnerActivity] = useState("");

  const blockNumber = blockNumberOf(block);
  const weekStart = weekStartOf(block);
  const weekEnd = weekEndOf(block);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessRes, taskRes, matRes] = await Promise.all([
        fetch(
          `/api/management/programme-definition/sessions?programmeVersionId=${encodeURIComponent(programmeVersionId)}`,
        ),
        fetch(
          `/api/management/course-builder/tasks?programmeVersionId=${encodeURIComponent(programmeVersionId)}`,
        ),
        fetch(
          `/api/management/programme-definition/resources?programmeVersionId=${encodeURIComponent(programmeVersionId)}&spineItemId=${encodeURIComponent(block.id)}`,
        ),
      ]);
      const sessJson = (await sessRes.json()) as {
        ok: boolean;
        error?: string;
        sessions?: ProgrammeSessionRecord[];
      };
      const taskJson = (await taskRes.json()) as {
        ok: boolean;
        error?: string;
        tasks?: GtaCourseTaskRecord[];
      };
      const matJson = (await matRes.json()) as {
        ok: boolean;
        error?: string;
        resources?: ProgrammeResourceRecord[];
        attachments?: ProgrammeResourceAttachmentRecord[];
      };
      if (!sessJson.ok) throw new Error(sessJson.error || "Sessions failed");
      if (!taskJson.ok) throw new Error(taskJson.error || "Tasks failed");
      if (!matJson.ok) throw new Error(matJson.error || "Resources failed");

      const blockSessions = (sessJson.sessions ?? []).filter(
        (s) => s.spineItemId === block.id,
      );
      setSessions(blockSessions);
      setTasks(
        (taskJson.tasks ?? []).filter((t) => t.spineItemId === block.id),
      );
      const nextResources = matJson.resources ?? [];
      setResources(nextResources);
      setAttachments(matJson.attachments ?? []);
      setSelectedSessionId((prev) => {
        if (prev && blockSessions.some((s) => s.id === prev)) return prev;
        return blockSessions[0]?.id ?? null;
      });
      setAttachResourceId((prev) => prev || nextResources[0]?.id || "");
      setAttachSessionId((prev) => prev || blockSessions[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [programmeVersionId, block.id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const resourceById = useMemo(
    () => new Map(resources.map((r) => [r.id, r])),
    [resources],
  );

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  useEffect(() => {
    if (!selectedSession) {
      setLearnerSummary("");
      setLearnerLearning("");
      setLearnerActivity("");
      return;
    }
    const approved = approvedLearnerCopy(selectedSession.learnerFacingContent);
    const draft =
      approved || selectedSession.learnerFacingContent.candidate;
    setLearnerSummary(draft?.summary || selectedSession.topic || "");
    setLearnerLearning(draft?.learningContent || "");
    setLearnerActivity(draft?.activityPractice || "");
  }, [selectedSession]);

  const sessionAttachments = useMemo(
    () =>
      attachments
        .filter((a) => a.sessionId === selectedSessionId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [attachments, selectedSessionId],
  );

  const tutorDelivery = useMemo(
    () => sessionAttachments.filter((a) => a.role === "TUTOR_DELIVERY"),
    [sessionAttachments],
  );
  const learnerMaterials = useMemo(
    () =>
      sessionAttachments.filter(
        (a) =>
          a.audience === "LEARNER_VISIBLE" ||
          a.role === "LEARNER_LEARNING" ||
          a.role === "LEARNER_REVISION",
      ),
    [sessionAttachments],
  );
  const practiceMaterials = useMemo(
    () => sessionAttachments.filter((a) => a.role === "PRACTICE"),
    [sessionAttachments],
  );
  const unplaced = useMemo(
    () => attachments.filter((a) => a.sessionId == null),
    [attachments],
  );

  // Stable id for extract fetch — avoid depending on a new array each render
  const lessonPlanResourceId = useMemo(() => {
    const lp = tutorDelivery.find((a) => {
      const r = resourceById.get(a.resourceId);
      return r?.filename?.includes("Lesson_Plan");
    });
    return lp?.resourceId || tutorDelivery[0]?.resourceId || null;
  }, [tutorDelivery, resourceById]);

  // Load candidate activities when session / lesson-plan resource changes
  useEffect(() => {
    if (!lessonPlanResourceId || !selectedSessionId) {
      setCandidateActivities((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/management/programme-definition/resources/extract?programmeVersionId=${encodeURIComponent(programmeVersionId)}&resourceId=${encodeURIComponent(lessonPlanResourceId)}`,
        );
        const json = (await res.json()) as {
          ok: boolean;
          candidateActivities?: string[];
        };
        if (!cancelled && json.ok) {
          setCandidateActivities(json.candidateActivities ?? []);
        }
      } catch {
        if (!cancelled) setCandidateActivities([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSessionId, lessonPlanResourceId, programmeVersionId]);

  async function saveLearnerFacingContent(
    next: LearnerFacingContent,
  ): Promise<void> {
    if (!selectedSession) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/management/programme-definition/sessions",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programmeVersionId,
            sessionId: selectedSession.id,
            learnerFacingContent: next,
          }),
        },
      );
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Update failed");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveLearnerDraft() {
    if (!selectedSession) return;
    const current = selectedSession.learnerFacingContent;
    if (current.status === "approved_published" && current.approved) {
      await saveLearnerFacingContent({
        status: "approved_published",
        candidate: current.candidate,
        approved: {
          ...current.approved,
          summary: learnerSummary,
          learningContent: learnerLearning,
          activityPractice: learnerActivity,
        },
      });
      return;
    }
    await saveLearnerFacingContent({
      status: "candidate_for_review",
      candidate: {
        summary: learnerSummary,
        learningContent: learnerLearning,
        activityPractice: learnerActivity,
        sourceLabel:
          current.candidate?.sourceLabel ||
          selectedSession.learningObjectivesReview.sourceLabel ||
          "Curriculum owner draft",
      },
      approved: null,
    });
  }

  async function approveLearnerContent() {
    if (!selectedSession) return;
    const current = selectedSession.learnerFacingContent;
    await saveLearnerFacingContent({
      status: "approved_published",
      candidate: current.candidate,
      approved: {
        summary: learnerSummary,
        learningContent: learnerLearning,
        activityPractice: learnerActivity,
        sourceLabel:
          current.candidate?.sourceLabel ||
          current.approved?.sourceLabel ||
          selectedSession.learningObjectivesReview.sourceLabel ||
          "",
        approvedAt: new Date().toISOString(),
        approvedByName: "Curriculum owner",
      },
    });
  }

  async function clearApprovedLearnerContent() {
    if (!selectedSession) return;
    const current = selectedSession.learnerFacingContent;
    await saveLearnerFacingContent({
      status: current.candidate ? "candidate_for_review" : "empty",
      candidate: current.candidate,
      approved: null,
    });
  }

  async function setAuthoringStatus(status: "draft" | "published") {
    if (!selectedSession) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/management/programme-definition/sessions",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programmeVersionId,
            sessionId: selectedSession.id,
            publishStatus: status,
          }),
        },
      );
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Update failed");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function openLessonPlan(resourceId: string) {
    setExtractLoading(true);
    setExtractOpen(true);
    setExtractText("");
    setExtractNote("");
    try {
      const res = await fetch(
        `/api/management/programme-definition/resources/extract?programmeVersionId=${encodeURIComponent(programmeVersionId)}&resourceId=${encodeURIComponent(resourceId)}`,
      );
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        note?: string;
        extractText?: string;
        resource?: { title?: string; filename?: string };
        candidateActivities?: string[];
      };
      if (!json.ok) throw new Error(json.error || "Could not open source");
      setExtractTitle(
        json.resource?.title || json.resource?.filename || "Source",
      );
      setExtractNote(json.note || "");
      setExtractText(json.extractText || "");
      if (json.candidateActivities?.length) {
        setCandidateActivities(json.candidateActivities);
      }
    } catch (err) {
      setExtractNote(err instanceof Error ? err.message : "Open failed");
    } finally {
      setExtractLoading(false);
    }
  }

  async function saveAttachment() {
    if (!attachResourceId || !attachSessionId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/management/programme-definition/resources",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programmeVersionId,
            attachments: [
              {
                resourceId: attachResourceId,
                spineItemId: block.id,
                sessionId: attachSessionId,
                role: attachRole,
                audience: attachAudience,
                learnerReleaseTiming:
                  attachAudience === "LEARNER_VISIBLE"
                    ? attachLearnerReleaseTiming
                    : null,
                sortOrder: attachSort,
              },
            ],
          }),
        },
      );
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Attach failed");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attach failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    setSaving(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        programmeVersionId,
        attachmentId,
      });
      const res = await fetch(
        `/api/management/programme-definition/resources?${qs}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Remove failed");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setSaving(false);
    }
  }

  async function placeUnplaced(attachmentId: string) {
    const sessionId = placeSessionByAtt[attachmentId];
    if (!sessionId) {
      setError("Choose a session before placing.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/management/programme-definition/resources",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programmeVersionId,
            action: "place_unplaced",
            attachmentId,
            sessionId,
          }),
        },
      );
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Place failed");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Place failed");
    } finally {
      setSaving(false);
    }
  }

  function goSessions() {
    setTab("sessions");
  }

  return (
    <section
      className={`${styles.panel} ${styles.span2}`}
      aria-label={`Block authoring: ${block.title}`}
    >
      <div className={styles.panelHead}>
        <div>
          <h2>Block {blockNumber ?? "—"}</h2>
          <p className={styles.meta} style={{ margin: 0 }}>
            {block.title}
          </p>
        </div>
        <div className={styles.spineActions}>
          <button
            type="button"
            className={adminStyles.secondaryBtn}
            onClick={() => void loadAll()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            className={adminStyles.secondaryBtn}
            onClick={onClose}
          >
            Close block
          </button>
        </div>
      </div>

      {error ? (
        <div className={styles.banner} data-tone="error" role="alert">
          {error}
        </div>
      ) : null}

      <div className={styles.spineActions} style={{ marginBottom: "0.75rem" }}>
        {(
          [
            ["overview", "Overview"],
            ["sessions", "Sessions"],
            ["materials", "Materials"],
            ["tasks", "Tasks"],
            ["preview", "Authoring preview"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              tab === id ? adminStyles.primaryBtn : adminStyles.secondaryBtn
            }
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div>
          <div className={styles.coverageMetrics}>
            <div>
              <span>Weeks</span>
              <strong>
                {weekStart != null && weekEnd != null
                  ? `${weekStart}–${weekEnd}`
                  : block.plannedWeeks ?? "—"}
              </strong>
            </div>
            <div>
              <span>Planned eligible OTJ</span>
              <strong>{block.plannedOtjHours}</strong>
            </div>
            <div>
              <span>Planned sessions</span>
              <strong>{sessions.length}</strong>
            </div>
            <div>
              <span>Task checkpoints</span>
              <strong>{tasks.length}</strong>
            </div>
            <div>
              <span>Unplaced materials</span>
              <strong>{unplaced.length}</strong>
            </div>
          </div>

          <div className={styles.banner} style={{ marginTop: "1rem" }}>
            <p>
              <strong>How this Block is organised</strong>
            </p>
            <ul>
              <li>
                <strong>Sessions</strong> are the planned teaching / learning
                journey (college occasions).
              </li>
              <li>
                <strong>Materials</strong> support those Sessions (tutor delivery,
                learner learning/revision, practice).
              </li>
              <li>
                <strong>Tasks</strong> are evidence / assessment checkpoints
                around the learning — not the whole Block journey.
              </li>
            </ul>
            <p className={styles.meta}>
              A learner does not need a Portal Task for every Session. Tutor
              delivery sign-off is a later phase and is separate from curriculum
              authoring status.
            </p>
          </div>

          <div className={styles.startActions} style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className={adminStyles.primaryBtn}
              onClick={goSessions}
            >
              View sessions
            </button>
          </div>
        </div>
      ) : null}

      {tab === "sessions" ? (
        <div className={styles.startLayout}>
          <div>
            <h3 className={styles.meta}>Planned sessions</h3>
            <div className={styles.spineTableWrap}>
              <table className={styles.spineTable}>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Week</th>
                    <th>Focus</th>
                    <th>Authoring status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr
                      key={s.id}
                      data-active={selectedSessionId === s.id ? "true" : "false"}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedSessionId(s.id)}
                    >
                      <td>{s.sessionKey}</td>
                      <td>{s.calendarWeek}</td>
                      <td>
                        {s.foundationSkillCode
                          ? `${s.foundationSkillCode} · ${s.title}`
                          : s.title}
                      </td>
                      <td>{authoringStatusLabel(s.publishStatus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            {selectedSession ? (
              <div>
                <div className={styles.panelHead}>
                  <h3>
                    {selectedSession.sessionKey} · Week{" "}
                    {selectedSession.calendarWeek}
                  </h3>
                </div>
                <p>
                  <strong>{selectedSession.title}</strong>
                </p>
                <p className={styles.meta}>
                  Planned key {selectedSession.sessionKey}
                  {selectedSession.foundationSkillCode
                    ? ` · ${selectedSession.foundationSkillCode}`
                    : ""}
                </p>

                <div className={styles.banner}>
                  <p>
                    <strong>Authoring status (curriculum)</strong>
                    {" — "}
                    {authoringStatusLabel(selectedSession.publishStatus)}
                  </p>
                  <p className={styles.meta}>
                    This is curriculum authoring state only. It does not mean the
                    Session has been delivered or signed off for an apprentice.
                  </p>
                  <div className={styles.spineActions}>
                    <button
                      type="button"
                      className={adminStyles.secondaryBtn}
                      disabled={saving}
                      onClick={() => void setAuthoringStatus("draft")}
                    >
                      Set draft
                    </button>
                    <button
                      type="button"
                      className={adminStyles.primaryBtn}
                      disabled={saving}
                      onClick={() => void setAuthoringStatus("published")}
                    >
                      Set ready for delivery
                    </button>
                  </div>
                </div>

                <h4 className={styles.meta}>
                  Candidate learning aims — source extract
                </h4>
                {selectedSession.learningObjectivesReview.status ===
                "candidate_for_review" ? (
                  <div className={styles.banner}>
                    <p>
                      <strong>
                        CANDIDATE FROM SOURCE — NOT YET APPROVED CONTROLLED
                        LEARNING OBJECTIVE.
                      </strong>
                    </p>
                    {selectedSession.learningObjectivesReview.lessonAims
                      ?.length ? (
                      <>
                        <strong>Lesson aims (source)</strong>
                        <ul>
                          {selectedSession.learningObjectivesReview.lessonAims.map(
                            (a) => (
                              <li key={a}>{a}</li>
                            ),
                          )}
                        </ul>
                      </>
                    ) : null}
                    {selectedSession.learningObjectivesReview.byTheEnd
                      ?.length ? (
                      <>
                        <strong>By the end (source)</strong>
                        <ul>
                          {selectedSession.learningObjectivesReview.byTheEnd.map(
                            (a) => (
                              <li key={a}>{a}</li>
                            ),
                          )}
                        </ul>
                      </>
                    ) : null}
                    <p className={styles.meta}>
                      Source:{" "}
                      {selectedSession.learningObjectivesReview.sourceLabel}
                    </p>
                  </div>
                ) : (
                  <p className={styles.meta}>
                    No candidate aims extracted. Use View source on the lesson
                    plan.
                  </p>
                )}

                <h4 className={styles.meta}>Learner experience</h4>
                <div className={styles.banner}>
                  <p>
                    <strong>WHAT TUTOR SEES</strong>
                    {" — "}
                    lesson plan, tutor delivery materials, and source extracts
                    stay tutor-only.
                  </p>
                  <p>
                    <strong>WHAT APPRENTICE SEES</strong>
                    {" — "}
                    only approved learner summary, activity, and learner-visible
                    resources.
                  </p>
                </div>
                {selectedSession.learnerFacingContent.candidate ? (
                  <div className={styles.banner}>
                    <p>
                      <strong>
                        CANDIDATE FROM SOURCE — REQUIRES APPROVAL
                      </strong>
                    </p>
                    <p className={styles.meta}>
                      Source:{" "}
                      {selectedSession.learnerFacingContent.candidate.sourceLabel}
                    </p>
                    {selectedSession.learnerFacingContent.candidate.summary ? (
                      <p>
                        <strong>Candidate summary:</strong>{" "}
                        {selectedSession.learnerFacingContent.candidate.summary}
                      </p>
                    ) : null}
                    {selectedSession.learnerFacingContent.candidate
                      .learningContent ? (
                      <p className={styles.meta} style={{ whiteSpace: "pre-wrap" }}>
                        {
                          selectedSession.learnerFacingContent.candidate
                            .learningContent
                        }
                      </p>
                    ) : null}
                    {selectedSession.learnerFacingContent.candidate
                      .activityPractice ? (
                      <p className={styles.meta} style={{ whiteSpace: "pre-wrap" }}>
                        {
                          selectedSession.learnerFacingContent.candidate
                            .activityPractice
                        }
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className={adminStyles.secondaryBtn}
                      onClick={() => {
                        const c =
                          selectedSession.learnerFacingContent.candidate;
                        if (!c) return;
                        setLearnerSummary(c.summary);
                        setLearnerLearning(c.learningContent);
                        setLearnerActivity(c.activityPractice);
                      }}
                    >
                      Copy candidate into editor
                    </button>
                  </div>
                ) : (
                  <p className={styles.meta}>
                    No source candidate has been prepared for apprentice copy
                    yet.
                  </p>
                )}
                <p className={styles.meta}>
                  Learner copy status:{" "}
                  {selectedSession.learnerFacingContent.status ===
                  "approved_published"
                    ? "Approved for apprentices"
                    : selectedSession.learnerFacingContent.status ===
                        "candidate_for_review"
                      ? "Candidate — not shown to apprentices"
                      : "Empty — not shown to apprentices"}
                </p>
                <label className={styles.meta}>
                  Learner learning summary
                  <textarea
                    value={learnerSummary}
                    onChange={(e) => setLearnerSummary(e.target.value)}
                    rows={2}
                    style={{ width: "100%", marginTop: "0.35rem" }}
                  />
                </label>
                <label className={styles.meta}>
                  Learner-facing learning content
                  <textarea
                    value={learnerLearning}
                    onChange={(e) => setLearnerLearning(e.target.value)}
                    rows={5}
                    style={{ width: "100%", marginTop: "0.35rem" }}
                  />
                </label>
                <label className={styles.meta}>
                  Learner-facing activity / practice
                  <textarea
                    value={learnerActivity}
                    onChange={(e) => setLearnerActivity(e.target.value)}
                    rows={4}
                    style={{ width: "100%", marginTop: "0.35rem" }}
                  />
                </label>
                <div className={styles.spineActions}>
                  <button
                    type="button"
                    className={adminStyles.secondaryBtn}
                    disabled={saving}
                    onClick={() => void saveLearnerDraft()}
                  >
                    Save learner draft
                  </button>
                  <button
                    type="button"
                    className={adminStyles.primaryBtn}
                    disabled={saving}
                    onClick={() => void approveLearnerContent()}
                  >
                    Approve and publish for learners
                  </button>
                  <button
                    type="button"
                    className={adminStyles.secondaryBtn}
                    disabled={saving}
                    onClick={() => void clearApprovedLearnerContent()}
                  >
                    Remove from apprentice view
                  </button>
                </div>

                <h4 className={styles.meta}>Tutor delivery materials</h4>
                {tutorDelivery.length === 0 ? (
                  <p className={styles.meta}>None attached.</p>
                ) : (
                  <ul>
                    {tutorDelivery.map((a) => {
                      const r = resourceById.get(a.resourceId);
                      return (
                        <li key={a.id}>
                          <div>
                            <strong>
                              {r?.title || r?.filename || a.resourceId}
                            </strong>
                          </div>
                          <div className={styles.meta}>
                            {labelResourceRole(a.role)} ·{" "}
                            {labelResourceAudience(a.audience)}
                          </div>
                          <button
                            type="button"
                            className={adminStyles.secondaryBtn}
                            onClick={() => void openLessonPlan(a.resourceId)}
                          >
                            View extract
                          </button>
                          {/\.(ppt|pptx|pptm)$/i.test(r?.filename || "") ? (
                            <div className={styles.meta}>
                              Open PowerPoint: original deck cannot be rendered
                              in the browser. Source remains catalogue-referenced.
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <h4 className={styles.meta}>
                  Learner learning / revision materials
                </h4>
                {learnerMaterials.length === 0 ? (
                  <p className={styles.meta}>
                    No learner learning/revision materials have been approved for
                    this Session yet.
                  </p>
                ) : (
                  <ul>
                    {learnerMaterials.map((a) => {
                      const r = resourceById.get(a.resourceId);
                      return (
                        <li key={a.id}>
                          <strong>
                            {r?.title || r?.filename || a.resourceId}
                          </strong>
                          <div className={styles.meta}>
                            {labelResourceRole(a.role)} ·{" "}
                            {labelResourceAudience(a.audience)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <h4 className={styles.meta}>Activity / practice</h4>
                {practiceMaterials.length > 0 ? (
                  <ul>
                    {practiceMaterials.map((a) => {
                      const r = resourceById.get(a.resourceId);
                      return (
                        <li key={a.id}>
                          <strong>
                            {r?.title || r?.filename || a.resourceId}
                          </strong>
                          <div className={styles.meta}>
                            {labelResourceRole(a.role)} ·{" "}
                            {labelResourceAudience(a.audience)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {candidateActivities.length > 0 ? (
                  <div className={styles.banner}>
                    <p>
                      <strong>CANDIDATE ACTIVITY FROM SOURCE</strong>
                    </p>
                    <p className={styles.meta}>
                      Surfaced from the lesson-plan extract for review. Not a
                      controlled Practice record.
                    </p>
                    <ul>
                      {candidateActivities.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                ) : practiceMaterials.length === 0 ? (
                  <p className={styles.meta}>
                    No structured activity has been authored for this Session
                    yet.
                  </p>
                ) : null}

                <h4 className={styles.meta}>
                  Task checkpoints this Session prepares for
                </h4>
                <p className={styles.meta}>
                  No Task checkpoint has been linked to this Session yet.
                </p>
                <p className={styles.meta}>
                  Tasks are Block-level evidence/assessment checkpoints and may
                  be supported by several Sessions. See the Tasks tab for the
                  five Block checkpoints. Exact release weeks are not authored
                  (S7 deferred).
                </p>

                <h4 className={styles.meta}>KSB relationships</h4>
                <p className={styles.meta}>
                  Reserved for a later phase. Not populated here.
                </p>
              </div>
            ) : (
              <p className={styles.meta}>Select a session.</p>
            )}
          </div>
        </div>
      ) : null}

      {tab === "materials" ? (
        <div>
          <h3 className={styles.meta}>Attach material to a Session</h3>
          <p className={styles.meta}>
            Role describes how the file is used. Audience controls who can open
            it. A PowerPoint is not automatically tutor-only — mark it{" "}
            <strong>Learner visible</strong> when it is suitable for apprentices.
            Tutors cannot change this later. Learner release timing separately
            controls whether learner-visible material appears with the Session or
            is held for later review.
          </p>
          <div className={styles.startLayout}>
            <label className={styles.meta}>
              Resource
              <select
                value={attachResourceId}
                onChange={(e) => setAttachResourceId(e.target.value)}
              >
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title || r.filename}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.meta}>
              Session
              <select
                value={attachSessionId}
                onChange={(e) => setAttachSessionId(e.target.value)}
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sessionKey} · W{s.calendarWeek}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.meta}>
              Role
              <select
                value={attachRole}
                onChange={(e) => {
                  const role = e.target.value as ResourceRole;
                  setAttachRole(role);
                  const nextAudience = suggestedAudienceForRole(role);
                  setAttachAudience(nextAudience);
                  if (nextAudience === "TUTOR_ONLY") {
                    setAttachLearnerReleaseTiming("WITH_SESSION");
                  }
                }}
              >
                {ROLE_OPTIONS.filter((r) =>
                  (RESOURCE_ROLES as readonly string[]).includes(r.value),
                ).map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.meta}>
              Audience
              <select
                value={attachAudience}
                onChange={(e) => {
                  const nextAudience = e.target.value as ResourceAudience;
                  setAttachAudience(nextAudience);
                  if (nextAudience !== "LEARNER_VISIBLE") {
                    setAttachLearnerReleaseTiming("WITH_SESSION");
                  }
                }}
              >
                {AUDIENCE_OPTIONS.filter((a) =>
                  (RESOURCE_AUDIENCES as readonly string[]).includes(a.value),
                ).map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <p className={styles.meta}>
              Learner visible = apprentices may eventually open it, including
              PowerPoints. Tutor only = staff only.
            </p>
            <label className={styles.meta}>
              Available to learner
              {attachAudience === "LEARNER_VISIBLE" ? (
                <select
                  value={attachLearnerReleaseTiming}
                  onChange={(e) =>
                    setAttachLearnerReleaseTiming(
                      e.target.value as LearnerReleaseTiming,
                    )
                  }
                >
                  {LEARNER_RELEASE_TIMINGS.map((value) => (
                    <option key={value} value={value}>
                      {
                        LEARNER_RELEASE_TIMING_OPTIONS.find(
                          (option) => option.value === value,
                        )?.label
                      }
                    </option>
                  ))}
                </select>
              ) : (
                <span className={styles.meta} style={{ display: "block" }}>
                  Not applicable
                </span>
              )}
            </label>
            <label className={styles.meta}>
              Sort order
              <input
                type="number"
                value={attachSort}
                onChange={(e) => setAttachSort(Number(e.target.value) || 0)}
              />
            </label>
          </div>
          <div className={styles.startActions}>
            <button
              type="button"
              className={adminStyles.primaryBtn}
              disabled={saving || !resources.length || !sessions.length}
              onClick={() => void saveAttachment()}
            >
              Attach to session
            </button>
          </div>

          <h3 className={styles.meta} style={{ marginTop: "1.25rem" }}>
            Unplaced materials
          </h3>
          <p className={styles.meta}>
            Exact Session unknown or not locked. Placement must be chosen
            manually.
          </p>
          <div className={styles.spineTableWrap}>
            <table className={styles.spineTable}>
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Role</th>
                  <th>Audience</th>
                  <th>Available to learner</th>
                  <th>Why unplaced</th>
                  <th>Place in session</th>
                </tr>
              </thead>
              <tbody>
                {unplaced.map((a) => {
                  const r = resourceById.get(a.resourceId);
                  const reason =
                    typeof a.metadata?.unplacedReason === "string"
                      ? a.metadata.unplacedReason
                      : "—";
                  return (
                    <tr key={a.id}>
                      <td>{r?.title || r?.filename || a.resourceId}</td>
                      <td>{labelResourceRole(a.role)}</td>
                      <td>{labelResourceAudience(a.audience)}</td>
                      <td>
                        {a.learnerReleaseTiming
                          ? labelLearnerReleaseTiming(a.learnerReleaseTiming)
                          : "Not applicable"}
                      </td>
                      <td className={styles.meta}>{reason}</td>
                      <td>
                        <select
                          value={placeSessionByAtt[a.id] || ""}
                          onChange={(e) =>
                            setPlaceSessionByAtt((prev) => ({
                              ...prev,
                              [a.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Choose session…</option>
                          {sessions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.sessionKey}
                            </option>
                          ))}
                        </select>{" "}
                        <button
                          type="button"
                          className={adminStyles.secondaryBtn}
                          disabled={saving}
                          onClick={() => void placeUnplaced(a.id)}
                        >
                          Place in session
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {unplaced.length === 0 ? (
              <p className={styles.meta}>No unplaced materials.</p>
            ) : null}
          </div>

          <h3 className={styles.meta} style={{ marginTop: "1.25rem" }}>
            Session attachments
          </h3>
          <div className={styles.spineTableWrap}>
            <table className={styles.spineTable}>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Resource</th>
                  <th>Role</th>
                  <th>Audience</th>
                  <th>Available to learner</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {attachments
                  .filter((a) => a.sessionId)
                  .map((a) => {
                    const r = resourceById.get(a.resourceId);
                    const s = sessions.find((x) => x.id === a.sessionId);
                    return (
                      <tr key={a.id}>
                        <td>{s?.sessionKey ?? "—"}</td>
                        <td>{r?.title || r?.filename || a.resourceId}</td>
                        <td>{labelResourceRole(a.role)}</td>
                        <td>{labelResourceAudience(a.audience)}</td>
                        <td>
                          {a.learnerReleaseTiming
                            ? labelLearnerReleaseTiming(a.learnerReleaseTiming)
                            : "Not applicable"}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={adminStyles.secondaryBtn}
                            disabled={saving}
                            onClick={() => void removeAttachment(a.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div>
          <div className={styles.banner}>
            <p>
              <strong>Block-level Task checkpoints</strong>
            </p>
            <p className={styles.meta}>
              These five Tasks are evidence / assessment checkpoints around the
              learning journey. They are not the whole Block and are not one Task
              per college Session. Exact Session release links are not authored
              yet (S7 deferred).
            </p>
          </div>
          <div className={styles.spineTableWrap}>
            <table className={styles.spineTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Kind</th>
                  <th>Form status</th>
                </tr>
              </thead>
              <tbody>
                {tasks
                  .slice()
                  .sort((a, b) => a.taskNumber - b.taskNumber)
                  .map((t) => (
                    <tr key={t.id}>
                      <td>T{t.taskNumber}</td>
                      <td>{t.title}</td>
                      <td>{t.kind}</td>
                      <td>
                        {t.publishStatus === "published"
                          ? "Published"
                          : "Draft"}{" "}
                        · form {t.form.status}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "preview" ? (
        <div>
          <div className={styles.banner}>
            <p>
              <strong>WHAT TUTOR SEES vs WHAT APPRENTICE SEES</strong>
            </p>
            <p className={styles.meta}>
              This is an authoring preview. It is not the live tutor sign-off
              workflow and does not mean the Session has been delivered.
            </p>
          </div>
          {!selectedSession ? (
            <p className={styles.meta}>
              Open the Sessions tab and select a Session first.
            </p>
          ) : (
            <div className={styles.startLayout}>
              <div>
                <h4>WHAT TUTOR SEES</h4>
                <p className={styles.meta}>
                  {selectedSession.title}
                  {selectedSession.foundationSkillCode
                    ? ` · ${selectedSession.foundationSkillCode}`
                    : ""}
                </p>
                <ul>
                  {sessionAttachments
                    .filter((a) => a.audience === "TUTOR_ONLY")
                    .map((a) => {
                      const r = resourceById.get(a.resourceId);
                      return (
                        <li key={a.id}>
                          {r?.title || r?.filename} (
                          {labelResourceRole(a.role)})
                        </li>
                      );
                    })}
                </ul>
                {selectedSession.learningObjectivesReview.status ===
                "candidate_for_review" ? (
                  <p className={styles.meta}>
                    Source learning aims remain candidates until structured
                    approval.
                  </p>
                ) : null}
              </div>
              <div>
                <h4>WHAT APPRENTICE SEES</h4>
                <p className={styles.meta}>
                  After the tutor releases the Session, apprentices receive the
                  approved learner copy plus every learner-visible resource —
                  including PowerPoints marked learner visible.
                </p>
                {approvedLearnerCopy(
                  selectedSession.learnerFacingContent,
                ) ? (
                  <>
                    <p>
                      <strong>
                        {
                          approvedLearnerCopy(
                            selectedSession.learnerFacingContent,
                          )?.summary
                        }
                      </strong>
                    </p>
                    <p className={styles.meta} style={{ whiteSpace: "pre-wrap" }}>
                      {
                        approvedLearnerCopy(
                          selectedSession.learnerFacingContent,
                        )?.learningContent
                      }
                    </p>
                    <p className={styles.meta} style={{ whiteSpace: "pre-wrap" }}>
                      {
                        approvedLearnerCopy(
                          selectedSession.learnerFacingContent,
                        )?.activityPractice
                      }
                    </p>
                  </>
                ) : (
                  <p className={styles.meta}>
                    No approved learner content yet. Candidates are not shown to
                    apprentices.
                  </p>
                )}
                {sessionAttachments.some(
                  (a) => a.audience === "LEARNER_VISIBLE",
                ) ? (
                  <ul>
                    {sessionAttachments
                      .filter((a) => a.audience === "LEARNER_VISIBLE")
                      .map((a) => {
                        const r = resourceById.get(a.resourceId);
                        return (
                          <li key={a.id}>
                            {r?.title || r?.filename} (
                            {labelResourceRole(a.role)})
                          </li>
                        );
                      })}
                  </ul>
                ) : (
                  <p className={styles.meta}>
                    No learner-visible resources attached.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {extractOpen ? (
        <div
          className={styles.banner}
          style={{ marginTop: "1rem", maxHeight: 420, overflow: "auto" }}
          role="dialog"
          aria-label="Lesson plan source extract"
        >
          <div className={styles.panelHead}>
            <h3>{extractTitle}</h3>
            <button
              type="button"
              className={adminStyles.secondaryBtn}
              onClick={() => setExtractOpen(false)}
            >
              Close
            </button>
          </div>
          {extractLoading ? (
            <p className={styles.meta}>Loading source extract…</p>
          ) : (
            <>
              <p className={styles.meta}>{extractNote}</p>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: "0.82rem",
                  margin: 0,
                }}
              >
                {extractText || "(No extract text available.)"}
              </pre>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
