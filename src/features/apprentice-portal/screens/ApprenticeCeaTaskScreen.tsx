"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { useApprenticePortalProfile } from "@/features/apprentice-portal/hooks/useApprenticePortalProfile";
import {
  ceaStatusLabel,
  ceaStatusTone,
  emptyCeaTaskProgress,
  ensureCeaStateLoaded,
  flushCeaStateSave,
  getCachedCeaState,
  getCeaStateStoreServerSnapshot,
  getCeaStateStoreSnapshot,
  isCeaFieldEditableForApprentice,
  isMandatoryAllocated,
  resolveGroupsPack,
  subscribeCeaStateStore,
  updateCeaState,
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
import styles from "@/features/programme-delivery/screens/programme-delivery.module.css";

type Props = { taskId: string };

/**
 * Groups-spine CEA task document — fill Course Builder form, declare, submit.
 */
export function ApprenticeCeaTaskScreen({ taskId }: Props) {
  const { profile } = useApprenticePortalProfile();
  const apprenticeId = profile.apprenticeId ?? "";
  const ceaSnap = useSyncExternalStore(
    subscribeCeaStateStore,
    getCeaStateStoreSnapshot,
    getCeaStateStoreServerSnapshot,
  );
  useSyncExternalStore(
    subscribeCourseBuilder,
    getCourseBuilderSnapshot,
    getCourseBuilderServerSnapshot,
  );

  const pack = useMemo(
    () =>
      resolveGroupsPack(
        profile.standardCode ?? "ST0499",
        profile.standardVersion ?? "1.2",
      ),
    [profile.standardCode, profile.standardVersion],
  );

  useEffect(() => {
    if (!apprenticeId || !pack?.id) return;
    void ensureCeaStateLoaded(apprenticeId, pack.id, { force: true });
  }, [apprenticeId, pack?.id]);

  const cached = apprenticeId && pack ? getCachedCeaState(apprenticeId, pack.id) : null;
  void ceaSnap;
  const state = cached?.state;

  const group = pack?.groups.find((g) => g.tasks.some((t) => t.id === taskId));
  const task = group?.tasks.find((t) => t.id === taskId);
  const allocated =
    state && group
      ? isMandatoryAllocated(state, group.id, taskId)
      : Boolean(task?.alwaysMandatory);

  const progress = useMemo(() => {
    if (!task) return emptyCeaTaskProgress(taskId, "mandatory");
    const raw = state?.progress[taskId];
    const kind =
      raw?.kind ??
      (allocated || task.alwaysMandatory ? "mandatory" : "additional");
    return raw ? { ...emptyCeaTaskProgress(taskId, kind), ...raw } : emptyCeaTaskProgress(taskId, kind);
  }, [allocated, state?.progress, task, taskId]);

  const form = pack && task ? getAuthoredTaskForm(pack.id, taskId, task.title) : null;
  const sections = useMemo(
    () => (form ? modulesToSections(form.modules) : []),
    [form],
  );
  const apprenticeFields = useMemo(
    () =>
      sections
        .flatMap((s) => s.fields)
        .filter((f) => isApprenticeEditableField(f) && f.type !== "heading" && f.type !== "description"),
    [sections],
  );

  const [fields, setFields] = useState<Record<string, string>>(progress.fields);
  const [declared, setDeclared] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFields(progress.fields);
    setDeclared(false);
  }, [progress.taskId, progress.submissionCount, progress.status]);

  const locked =
    progress.status === "ready_to_assess" ||
    progress.status === "awaiting_tutor_verify" ||
    progress.status === "signed_off";

  useEffect(() => {
    if (!apprenticeId || !pack || locked || !dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateCeaState(apprenticeId, pack.id, (prev) => {
        const existing =
          prev.progress[taskId] ??
          emptyCeaTaskProgress(
            taskId,
            allocated || task?.alwaysMandatory ? "mandatory" : "additional",
          );
        return {
          ...prev,
          progress: {
            ...prev.progress,
            [taskId]: {
              ...existing,
              fields,
              status:
                existing.status === "not_started" || existing.status === "returned"
                  ? "in_progress"
                  : existing.status,
            },
          },
        };
      });
      setDirty(false);
    }, 450);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [allocated, apprenticeId, dirty, fields, locked, pack, task?.alwaysMandatory, taskId]);

  if (!pack || !task || !group) {
    return (
      <ApprenticePageShell title="Task not found" description="">
        <Link href="/apprentice/progress" className={styles.back}>
          ← Back to Progress
        </Link>
      </ApprenticePageShell>
    );
  }

  async function submit() {
    if (!declared) {
      setMessage("Tick “this is my own work” before submitting.");
      return;
    }
    if (!apprenticeId || !pack || !task) return;
    setBusy(true);
    setMessage(null);
    try {
      const kind =
        allocated || task.alwaysMandatory ? "mandatory" : "additional";
      updateCeaState(apprenticeId, pack.id, (prev) => {
        const existing =
          prev.progress[taskId] ?? emptyCeaTaskProgress(taskId, kind);
        const now = new Date().toISOString();
        return {
          ...prev,
          progress: {
            ...prev.progress,
            [taskId]: {
              ...existing,
              fields,
              status: "ready_to_assess",
              apprenticeDeclaredAt: now,
              readyAt: now,
            },
          },
        };
      });
      await flushCeaStateSave(apprenticeId, pack.id);
      setMessage(
        progress.status === "returned" || progress.submissionCount > 0
          ? "Resubmitted — waiting for review."
          : "Submitted — waiting for review.",
      );
    } finally {
      setBusy(false);
    }
  }

  const openComments = progress.comments.filter((c) => !c.resolved);

  return (
    <ApprenticePageShell
      eyebrow={`Group ${group.number}`}
      title={`Task ${task.number}: ${task.title}`}
      description={group.title}
    >
      <div className={styles.root}>
        <Link href="/apprentice/progress" className={styles.back}>
          ← Back to Progress
        </Link>

        <div className={styles.purpose}>
          <p className={styles.purposeLead}>
            <ApprenticeStatusChip tone={ceaStatusTone(progress.status)}>
              {ceaStatusLabel(progress.status)}
            </ApprenticeStatusChip>
            {progress.isResubmission ? " · Resubmission" : ""}
            {progress.submissionCount > 0
              ? ` · Version ${progress.submissionCount}`
              : ""}
          </p>
          {progress.status === "returned" && progress.returnNote ? (
            <p className={styles.purposeNote}>
              <strong>Returned:</strong> {progress.returnNote}
            </p>
          ) : null}
          {progress.status === "awaiting_tutor_verify" ? (
            <p className={styles.purposeNote}>
              Employer approved
              {progress.employerSignedByName
                ? ` by ${progress.employerSignedByName}`
                : ""}
              . Waiting for tutor verification.
            </p>
          ) : null}
          {progress.tutorReview ? (
            <p className={styles.purposeBody}>
              <strong>Reviewer note:</strong> {progress.tutorReview}
            </p>
          ) : null}
        </div>

        <div className={styles.docLayout}>
          <div className={styles.docPage}>
            {sections.map((section) => (
              <section key={section.id}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                <div className={styles.formStack}>
                  {section.fields.map((field) => {
                    if (field.type === "heading" || field.type === "description") {
                      return (
                        <p key={field.key} className={styles.purposeBody}>
                          {field.label}
                        </p>
                      );
                    }
                    if (!isApprenticeEditableField(field)) return null;
                    const editable = isCeaFieldEditableForApprentice(
                      progress,
                      field.key,
                    );
                    const review = progress.fieldReviews[field.key] ?? "open";
                    return (
                      <div
                        key={field.key}
                        className={styles.docFieldRow}
                        data-review={
                          progress.status === "returned" ? review : undefined
                        }
                      >
                        <div className={styles.docFieldMeta}>
                          {review === "approved" && progress.status === "returned" ? (
                            <ApprenticeStatusChip tone="green">
                              Approved — no edit needed
                            </ApprenticeStatusChip>
                          ) : null}
                          {review === "needs_amendment" ? (
                            <ApprenticeStatusChip tone="amber">
                              Amend this part
                            </ApprenticeStatusChip>
                          ) : null}
                        </div>
                        <TaskFieldInput
                          field={field}
                          value={fields[field.key] ?? ""}
                          disabled={!editable || locked}
                          onChange={(next) => {
                            setFields((prev) => ({ ...prev, [field.key]: next }));
                            setDirty(true);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            {!locked && apprenticeFields.length > 0 ? (
              <div className={styles.declareRow}>
                <input
                  id="cea-declare"
                  type="checkbox"
                  checked={declared}
                  onChange={(e) => setDeclared(e.target.checked)}
                />
                <label htmlFor="cea-declare">
                  I confirm this is my own work and I am ready to submit it for
                  review{progress.status === "returned" ? " (resubmission)" : ""}.
                </label>
              </div>
            ) : null}

            {!locked ? (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={busy || !declared}
                  onClick={() => void submit()}
                >
                  {busy
                    ? "Submitting…"
                    : progress.status === "returned"
                      ? "Resubmit work"
                      : "Submit work"}
                </button>
              </div>
            ) : null}
            {message ? <p className={styles.purposeBody}>{message}</p> : null}
          </div>

          <aside className={styles.commentRail}>
            <h2 className={styles.sectionTitle}>Comments</h2>
            {openComments.length === 0 ? (
              <p className={styles.fieldHint}>No open reviewer comments.</p>
            ) : (
              openComments.map((c) => (
                <article key={c.id} className={styles.commentCard}>
                  <p className={styles.commentMeta}>
                    {c.by} · {formatDisplayDate(new Date(c.at))}
                    {c.fieldKey ? ` · on ${c.fieldKey}` : ""}
                  </p>
                  <p className={styles.commentText}>{c.text}</p>
                </article>
              ))
            )}

            {progress.versions.length > 0 ? (
              <>
                <h2 className={styles.sectionTitle}>Submission history</h2>
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
