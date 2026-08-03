"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import {
  ceaStatusLabel,
  ceaStatusTone,
  emptyCeaTaskProgress,
  getGroupsPackById,
  type CeaFieldReviewStatus,
  type CeaReviewComment,
  type CeaTaskProgress,
} from "@/features/apprentice-portal/domain/cea";
import {
  getAuthoredTaskForm,
  subscribeCourseBuilder,
  getCourseBuilderSnapshot,
  getCourseBuilderServerSnapshot,
} from "@/features/programme-delivery/domain/course-builder-store";
import { modulesToSections } from "@/features/programme-delivery/domain/form-modules";
import {
  isApprenticeEditableField,
  TaskFieldInput,
} from "@/features/programme-delivery/components/TaskFieldInput";
import { formatDisplayDate } from "@/features/apprentice-lifecycle/domain/programme-week";
import styles from "./programme-delivery.module.css";

type Props = {
  apprenticeId: string;
  packId: string;
  taskId: string;
  audience?: "teacher" | "employer";
};

/**
 * Full CEA document review — field ticks, Word-style comments, return / sign-off.
 */
export function TutorCeaTaskReviewScreen({
  apprenticeId,
  packId,
  taskId,
  audience = "teacher",
}: Props) {
  useSyncExternalStore(
    subscribeCourseBuilder,
    getCourseBuilderSnapshot,
    getCourseBuilderServerSnapshot,
  );

  const pack = getGroupsPackById(packId);
  const group = pack?.groups.find((g) => g.tasks.some((t) => t.id === taskId));
  const task = group?.tasks.find((t) => t.id === taskId);

  const [progress, setProgress] = useState<CeaTaskProgress | null>(null);
  const [apprenticeName, setApprenticeName] = useState("Apprentice");
  const [fieldReviews, setFieldReviews] = useState<
    Record<string, CeaFieldReviewStatus>
  >({});
  const [comments, setComments] = useState<CeaReviewComment[]>([]);
  const [tutorReview, setTutorReview] = useState("");
  const [draftComment, setDraftComment] = useState("");
  const [commentFieldKey, setCommentFieldKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const backHref =
    audience === "employer"
      ? "/employer/cea-sign-offs"
      : "/staff/cea-sign-offs";

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/apprentice/cea-state?apprenticeId=${encodeURIComponent(apprenticeId)}&packId=${encodeURIComponent(packId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        state?: { progress?: Record<string, CeaTaskProgress> };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load document");
      const raw = json.state?.progress?.[taskId];
      const next = raw
        ? { ...emptyCeaTaskProgress(taskId, raw.kind), ...raw }
        : emptyCeaTaskProgress(taskId, "mandatory");
      setProgress(next);
      setFieldReviews(next.fieldReviews ?? {});
      setComments(next.comments ?? []);
      setTutorReview(next.tutorReview ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [apprenticeId, packId, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/staff/cea-sign-offs?audience=${audience}`,
        );
        const json = (await res.json().catch(() => ({}))) as {
          queue?: Array<{ apprenticeId: string; apprenticeName: string }>;
        };
        const hit = json.queue?.find((q) => q.apprenticeId === apprenticeId);
        if (hit) setApprenticeName(hit.apprenticeName);
      } catch {
        // name is optional
      }
    })();
  }, [apprenticeId, audience]);

  const form = pack && task ? getAuthoredTaskForm(pack.id, taskId, task.title) : null;
  const sections = useMemo(
    () => (form ? modulesToSections(form.modules) : []),
    [form],
  );
  const fieldKeys = useMemo(
    () =>
      sections
        .flatMap((s) => s.fields)
        .filter(
          (f) =>
            isApprenticeEditableField(f) &&
            f.type !== "heading" &&
            f.type !== "description",
        )
        .map((f) => f.key),
    [sections],
  );

  async function post(
    action: "sign_off" | "return" | "save_review",
    extra?: { addComment?: { fieldKey?: string | null; text: string } },
  ) {
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      const res = await fetch("/api/staff/cea-sign-offs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apprenticeId,
          packId,
          taskId,
          action,
          audience,
          tutorReview,
          fieldReviews,
          returnNote: tutorReview,
          comments,
          ...extra,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        task?: CeaTaskProgress;
      };
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      if (json.task) {
        setProgress(json.task);
        setFieldReviews(json.task.fieldReviews ?? {});
        setComments(json.task.comments ?? []);
        setTutorReview(json.task.tutorReview ?? "");
      }
      setFlash(
        action === "sign_off"
          ? "Signed off."
          : action === "return"
            ? "Returned to apprentice."
            : "Review saved.",
      );
      if (extra?.addComment) {
        setDraftComment("");
        setCommentFieldKey(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!pack || !task || !group) {
    return (
      <ApprenticePageShell eyebrow="Review" title="Task not found" description="">
        <Link href={backHref} className={styles.back}>
          ← Back to queue
        </Link>
      </ApprenticePageShell>
    );
  }

  const openComments = comments.filter((c) => !c.resolved);
  const canDecide =
    progress?.status === "ready_to_assess" ||
    progress?.status === "awaiting_tutor_verify";
  const signOffLabel =
    audience === "employer"
      ? "Approve for tutor"
      : progress?.kind === "additional"
        ? "Verify & sign off"
        : "Sign off";

  return (
    <ApprenticePageShell
      eyebrow={audience === "employer" ? "Employer review" : "Tutor review"}
      title={`Task ${task.number}: ${task.title}`}
      description={`${apprenticeName} · Group ${group.number} · ${group.title}`}
    >
      <div className={styles.root}>
        <Link href={backHref} className={styles.back}>
          ← Back to queue
        </Link>

        <div className={styles.purpose}>
          <p className={styles.purposeLead}>
            {progress ? (
              <ApprenticeStatusChip tone={ceaStatusTone(progress.status)}>
                {ceaStatusLabel(progress.status)}
              </ApprenticeStatusChip>
            ) : null}
            {progress?.isResubmission ? " · Resubmission" : ""}
            {progress && progress.submissionCount > 0
              ? ` · Version ${progress.submissionCount}`
              : ""}
          </p>
          <p className={styles.purposeBody}>
            {audience === "employer"
              ? "Approve first. The tutor must still verify before this workplace task is fully signed off."
              : progress?.kind === "additional"
                ? "Employer has already approved. Verify the document, then sign off — or return for amendments."
                : "Tick each part that is correct. Mark parts that need amendment — only those stay editable for the apprentice."}
          </p>
          {progress?.employerSignedByName ? (
            <p className={styles.purposeNote}>
              Employer approved by {progress.employerSignedByName}
              {progress.employerSignedAt
                ? ` · ${formatDisplayDate(new Date(progress.employerSignedAt))}`
                : ""}
            </p>
          ) : null}
        </div>

        {error ? (
          <p className={styles.empty} role="alert">
            {error}
          </p>
        ) : null}
        {flash ? <p className={styles.empty}>{flash}</p> : null}

        <div className={styles.docLayout}>
          <div className={styles.docPage}>
            {sections.map((section) => (
              <section key={section.id}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                <div className={styles.formStack}>
                  {section.fields.map((field) => {
                    if (
                      field.type === "heading" ||
                      field.type === "description"
                    ) {
                      return (
                        <p key={field.key} className={styles.purposeBody}>
                          {field.label}
                        </p>
                      );
                    }
                    if (!isApprenticeEditableField(field)) return null;
                    const review = fieldReviews[field.key] ?? "open";
                    return (
                      <div
                        key={field.key}
                        className={styles.docFieldRow}
                        data-review={review}
                      >
                        <div className={styles.docFieldMeta}>
                          <span className={styles.fieldLabel}>{field.label}</span>
                          {canDecide ? (
                            <div className={styles.docFieldActions}>
                              <button
                                type="button"
                                className={styles.tinyBtn}
                                data-active={review === "approved"}
                                onClick={() =>
                                  setFieldReviews((prev) => ({
                                    ...prev,
                                    [field.key]: "approved",
                                  }))
                                }
                              >
                                Correct
                              </button>
                              <button
                                type="button"
                                className={styles.tinyBtn}
                                data-tone="amend"
                                data-active={review === "needs_amendment"}
                                onClick={() =>
                                  setFieldReviews((prev) => ({
                                    ...prev,
                                    [field.key]: "needs_amendment",
                                  }))
                                }
                              >
                                Needs amend
                              </button>
                              <button
                                type="button"
                                className={styles.tinyBtn}
                                onClick={() => setCommentFieldKey(field.key)}
                              >
                                Comment
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <TaskFieldInput
                          field={field}
                          value={progress?.fields[field.key] ?? ""}
                          disabled
                          onChange={() => undefined}
                        />
                        {comments
                          .filter((c) => c.fieldKey === field.key && !c.resolved)
                          .map((c) => (
                            <article key={c.id} className={styles.commentCard}>
                              <p className={styles.commentMeta}>
                                {c.by} · {formatDisplayDate(new Date(c.at))}
                              </p>
                              <p className={styles.commentText}>{c.text}</p>
                            </article>
                          ))}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            <section className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>Overall review</h2>
              <textarea
                className={styles.textarea}
                rows={4}
                value={tutorReview}
                disabled={!canDecide}
                onChange={(e) => setTutorReview(e.target.value)}
                placeholder="Written review for the apprentice…"
              />
              {canDecide ? (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    disabled={busy}
                    onClick={() => {
                      const next: Record<string, CeaFieldReviewStatus> = {
                        ...fieldReviews,
                      };
                      for (const key of fieldKeys) next[key] = "approved";
                      setFieldReviews(next);
                    }}
                  >
                    Mark all correct
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    disabled={busy}
                    onClick={() => void post("save_review")}
                  >
                    Save review
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    disabled={busy}
                    onClick={() => void post("return")}
                  >
                    Return for amendments
                  </button>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    disabled={busy}
                    onClick={() => void post("sign_off")}
                  >
                    {signOffLabel}
                  </button>
                </div>
              ) : null}
            </section>
          </div>

          <aside className={styles.commentRail}>
            <h2 className={styles.sectionTitle}>Comments</h2>
            {canDecide ? (
              <div className={styles.formStack}>
                <p className={styles.fieldHint}>
                  {commentFieldKey
                    ? `Comment on: ${commentFieldKey}`
                    : "Overall comment (or pick Comment on a part)"}
                </p>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={draftComment}
                  onChange={(e) => setDraftComment(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={busy || !draftComment.trim()}
                  onClick={() =>
                    void post("save_review", {
                      addComment: {
                        fieldKey: commentFieldKey,
                        text: draftComment,
                      },
                    })
                  }
                >
                  Add comment
                </button>
              </div>
            ) : null}

            {openComments.length === 0 ? (
              <p className={styles.fieldHint}>No open comments yet.</p>
            ) : (
              openComments.map((c) => (
                <article
                  key={c.id}
                  className={styles.commentCard}
                  data-resolved={c.resolved ? "true" : "false"}
                >
                  <p className={styles.commentMeta}>
                    {c.by} · {formatDisplayDate(new Date(c.at))}
                    {c.fieldKey ? ` · ${c.fieldKey}` : " · overall"}
                  </p>
                  <p className={styles.commentText}>{c.text}</p>
                </article>
              ))
            )}

            {progress && progress.versions.length > 0 ? (
              <>
                <h2 className={styles.sectionTitle}>History</h2>
                <ul className={styles.versionList}>
                  {[...progress.versions].reverse().map((v) => (
                    <li key={v.version}>
                      Version {v.version}
                      {v.isResubmission ? " · resubmission" : ""}
                      {" · "}
                      {formatDisplayDate(new Date(v.submittedAt))}
                      {v.outcome ? ` · ${v.outcome.replace("_", " ")}` : ""}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </aside>
        </div>
      </div>
    </ApprenticePageShell>
  );
}
