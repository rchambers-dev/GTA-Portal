"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import {
  approvedLearnerCopy,
  type LearnerFacingContent,
} from "@/features/programme-definition/domain/learner-facing-content";
import { ResourcePreviewViewer } from "@/features/programme-delivery/components/ResourcePreviewViewer";
import styles from "./programme-delivery.module.css";

type RosterMember = {
  apprenticeProgrammeId: string;
  apprenticeId: string;
  displayName: string;
  apprenticeReference: string;
};

type TutorMaterialItem = {
  id: string;
  title: string;
  filename: string;
  binaryAvailable: boolean;
  extractAvailable: boolean;
  previewAvailable?: boolean;
  openLabel: string;
  extractLabel: string | null;
  downloadLabel?: string | null;
  unavailableNote: string | null;
  previewUnavailableNote?: string | null;
  viewerKind?: "slides" | "pdf" | "video" | "none";
  openMode?: "preview" | "download" | "extract" | "none";
};

type LaneSession = {
  session: {
    id: string;
    sessionKey: string;
    calendarWeek: number;
    title: string;
    learnerFacingContent?: LearnerFacingContent;
  };
  learningStatus: "coming_up" | "available";
  learningStatusLabel: string;
  isNextToTeach: boolean;
  access: {
    releasedCount: number;
    eligibleCount: number;
    latestRelease: {
      releasedAt: string;
      releasedByName: string;
    } | null;
    releasedEnrolmentIds: string[];
    reviewReleasedCount: number;
    latestReviewRelease: {
      releasedAt: string;
      releasedByName: string;
    } | null;
    reviewReleasedEnrolmentIds: string[];
  };
  tutorMaterials: {
    lessonPlans: TutorMaterialItem[];
    powerpoints: TutorMaterialItem[];
    other: TutorMaterialItem[];
  };
  learnerVisibleResources: Array<{
    id: string;
    title: string;
    filename: string;
    kindLabel: string;
    openLabel: string;
    roleLabel: string;
    binaryAvailable: boolean;
    extractAvailable: boolean;
    previewAvailable?: boolean;
    extractLabel: string | null;
    downloadLabel?: string | null;
    unavailableNote: string | null;
    previewUnavailableNote?: string | null;
    viewerKind?: "slides" | "pdf" | "video" | "none";
    openMode?: "preview" | "download" | "extract" | "none";
  }>;
  learnerReviewResources: Array<{
    id: string;
    title: string;
    filename: string;
    kindLabel: string;
    openLabel: string;
    roleLabel: string;
    binaryAvailable: boolean;
    extractAvailable: boolean;
    previewAvailable?: boolean;
    extractLabel: string | null;
    downloadLabel?: string | null;
    unavailableNote: string | null;
    previewUnavailableNote?: string | null;
    viewerKind?: "slides" | "pdf" | "video" | "none";
    openMode?: "preview" | "download" | "extract" | "none";
  }>;
  hasHeldReviewMaterials: boolean;
  approvedLearnerContent: {
    summary: string;
    learningContent: string;
    activityPractice: string;
  } | null;
  hasApprovedLearnerPackage: boolean;
};

type Bundle = {
  ok: boolean;
  error?: string;
  group?: {
    id: string;
    name: string;
    tutorName: string;
    collegeDays: string;
  };
  roster?: RosterMember[];
  programmeVersionId?: string;
  block?: { title: string; weekStart: number; weekEnd: number };
  sessions?: LaneSession[];
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TutorBlock1DeliveryScreen({
  blockNumber = 1,
}: {
  blockNumber?: 1 | 2;
}) {
  const searchParams = useSearchParams();
  const requestedGroup = searchParams.get("group")?.trim() || "";

  const [groups, setGroups] = useState<
    Array<{ id: string; name: string; apprenticeCount: number }>
  >([]);
  const [groupId, setGroupId] = useState(requestedGroup);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewConfirmOpen, setReviewConfirmOpen] = useState(false);
  const [individualOpen, setIndividualOpen] = useState(false);
  const [individualReviewOpen, setIndividualReviewOpen] = useState(false);
  const [viewLearners, setViewLearners] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [individualId, setIndividualId] = useState("");
  const [saving, setSaving] = useState(false);
  const [extractText, setExtractText] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{
    resourceId: string;
    title: string;
    viewerKind: "slides" | "pdf" | "video";
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/delivery/teaching-groups")
      .then(async (res) => {
        const json = (await res.json()) as {
          ok: boolean;
          teachingGroups?: Array<{
            id: string;
            name: string;
            apprenticeCount: number;
          }>;
        };
        if (cancelled || !json.ok) return;
        const rows = json.teachingGroups || [];
        setGroups(rows);
        setGroupId((prev) => prev || requestedGroup || rows[0]?.id || "");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [requestedGroup]);

  const load = useCallback(async () => {
    if (!groupId) {
      setBundle(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/delivery/group-block?block=${blockNumber}&teachingGroupId=${encodeURIComponent(groupId)}`,
      );
      const json = (await res.json()) as Bundle;
      if (!json.ok) throw new Error(json.error || "Load failed");
      setBundle(json);
      setSelectedSessionId((prev) => {
        if (prev && json.sessions?.some((s) => s.session.id === prev)) {
          return prev;
        }
        return (
          json.sessions?.find((s) => s.isNextToTeach)?.session.id ??
          json.sessions?.[0]?.session.id ??
          null
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [groupId, blockNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedLane = bundle?.sessions?.find(
    (s) => s.session.id === selectedSessionId,
  );
  const roster = bundle?.roster || [];
  const approved = selectedLane
    ? selectedLane.approvedLearnerContent ||
      approvedLearnerCopy(selectedLane.session.learnerFacingContent)
    : null;

  const releasedSet = useMemo(
    () => new Set(selectedLane?.access.releasedEnrolmentIds || []),
    [selectedLane],
  );
  const reviewReleasedSet = useMemo(
    () => new Set(selectedLane?.access.reviewReleasedEnrolmentIds || []),
    [selectedLane],
  );

  function openRelease() {
    setSelectedIds(roster.map((m) => m.apprenticeProgrammeId));
    setConfirmOpen(true);
    setReviewConfirmOpen(false);
    setIndividualOpen(false);
    setIndividualReviewOpen(false);
    setViewLearners(false);
  }

  function openReviewRelease() {
    setSelectedIds(roster.map((m) => m.apprenticeProgrammeId));
    setReviewConfirmOpen(true);
    setConfirmOpen(false);
    setIndividualOpen(false);
    setIndividualReviewOpen(false);
    setViewLearners(false);
  }

  function toggleSelected(id: string, alreadyReleased: boolean) {
    if (alreadyReleased) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function openFile(resourceId: string) {
    if (!bundle?.programmeVersionId) return;
    window.open(
      `/api/delivery/resources/${encodeURIComponent(resourceId)}/file?programmeVersionId=${encodeURIComponent(bundle.programmeVersionId)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function openSource(resourceId: string) {
    if (!bundle?.programmeVersionId) return;
    const res = await fetch(
      `/api/management/programme-definition/resources/extract?programmeVersionId=${encodeURIComponent(bundle.programmeVersionId)}&resourceId=${encodeURIComponent(resourceId)}`,
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

  async function submitRelease(source: "teaching_group" | "individual") {
    if (!selectedLane || !bundle?.group) return;
    const ids =
      source === "individual"
        ? individualId
          ? [individualId]
          : []
        : selectedIds;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/delivery/session-learning-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          teachingGroupId: bundle.group.id,
          sessionId: selectedLane.session.id,
          apprenticeProgrammeIds: ids,
          source,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Release failed");
      setConfirmOpen(false);
      setIndividualOpen(false);
      setViewLearners(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Release failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitReviewRelease(source: "teaching_group" | "individual") {
    if (!selectedLane || !bundle?.group) return;
    const ids =
      source === "individual"
        ? individualId
          ? [individualId]
          : []
        : selectedIds;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/delivery/session-review-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          teachingGroupId: bundle.group.id,
          sessionId: selectedLane.session.id,
          apprenticeProgrammeIds: ids,
          source,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Review release failed");
      setReviewConfirmOpen(false);
      setIndividualReviewOpen(false);
      setViewLearners(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review release failed");
    } finally {
      setSaving(false);
    }
  }

  const willReceive = roster.filter(
    (m) =>
      selectedIds.includes(m.apprenticeProgrammeId) &&
      !releasedSet.has(m.apprenticeProgrammeId),
  );
  const alreadyHave = roster.filter((m) =>
    releasedSet.has(m.apprenticeProgrammeId),
  );
  const missing = roster.filter(
    (m) => !releasedSet.has(m.apprenticeProgrammeId),
  );
  const allReleased =
    roster.length > 0 && alreadyHave.length === roster.length;
  const reviewWillReceive = roster.filter(
    (m) =>
      selectedIds.includes(m.apprenticeProgrammeId) &&
      !reviewReleasedSet.has(m.apprenticeProgrammeId),
  );
  const reviewAlreadyHave = roster.filter((m) =>
    reviewReleasedSet.has(m.apprenticeProgrammeId),
  );
  const reviewMissing = roster.filter(
    (m) => !reviewReleasedSet.has(m.apprenticeProgrammeId),
  );
  const reviewAllReleased =
    roster.length > 0 && reviewAlreadyHave.length === roster.length;

  return (
    <ApprenticePageShell
      eyebrow={`Tutor · Block ${blockNumber}`}
      title={`Block ${blockNumber} Sessions`}
      description="See the approved teaching package, then release learning to your teaching group."
    >
      <div className={styles.root}>
        <div className={styles.toolbar}>
          <Link href="/staff/programme-delivery" className={styles.back}>
            ← Programme delivery
          </Link>
          <p className={styles.blockMeta}>
            {bundle?.group?.name ||
              groups.find((g) => g.id === groupId)?.name ||
              "Teaching group"}
            {roster.length
              ? ` · ${roster.length} apprentice${roster.length === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>

        {error ? (
          <p className={styles.purposeNote} role="alert">
            {error}
          </p>
        ) : null}

        {loading && !bundle ? (
          <p className={styles.empty}>Loading Sessions…</p>
        ) : !groupId ? (
          <p className={styles.empty}>
            No teaching group is assigned to you. Go back and choose a group.
          </p>
        ) : (
          <div className={styles.deliveryLayout}>
            <div>
              <h2 className={styles.sectionTitle}>
                Weeks {bundle?.block?.weekStart ?? "—"}–
                {bundle?.block?.weekEnd ?? "—"}
              </h2>
              <p className={styles.blockMeta}>
                {bundle?.group?.name || "Teaching group"}
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
                        setReviewConfirmOpen(false);
                        setIndividualOpen(false);
                        setIndividualReviewOpen(false);
                        setViewLearners(false);
                        setExtractText(null);
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
                      <ApprenticeStatusChip
                        tone={
                          row.learningStatus === "available"
                            ? "green"
                            : row.isNextToTeach
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {row.learningStatus === "available"
                          ? "Released"
                          : row.isNextToTeach
                            ? "Next to teach"
                            : "Not released"}
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
                </div>

                <div className={styles.purpose}>
                  <p className={styles.purposeLabel}>Teaching group</p>
                  <p className={styles.purposeLead}>
                    <strong>{bundle?.group?.name}</strong>
                  </p>
                  <p className={styles.blockMeta}>
                    {roster.length} apprentice
                    {roster.length === 1 ? "" : "s"}
                  </p>
                </div>

                <div>
                  <h3 className={styles.purposeLabel}>Today&apos;s teaching</h3>
                  <p className={styles.blockMeta}>Tutor only — apprentices never see these</p>
                  <TutorResourceList
                    heading="Lesson plan"
                    items={selectedLane.tutorMaterials.lessonPlans}
                    onOpenFile={(id) => void openFile(id)}
                    onOpenPreview={(item) =>
                      setViewer({
                        resourceId: item.id,
                        title: item.title || item.filename,
                        viewerKind: item.viewerKind === "pdf" || item.viewerKind === "video" ? item.viewerKind : "slides",
                      })
                    }
                    onViewExtract={(id) => void openSource(id)}
                    empty="No tutor lesson plan is attached to this Session."
                  />
                  <TutorResourceList
                    heading="PowerPoint"
                    items={selectedLane.tutorMaterials.powerpoints}
                    onOpenFile={(id) => void openFile(id)}
                    onOpenPreview={(item) =>
                      setViewer({
                        resourceId: item.id,
                        title: item.title || item.filename,
                        viewerKind: item.viewerKind === "pdf" || item.viewerKind === "video" ? item.viewerKind : "slides",
                      })
                    }
                    onViewExtract={(id) => void openSource(id)}
                    empty="No tutor PowerPoint is attached."
                  />
                  <TutorResourceList
                    heading="Other tutor resources"
                    items={selectedLane.tutorMaterials.other}
                    onOpenFile={(id) => void openFile(id)}
                    onOpenPreview={(item) =>
                      setViewer({
                        resourceId: item.id,
                        title: item.title || item.filename,
                        viewerKind: item.viewerKind === "pdf" || item.viewerKind === "video" ? item.viewerKind : "slides",
                      })
                    }
                    onViewExtract={(id) => void openSource(id)}
                    empty=""
                  />
                  {viewer && bundle?.programmeVersionId ? (
                    viewer.viewerKind === "pdf" || viewer.viewerKind === "video" ? (
                      <div>
                        <div className={styles.chipRow}>
                          <h3 className={styles.purposeLabel}>{viewer.title}</h3>
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            onClick={() => setViewer(null)}
                          >
                            Close
                          </button>
                        </div>
                        {viewer.viewerKind === "pdf" ? (
                          <iframe
                            title={viewer.title}
                            src={`/api/delivery/resources/${encodeURIComponent(viewer.resourceId)}/file?programmeVersionId=${encodeURIComponent(bundle.programmeVersionId)}`}
                            style={{ width: "100%", minHeight: "70vh", border: 0 }}
                          />
                        ) : (
                          <video
                            controls
                            src={`/api/delivery/resources/${encodeURIComponent(viewer.resourceId)}/file?programmeVersionId=${encodeURIComponent(bundle.programmeVersionId)}`}
                            style={{ width: "100%" }}
                          />
                        )}
                      </div>
                    ) : (
                      <ResourcePreviewViewer
                        title={viewer.title}
                        previewApi={`/api/delivery/resources/${encodeURIComponent(viewer.resourceId)}/preview?programmeVersionId=${encodeURIComponent(bundle.programmeVersionId)}`}
                        slideApiBase={`/api/delivery/resources/${encodeURIComponent(viewer.resourceId)}/preview/slides`}
                        slideQuery={`programmeVersionId=${encodeURIComponent(bundle.programmeVersionId)}`}
                        onClose={() => setViewer(null)}
                      />
                    )
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
                </div>

                <div>
                  <h3 className={styles.purposeLabel}>Learner learning</h3>
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
                      No approved learner content is attached to this Session
                      yet. You cannot author curriculum from this screen.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className={styles.purposeLabel}>
                    Learning materials - with Session
                  </h3>
                  <p className={styles.blockMeta}>
                    Learners receive these when you release this Session. Held
                    review materials stay hidden until you release them later.
                  </p>
                  {selectedLane.learnerVisibleResources.length === 0 ? (
                    <p className={styles.blockMeta}>
                      No approved learner-visible resources are attached yet.
                    </p>
                  ) : (
                    <ul className={styles.objectives}>
                      {selectedLane.learnerVisibleResources.map((r) => (
                        <li key={r.id}>
                          <strong>{r.kindLabel}</strong>
                          {" · "}
                          {r.title}
                          {r.previewUnavailableNote ? (
                            <p className={styles.blockMeta}>{r.previewUnavailableNote}</p>
                          ) : null}
                          <div className={styles.chipRow} style={{ marginTop: 6 }}>
                            {r.openMode === "preview" ? (
                              <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={() =>
                                  setViewer({
                                    resourceId: r.id,
                                    title: r.title,
                                    viewerKind:
                                      r.viewerKind === "pdf" || r.viewerKind === "video"
                                        ? r.viewerKind
                                        : "slides",
                                  })
                                }
                              >
                                {r.openLabel}
                              </button>
                            ) : r.openMode === "download" || r.binaryAvailable ? (
                              <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={() => void openFile(r.id)}
                              >
                                {r.downloadLabel || r.openLabel}
                              </button>
                            ) : (
                              <span className={styles.blockMeta}>
                                {r.unavailableNote ||
                                  "Original file not currently available"}
                              </span>
                            )}
                            {r.downloadLabel && r.openMode === "preview" ? (
                              <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={() => void openFile(r.id)}
                              >
                                {r.downloadLabel}
                              </button>
                            ) : null}
                            {r.extractAvailable ? (
                              <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={() => void openSource(r.id)}
                              >
                                {r.extractLabel || "View extract"}
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {selectedLane.hasHeldReviewMaterials ? (
                  <div>
                    <h3 className={styles.purposeLabel}>
                      Review materials - held
                    </h3>
                    <p className={styles.blockMeta}>
                      Learners do not receive these from Session release alone.
                      Tutors can preview them here but cannot reclassify them.
                    </p>
                    {selectedLane.learnerReviewResources.length === 0 ? (
                      <p className={styles.blockMeta}>
                        No learner-visible review materials are attached.
                      </p>
                    ) : (
                      <ul className={styles.objectives}>
                        {selectedLane.learnerReviewResources.map((r) => (
                          <li key={r.id}>
                            <strong>{r.kindLabel}</strong>
                            {" · "}
                            {r.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}

                <div>
                  <h3 className={styles.purposeLabel}>Activity / practice</h3>
                  <p
                    className={styles.purposeLead}
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {approved?.activityPractice ||
                      "No approved activity/practice is attached yet."}
                  </p>
                </div>

                <div className={styles.purpose}>
                  <h3 className={styles.purposeLabel}>Learner access</h3>
                  {allReleased ? (
                    <>
                      <p className={styles.purposeLead}>
                        Released to {selectedLane.access.releasedCount}{" "}
                        apprentice
                        {selectedLane.access.releasedCount === 1 ? "" : "s"}
                      </p>
                      {selectedLane.access.latestRelease ? (
                        <>
                          <p className={styles.blockMeta}>
                            Released by:{" "}
                            {selectedLane.access.latestRelease.releasedByName}
                          </p>
                          <p className={styles.blockMeta}>
                            Released:{" "}
                            {formatWhen(
                              selectedLane.access.latestRelease.releasedAt,
                            )}
                          </p>
                        </>
                      ) : null}
                    </>
                  ) : selectedLane.access.releasedCount > 0 ? (
                    <p className={styles.purposeLead}>
                      {selectedLane.access.releasedCount} already have access ·{" "}
                      {missing.length} will receive access if released now
                    </p>
                  ) : (
                    <p className={styles.purposeLead}>Not released</p>
                  )}
                  {selectedLane.hasHeldReviewMaterials ? (
                    <p className={styles.blockMeta}>
                      Review materials:{" "}
                      {reviewAllReleased
                        ? `Released to ${selectedLane.access.reviewReleasedCount} apprentice${selectedLane.access.reviewReleasedCount === 1 ? "" : "s"}`
                        : selectedLane.access.reviewReleasedCount > 0
                          ? `${selectedLane.access.reviewReleasedCount} already have review access · ${reviewMissing.length} will receive access if released now`
                          : "Not released"}
                    </p>
                  ) : null}

                  {confirmOpen ? (
                    <div>
                      <h3 className={styles.sectionTitle}>
                        Release {selectedLane.session.sessionKey} to{" "}
                        {bundle?.group?.name}?
                      </h3>
                      <p className={styles.purposeLead}>
                        {willReceive.length} apprentice
                        {willReceive.length === 1 ? "" : "s"} will receive
                        access to the approved learner learning package.
                        {alreadyHave.length
                          ? ` ${alreadyHave.length} already have access.`
                          : ""}
                      </p>
                      <p className={styles.blockMeta}>
                        This does not record attendance or completion.
                      </p>
                      {selectedLane.learnerVisibleResources.length > 0 ? (
                        <>
                          <p className={styles.blockMeta}>
                            They will be able to open:
                          </p>
                          <ul className={styles.objectives}>
                            {selectedLane.learnerVisibleResources.map((r) => (
                              <li key={r.id}>
                                {r.kindLabel} · {r.title}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p className={styles.blockMeta}>
                          No learner-visible files are attached yet. Approved
                          learner copy will still be released.
                        </p>
                      )}
                      <ul className={styles.rosterList}>
                        {roster.map((member) => {
                          const already = releasedSet.has(
                            member.apprenticeProgrammeId,
                          );
                          const checked = selectedIds.includes(
                            member.apprenticeProgrammeId,
                          );
                          return (
                            <li key={member.apprenticeProgrammeId}>
                              <label className={styles.rosterItem}>
                                <input
                                  type="checkbox"
                                  checked={already || checked}
                                  disabled={already}
                                  onChange={() =>
                                    toggleSelected(
                                      member.apprenticeProgrammeId,
                                      already,
                                    )
                                  }
                                />
                                <span>
                                  {member.displayName}
                                  {already ? " · already has access" : ""}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                      <p className={styles.blockMeta}>
                        {willReceive.length} apprentice
                        {willReceive.length === 1 ? "" : "s"} selected to
                        receive access
                      </p>
                      <div className={styles.chipRow}>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          disabled={saving || willReceive.length === 0}
                          onClick={() => void submitRelease("teaching_group")}
                        >
                          {saving ? "Releasing…" : "Release learning"}
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
                  ) : reviewConfirmOpen ? (
                    <div>
                      <h3 className={styles.sectionTitle}>
                        Release review materials for {selectedLane.session.sessionKey}?
                      </h3>
                      <p className={styles.purposeLead}>
                        {reviewWillReceive.length} apprentice
                        {reviewWillReceive.length === 1 ? "" : "s"} will receive
                        access to held review materials.
                        {reviewAlreadyHave.length
                          ? ` ${reviewAlreadyHave.length} already have access.`
                          : ""}
                      </p>
                      <p className={styles.blockMeta}>
                        This does not record attendance or completion.
                      </p>
                      <ul className={styles.objectives}>
                        {selectedLane.learnerReviewResources.map((r) => (
                          <li key={r.id}>
                            {r.kindLabel} · {r.title}
                          </li>
                        ))}
                      </ul>
                      <ul className={styles.rosterList}>
                        {roster.map((member) => {
                          const already = reviewReleasedSet.has(
                            member.apprenticeProgrammeId,
                          );
                          const checked = selectedIds.includes(
                            member.apprenticeProgrammeId,
                          );
                          return (
                            <li key={member.apprenticeProgrammeId}>
                              <label className={styles.rosterItem}>
                                <input
                                  type="checkbox"
                                  checked={already || checked}
                                  disabled={already}
                                  onChange={() =>
                                    toggleSelected(
                                      member.apprenticeProgrammeId,
                                      already,
                                    )
                                  }
                                />
                                <span>
                                  {member.displayName}
                                  {already ? " · already has review access" : ""}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                      <div className={styles.chipRow}>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          disabled={saving || reviewWillReceive.length === 0}
                          onClick={() => void submitReviewRelease("teaching_group")}
                        >
                          {saving ? "Releasing…" : "Release review materials"}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => setReviewConfirmOpen(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : individualOpen ? (
                    <div>
                      <h3 className={styles.sectionTitle}>
                        Release to individual
                      </h3>
                      <p className={styles.purposeLead}>
                        Use this for a late joiner, catch-up learner, or someone
                        left out of the original group release.
                      </p>
                      {missing.length === 0 ? (
                        <p className={styles.blockMeta}>
                          Everyone in this teaching group already has access.
                        </p>
                      ) : (
                        <ul className={styles.rosterList}>
                          {missing.map((member) => (
                            <li key={member.apprenticeProgrammeId}>
                              <label className={styles.rosterItem}>
                                <input
                                  type="radio"
                                  name="individual-release"
                                  checked={
                                    individualId ===
                                    member.apprenticeProgrammeId
                                  }
                                  onChange={() =>
                                    setIndividualId(
                                      member.apprenticeProgrammeId,
                                    )
                                  }
                                />
                                <span>{member.displayName}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className={styles.chipRow}>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          disabled={saving || !individualId}
                          onClick={() => void submitRelease("individual")}
                        >
                          {saving ? "Releasing…" : "Release to individual"}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => setIndividualOpen(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : individualReviewOpen ? (
                    <div>
                      <h3 className={styles.sectionTitle}>
                        Release review materials to individual
                      </h3>
                      <p className={styles.purposeLead}>
                        Use this for a late joiner, catch-up learner, or someone
                        left out of the original group review release.
                      </p>
                      {reviewMissing.length === 0 ? (
                        <p className={styles.blockMeta}>
                          Everyone in this teaching group already has review access.
                        </p>
                      ) : (
                        <ul className={styles.rosterList}>
                          {reviewMissing.map((member) => (
                            <li key={member.apprenticeProgrammeId}>
                              <label className={styles.rosterItem}>
                                <input
                                  type="radio"
                                  name="individual-review-release"
                                  checked={
                                    individualId === member.apprenticeProgrammeId
                                  }
                                  onChange={() =>
                                    setIndividualId(member.apprenticeProgrammeId)
                                  }
                                />
                                <span>{member.displayName}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className={styles.chipRow}>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          disabled={saving || !individualId}
                          onClick={() => void submitReviewRelease("individual")}
                        >
                          {saving ? "Releasing…" : "Release review to individual"}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => setIndividualReviewOpen(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.chipRow}>
                      {!allReleased ? (
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          onClick={openRelease}
                        >
                          Release learning to group
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => {
                          setIndividualOpen(true);
                          setConfirmOpen(false);
                          setReviewConfirmOpen(false);
                          setIndividualReviewOpen(false);
                          setIndividualId(missing[0]?.apprenticeProgrammeId || "");
                        }}
                      >
                        Release to individual
                      </button>
                      {selectedLane.hasHeldReviewMaterials ? (
                        <>
                          {!reviewAllReleased ? (
                            <button
                              type="button"
                              className={styles.primaryBtn}
                              onClick={openReviewRelease}
                            >
                              Release review materials
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            onClick={() => {
                              setIndividualReviewOpen(true);
                              setConfirmOpen(false);
                              setReviewConfirmOpen(false);
                              setIndividualOpen(false);
                              setIndividualId(
                                reviewMissing[0]?.apprenticeProgrammeId || "",
                              );
                            }}
                          >
                            Release review to individual
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => setViewLearners((v) => !v)}
                      >
                        {viewLearners ? "Hide learners" : "View learners"}
                      </button>
                    </div>
                  )}

                  {viewLearners &&
                  !confirmOpen &&
                  !reviewConfirmOpen &&
                  !individualOpen &&
                  !individualReviewOpen ? (
                    <ul className={styles.rosterList}>
                      {roster.map((member) => (
                        <li key={member.apprenticeProgrammeId}>
                          {member.displayName}
                          {releasedSet.has(member.apprenticeProgrammeId)
                            ? reviewReleasedSet.has(member.apprenticeProgrammeId)
                              ? " · learning + review granted"
                              : " · learning granted"
                            : " · not released"}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            ) : (
              <p className={styles.empty}>Choose a Session from the list.</p>
            )}
          </div>
        )}
      </div>
    </ApprenticePageShell>
  );
}

function TutorResourceList({
  heading,
  items,
  onOpenFile,
  onOpenPreview,
  onViewExtract,
  empty,
}: {
  heading: string;
  items: TutorMaterialItem[];
  onOpenFile: (id: string) => void;
  onOpenPreview: (item: TutorMaterialItem) => void;
  onViewExtract: (id: string) => void;
  empty: string;
}) {
  if (items.length === 0) {
    return empty ? <p className={styles.blockMeta}>{empty}</p> : null;
  }
  return (
    <div>
      <p className={styles.blockMeta}>{heading}</p>
      <ul className={styles.objectives}>
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.title || item.filename}</strong>
            {item.previewUnavailableNote ? (
              <p className={styles.blockMeta}>{item.previewUnavailableNote}</p>
            ) : null}
            {!item.binaryAvailable ? (
              <p className={styles.blockMeta}>
                {item.unavailableNote ||
                  "Original file not currently available"}
              </p>
            ) : null}
            <div className={styles.chipRow} style={{ marginTop: 6 }}>
              {item.openMode === "preview" ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => onOpenPreview(item)}
                >
                  {item.openLabel}
                </button>
              ) : item.binaryAvailable ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => onOpenFile(item.id)}
                >
                  {item.downloadLabel || item.openLabel}
                </button>
              ) : null}
              {item.downloadLabel && item.openMode === "preview" ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => onOpenFile(item.id)}
                >
                  {item.downloadLabel}
                </button>
              ) : null}
              {item.extractAvailable ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => onViewExtract(item.id)}
                >
                  {item.extractLabel || "View extract"}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
