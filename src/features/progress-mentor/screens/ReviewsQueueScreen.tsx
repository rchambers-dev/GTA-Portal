"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  MentorPageShell,
  StatusChip,
  ViewTabs,
} from "../components/MentorWorkQueue";
import { ACTION_RECORDS } from "../domain/actions/mock-store";
import {
  humanSourceLabel,
  lastCycleActionsForReview,
} from "../domain/actions/cycle";
import { createFormalReviewFromRequirement } from "../domain/reviews/create-review";
import {
  FORMAL_REVIEWS,
  REVIEW_REQUIREMENTS,
  updateRequirement,
} from "../domain/reviews/mock-store";
import {
  canCreateReview,
  checklistStateLabel,
  hardItemsIncomplete,
  primaryActionForRequirement,
  readinessStatusLabel,
  softItemsIncomplete,
} from "../domain/reviews/readiness";
import {
  REVIEW_CYCLE_WEEKS,
  REVIEW_READY_LEAD_DAYS,
  daysUntilReadyBy,
} from "../domain/reviews/policy";
import type {
  ChecklistItemState,
  FormalReview,
  ReviewRequirement,
  ReviewsTabId,
} from "../domain/reviews/types";
import { MENTOR_BASE } from "../lib/metric-links";
import { MENTOR_ID, MENTOR_APPRENTICES, MENTOR_NAME } from "../data/mentor-caseload";
import styles from "./ReviewsQueueScreen.module.css";

type Props = {
  filters: Record<string, string | undefined>;
  permissions?: string[];
};

const TABS: { id: ReviewsTabId; label: string }[] = [
  { id: "needs_creating", label: "Needs prep" },
  { id: "ready_to_create", label: "Ready" },
  { id: "open", label: "Open" },
  { id: "awaiting_sign_off", label: "Sign-off" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
  { id: "completed", label: "Done" },
];

function resolveTab(filters: Record<string, string | undefined>): ReviewsTabId {
  const raw = filters.tab ?? filters.view;
  if (raw && TABS.some((t) => t.id === raw)) return raw as ReviewsTabId;
  // Legacy Lifecycle Board deep-link
  if (filters.due === "this-week" || filters.status === "not-completed") {
    return "needs_creating";
  }
  return "needs_creating";
}

function readinessTone(
  status: ReviewRequirement["readinessStatus"],
): "green" | "amber" | "red" | "blue" | "orange" | "neutral" {
  switch (status) {
    case "ready_to_create":
      return "green";
    case "ready_with_warnings":
      return "amber";
    case "overdue":
    case "blocked":
      return "red";
    case "waiting_for_responses":
      return "blue";
    case "preparation_in_progress":
      return "orange";
    default:
      return "neutral";
  }
}

function stageLabel(stage: FormalReview["stage"]): string {
  return stage.replace(/_/g, " ");
}

function daysUntil(date: string, today = "2026-07-17"): number {
  return Math.round(
    (new Date(date).getTime() - new Date(today).getTime()) / 86400000,
  );
}

function dueLabel(date: string, dueStatus?: ReviewRequirement["dueStatus"]): string {
  const days = daysUntil(date);
  if (dueStatus === "overdue" || days < 0) {
    return `${Math.abs(days)}d overdue`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= REVIEW_READY_LEAD_DAYS) return `Due in ${days}d`;
  return date;
}

function dueTone(
  dueStatus: ReviewRequirement["dueStatus"] | "overdue" | "ok",
): "green" | "amber" | "red" | "neutral" {
  if (dueStatus === "overdue") return "red";
  if (dueStatus === "due_soon") return "amber";
  if (dueStatus === "on_track" || dueStatus === "ok") return "green";
  return "neutral";
}

function needsSummary(items: string[]): string {
  if (items.length === 0) return "Checklist clear";
  if (items.length === 1) return `Needs: ${items[0]}`;
  return `Needs ${items.length} items · first: ${items[0]}`;
}

function waitingParties(review: FormalReview): string {
  const waiting: string[] = [];
  if (!review.signOff.apprenticeSigned) waiting.push("apprentice");
  if (!review.signOff.employerSigned) waiting.push("employer");
  if (!review.signOff.providerSigned) waiting.push("provider");
  if (waiting.length === 0) return "All parties signed";
  return `Waiting on ${waiting.join(", ")}`;
}

function checklistState(
  requirement: ReviewRequirement,
  key: string,
): ChecklistItemState {
  return requirement.checklist.find((item) => item.key === key)?.state ?? "missing";
}

function openReviews(): FormalReview[] {
  return FORMAL_REVIEWS.filter(
    (r) =>
      r.stage !== "completed" &&
      r.stage !== "awaiting_sign_off",
  );
}

function signOffReviews(): FormalReview[] {
  return FORMAL_REVIEWS.filter((r) => r.stage === "awaiting_sign_off");
}

function completedReviews(): FormalReview[] {
  return FORMAL_REVIEWS.filter((r) => r.stage === "completed");
}

function overdueItems(): Array<
  | { kind: "requirement"; row: ReviewRequirement }
  | { kind: "formal"; row: FormalReview }
> {
  const reqs = REVIEW_REQUIREMENTS.filter(
    (r) =>
      !r.formalReviewId &&
      (r.dueStatus === "overdue" || r.queueTab === "overdue_requirement"),
  ).map((row) => ({ kind: "requirement" as const, row }));
  const formals = FORMAL_REVIEWS.filter(
    (r) =>
      r.stage !== "completed" &&
      ((r.daysOverdue != null && r.daysOverdue > 0) ||
        r.escalationStatus?.toLowerCase().includes("overdue") ||
        r.rearrangeCount >= 2),
  ).map((row) => ({ kind: "formal" as const, row }));
  return [...reqs, ...formals].sort((a, b) => {
    const da =
      a.kind === "requirement"
        ? daysUntil(a.row.plannedReviewDate)
        : -(a.row.daysOverdue ?? 0);
    const db =
      b.kind === "requirement"
        ? daysUntil(b.row.plannedReviewDate)
        : -(b.row.daysOverdue ?? 0);
    return da - db;
  });
}

export function ReviewsQueueScreen({ filters, permissions = [] }: Props) {
  const router = useRouter();
  const fromLifecycle = filters.from === "lifecycle";
  const tab = resolveTab(filters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const canOverride = permissions.includes("reviews.manage");

  const selected = useMemo(() => {
    void tick;
    return REVIEW_REQUIREMENTS.find((r) => r.requirementId === selectedId) ?? null;
  }, [selectedId, tick]);

  const selectedApprentice = useMemo(() => {
    if (!selected) return null;
    return MENTOR_APPRENTICES.find((l) => l.apprenticeId === selected.apprenticeId) ?? null;
  }, [selected]);

  const counts = useMemo(() => {
    void tick;
    return {
      needs_creating: REVIEW_REQUIREMENTS.filter(
        (r) =>
          !r.formalReviewId &&
          r.queueTab !== "upcoming" &&
          r.queueTab !== "ready_to_create",
      ).length,
      ready_to_create: REVIEW_REQUIREMENTS.filter(
        (r) => !r.formalReviewId && r.queueTab === "ready_to_create",
      ).length,
      open: openReviews().length,
      awaiting_sign_off: signOffReviews().length,
      upcoming: REVIEW_REQUIREMENTS.filter(
        (r) => !r.formalReviewId && r.queueTab === "upcoming",
      ).length,
      overdue: overdueItems().length,
      completed: completedReviews().length,
    };
  }, [tick]);

  const tabs = TABS.map((t) => ({ ...t, count: counts[t.id] }));

  const search = (filters.q ?? "").toLowerCase();

  const matchSearch = (name: string, employer: string, programme: string) => {
    if (!search) return true;
    return (
      name.toLowerCase().includes(search) ||
      employer.toLowerCase().includes(search) ||
      programme.toLowerCase().includes(search)
    );
  };

  const needsCreating = REVIEW_REQUIREMENTS.filter(
    (r) =>
      !r.formalReviewId &&
      r.queueTab !== "upcoming" &&
      r.queueTab !== "ready_to_create" &&
      matchSearch(r.apprenticeName, r.employerName, r.programmeName) &&
      (!filters.due ||
        filters.due !== "this-week" ||
        (() => {
          const d = new Date(r.plannedReviewDate);
          return d >= new Date("2026-07-13") && d <= new Date("2026-07-19");
        })()),
  );

  const readyToCreate = REVIEW_REQUIREMENTS.filter(
    (r) =>
      !r.formalReviewId &&
      r.queueTab === "ready_to_create" &&
      matchSearch(r.apprenticeName, r.employerName, r.programmeName),
  );

  const upcoming = REVIEW_REQUIREMENTS.filter(
    (r) =>
      !r.formalReviewId &&
      r.queueTab === "upcoming" &&
      matchSearch(r.apprenticeName, r.employerName, r.programmeName),
  );

  function refresh() {
    setTick((n) => n + 1);
  }

  function handleCreate(requirementId: string, withOverride = false) {
    setCreateError(null);
    const req = REVIEW_REQUIREMENTS.find((r) => r.requirementId === requirementId);
    if (!req) return;
    const gate = canCreateReview(req.checklist);
    if (!gate.allowed) {
      setCreateError(`Cannot create: ${gate.blocking.join("; ")}`);
      setSelectedId(requirementId);
      return;
    }
    if (gate.warnings.length > 0 && !withOverride) {
      setSelectedId(requirementId);
      setOverrideOpen(true);
      return;
    }
    const result = createFormalReviewFromRequirement(requirementId, {
      overrideReason: withOverride ? overrideReason : undefined,
      softOverrides:
        withOverride && gate.warnings.length > 0
          ? req.checklist
              .filter((i) => !i.hard && i.state !== "complete" && i.state !== "not_applicable")
              .map((i) => ({
                itemKey: i.key,
                reason: overrideReason,
                userId: MENTOR_ID,
                userName: MENTOR_NAME,
                at: new Date().toISOString(),
                managementAuthorised: false,
              }))
          : undefined,
    });
    if (!result.ok) {
      setCreateError(result.error);
      return;
    }
    setOverrideOpen(false);
    setOverrideReason("");
    refresh();
    router.push(`/reviews/${result.reviewId}?from=mentor-reviews`);
  }

  function bulkRequest(kind: "apprentice" | "employer" | "tutor") {
    for (const id of bulkSelected) {
      const req = REVIEW_REQUIREMENTS.find((r) => r.requirementId === id);
      if (!req) continue;
      const checklist = req.checklist.map((item) => {
        if (kind === "apprentice" && item.key === "apprentice_reflection_requested") {
          return { ...item, state: "requested" as const };
        }
        if (kind === "employer" && item.key === "employer_feedback_requested") {
          return { ...item, state: "requested" as const };
        }
        if (kind === "tutor" && item.key === "tutor_evidence_requested") {
          return { ...item, state: "requested" as const };
        }
        return item;
      });
      updateRequirement(id, {
        checklist,
        preparationOpenedAt: req.preparationOpenedAt ?? "2026-07-17",
      });
    }
    setBulkSelected([]);
    refresh();
  }

  function toggleBulk(id: string) {
    setBulkSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function renderRequirementActions(req: ReviewRequirement) {
    const action = primaryActionForRequirement({
      readinessStatus: req.readinessStatus,
      checklist: req.checklist,
      formalReviewId: req.formalReviewId,
    });
    const gate = canCreateReview(req.checklist);
    if (action.key === "create_review") {
      return (
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={!gate.allowed}
          title={
            gate.allowed
              ? "Create formal review"
              : `Blocked: ${gate.blocking.join(", ")}`
          }
          onClick={() => handleCreate(req.requirementId)}
        >
          Create review
        </button>
      );
    }
    return (
      <button
        type="button"
        className={styles.secondaryBtn}
        onClick={() => setSelectedId(req.requirementId)}
      >
        {action.label}
      </button>
    );
  }

  return (
    <MentorPageShell
      eyebrow="Progress Mentor · Reviews & Actions"
      title="Reviews"
      description={`Every ${REVIEW_CYCLE_WEEKS} weeks · be ready ${REVIEW_READY_LEAD_DAYS} days before the due date.`}
      fromLifecycle={fromLifecycle}
      toolbar={
        <div className={styles.toolbarRow}>
          <input
            className={styles.search}
            placeholder="Search apprentice, employer, programme"
            defaultValue={filters.q ?? ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const value = (e.target as HTMLInputElement).value;
                const params = new URLSearchParams();
                if (filters.from) params.set("from", filters.from);
                if (filters.due) params.set("due", filters.due);
                if (filters.status) params.set("status", filters.status);
                params.set("tab", tab);
                if (value) params.set("q", value);
                router.push(`${MENTOR_BASE}/reviews?${params.toString()}`);
              }
            }}
          />
          {(tab === "needs_creating" || tab === "ready_to_create") &&
          bulkSelected.length > 0 ? (
            <div className={styles.bulkBar}>
              <span>{bulkSelected.length} selected</span>
              <button type="button" className={styles.secondaryBtn} onClick={() => bulkRequest("apprentice")}>
                Request reflection
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => bulkRequest("employer")}>
                Request employer
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => bulkRequest("tutor")}>
                Request tutor
              </button>
              <span className={styles.bulkHint}>Bulk create is not allowed</span>
            </div>
          ) : null}
        </div>
      }
    >
      <p className={styles.policyStrip}>
        <strong>How it works:</strong> requirement appears → prepare checklist →
        create formal review when ready. Select an apprentice for the full checklist.
      </p>

      <ViewTabs
        tabs={tabs}
        active={tab}
        basePath={`${MENTOR_BASE}/reviews`}
        paramKey="tab"
        preserve={{
          from: filters.from,
          due: filters.due,
          status: filters.status,
          q: filters.q,
        }}
      />

      {createError ? <p className={styles.errorBanner}>{createError}</p> : null}

      <div className={selected ? styles.layoutWithPanel : styles.layout}>
        <div className={styles.main}>
          {tab === "needs_creating" || tab === "ready_to_create" ? (
            <div className={styles.queueList}>
              <div className={styles.queueListHead}>
                <span>
                  {tab === "needs_creating"
                    ? "Preparation still outstanding"
                    : "Hard requirements met — create the formal review"}
                </span>
                <span>
                  {(tab === "needs_creating" ? needsCreating : readyToCreate).length}{" "}
                  apprentices
                </span>
              </div>
              {(tab === "needs_creating" ? needsCreating : readyToCreate).length ===
              0 ? (
                <p className={styles.queueEmpty}>No records in this view.</p>
              ) : (
                (tab === "needs_creating" ? needsCreating : readyToCreate).map(
                  (r) => (
                    <article
                      key={r.requirementId}
                      className={`${styles.queueRow} ${
                        selectedId === r.requirementId ? styles.queueRowActive : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className={styles.queueCheck}
                        checked={bulkSelected.includes(r.requirementId)}
                        onChange={() => toggleBulk(r.requirementId)}
                        aria-label={`Select ${r.apprenticeName}`}
                      />
                      <button
                        type="button"
                        className={styles.queueBody}
                        onClick={() => setSelectedId(r.requirementId)}
                      >
                        <div className={styles.queueTitleRow}>
                          <strong>{r.apprenticeName}</strong>
                          <StatusChip tone={readinessTone(r.readinessStatus)}>
                            {readinessStatusLabel(r.readinessStatus)}
                          </StatusChip>
                        </div>
                        <p className={styles.queueMeta}>
                          {r.employerName} · {r.programmeName} · {r.reviewType}
                        </p>
                        <p className={styles.queueNeed}>
                          {tab === "ready_to_create"
                            ? `${r.readinessPercent}% ready · click to create`
                            : needsSummary(r.missingItems)}
                        </p>
                      </button>
                      <div className={styles.queueAside}>
                        <StatusChip tone={dueTone(r.dueStatus)}>
                          {dueLabel(r.plannedReviewDate, r.dueStatus)}
                        </StatusChip>
                        <div className={styles.queueActions}>
                          {renderRequirementActions(r)}
                        </div>
                      </div>
                    </article>
                  ),
                )
              )}
            </div>
          ) : null}

          {tab === "open" ? (
            <div className={styles.queueList}>
              <div className={styles.queueListHead}>
                <span>Formal reviews in progress</span>
                <span>{openReviews().length}</span>
              </div>
              {openReviews().filter((r) =>
                matchSearch(r.apprenticeName, r.employerName, r.programmeName),
              ).length === 0 ? (
                <p className={styles.queueEmpty}>No open reviews.</p>
              ) : (
                openReviews()
                  .filter((r) =>
                    matchSearch(r.apprenticeName, r.employerName, r.programmeName),
                  )
                  .map((r) => (
                    <article key={r.reviewId} className={styles.queueRow}>
                      <div className={styles.queueBodyStatic}>
                        <div className={styles.queueTitleRow}>
                          <Link
                            className={styles.queueNameLink}
                            href={`/reviews/${r.reviewId}?from=mentor-reviews`}
                          >
                            {r.apprenticeName}
                          </Link>
                          <StatusChip tone="blue">{stageLabel(r.stage)}</StatusChip>
                        </div>
                        <p className={styles.queueMeta}>
                          {r.employerName} · {r.programmeName} · {r.reviewDate}
                        </p>
                        <p className={styles.queueNeed}>
                          {r.progressPercent}% complete
                          {r.missingSections.length > 0
                            ? ` · Missing: ${r.missingSections[0]}${
                                r.missingSections.length > 1
                                  ? ` +${r.missingSections.length - 1}`
                                  : ""
                              }`
                            : " · Sections complete"}
                        </p>
                      </div>
                      <div className={styles.queueAside}>
                        <Link
                          className={styles.primaryBtn}
                          href={`/reviews/${r.reviewId}?from=mentor-reviews`}
                        >
                          {r.stage === "paused" ? "Resume" : "Open"}
                        </Link>
                      </div>
                    </article>
                  ))
              )}
            </div>
          ) : null}

          {tab === "awaiting_sign_off" ? (
            <div className={styles.queueList}>
              <div className={styles.queueListHead}>
                <span>Waiting for signatures</span>
                <span>{signOffReviews().length}</span>
              </div>
              {signOffReviews().length === 0 ? (
                <p className={styles.queueEmpty}>Nothing awaiting sign-off.</p>
              ) : (
                signOffReviews().map((r) => (
                  <article key={r.reviewId} className={styles.queueRow}>
                    <div className={styles.queueBodyStatic}>
                      <div className={styles.queueTitleRow}>
                        <Link
                          className={styles.queueNameLink}
                          href={`/reviews/${r.reviewId}?from=mentor-reviews`}
                        >
                          {r.apprenticeName}
                        </Link>
                        <StatusChip
                          tone={
                            r.signOff.apprenticeSigned &&
                            r.signOff.employerSigned &&
                            r.signOff.providerSigned
                              ? "green"
                              : "amber"
                          }
                        >
                          {waitingParties(r)}
                        </StatusChip>
                      </div>
                      <p className={styles.queueMeta}>
                        {r.employerName} · {r.programmeName} · Review {r.reviewDate}
                      </p>
                      <p className={styles.queueNeed}>
                        Apprentice {r.signOff.apprenticeSigned ? "✓" : "·"} ·
                        Employer {r.signOff.employerSigned ? "✓" : "·"} · Provider{" "}
                        {r.signOff.providerSigned ? "✓" : "·"}
                        {r.signOff.summaryIssued ? " · Summary issued" : ""}
                      </p>
                    </div>
                    <div className={styles.queueAside}>
                      <Link
                        className={styles.secondaryBtn}
                        href={`/reviews/${r.reviewId}?from=mentor-reviews`}
                      >
                        {!r.signOff.employerSigned
                          ? "Remind employer"
                          : !r.signOff.apprenticeSigned
                            ? "Remind apprentice"
                            : "Open"}
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}

          {tab === "upcoming" ? (
            <div className={styles.queueList}>
              <div className={styles.queueListHead}>
                <span>
                  Not in the {REVIEW_READY_LEAD_DAYS}-day ready window yet
                </span>
                <span>{upcoming.length}</span>
              </div>
              {upcoming.length === 0 ? (
                <p className={styles.queueEmpty}>No upcoming reviews.</p>
              ) : (
                upcoming.map((r) => (
                  <article key={r.requirementId} className={styles.queueRow}>
                    <div className={styles.queueBodyStatic}>
                      <div className={styles.queueTitleRow}>
                        <Link
                          className={styles.queueNameLink}
                          href={`/apprentices/${r.apprenticeId}?from=mentor-reviews`}
                        >
                          {r.apprenticeName}
                        </Link>
                        <StatusChip tone="neutral">{r.reviewCycle}</StatusChip>
                      </div>
                      <p className={styles.queueMeta}>
                        {r.employerName} · {r.programmeName}
                      </p>
                      <p className={styles.queueNeed}>
                        Planned {r.plannedReviewDate} ·{" "}
                        {Math.max(0, daysUntilReadyBy(r.plannedReviewDate))}d until
                        ready-by
                        {r.lastReviewDate
                          ? ` · Last review ${r.lastReviewDate}`
                          : " · First review"}
                      </p>
                    </div>
                    <div className={styles.queueAside}>
                      <Link
                        className={styles.secondaryBtn}
                        href={`/apprentices/${r.apprenticeId}?tab=reviews&from=mentor-reviews`}
                      >
                        View apprentice
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}

          {tab === "overdue" ? (
            <div className={styles.queueList}>
              <div className={styles.queueListHead}>
                <span>Past due — needs attention</span>
                <span>{overdueItems().length}</span>
              </div>
              {overdueItems().length === 0 ? (
                <p className={styles.queueEmpty}>Nothing overdue.</p>
              ) : (
                overdueItems().map((item) =>
                  item.kind === "requirement" ? (
                    <article
                      key={item.row.requirementId}
                      className={styles.queueRow}
                    >
                      <button
                        type="button"
                        className={styles.queueBody}
                        onClick={() => setSelectedId(item.row.requirementId)}
                      >
                        <div className={styles.queueTitleRow}>
                          <strong>{item.row.apprenticeName}</strong>
                          <StatusChip tone="red">
                            {Math.abs(daysUntil(item.row.plannedReviewDate))}d
                            overdue
                          </StatusChip>
                        </div>
                        <p className={styles.queueMeta}>
                          {item.row.employerName} · {item.row.programmeName}
                        </p>
                        <p className={styles.queueNeed}>
                          Requirement not created ·{" "}
                          {readinessStatusLabel(item.row.readinessStatus)}
                        </p>
                      </button>
                      <div className={styles.queueAside}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => setSelectedId(item.row.requirementId)}
                        >
                          Continue prep
                        </button>
                      </div>
                    </article>
                  ) : (
                    <article key={item.row.reviewId} className={styles.queueRow}>
                      <div className={styles.queueBodyStatic}>
                        <div className={styles.queueTitleRow}>
                          <Link
                            className={styles.queueNameLink}
                            href={`/reviews/${item.row.reviewId}?from=mentor-reviews`}
                          >
                            {item.row.apprenticeName}
                          </Link>
                          <StatusChip tone="red">
                            {item.row.daysOverdue != null
                              ? `${item.row.daysOverdue}d overdue`
                              : "Overdue"}
                          </StatusChip>
                        </div>
                        <p className={styles.queueMeta}>
                          {item.row.employerName} · {item.row.programmeName} ·{" "}
                          {stageLabel(item.row.stage)}
                        </p>
                        <p className={styles.queueNeed}>
                          {item.row.rearrangeCount >= 2
                            ? `Rearranged ${item.row.rearrangeCount}×`
                            : item.row.escalationStatus ?? "Incomplete review"}
                        </p>
                      </div>
                      <div className={styles.queueAside}>
                        <Link
                          className={styles.primaryBtn}
                          href={`/reviews/${item.row.reviewId}?from=mentor-reviews`}
                        >
                          Open
                        </Link>
                      </div>
                    </article>
                  ),
                )
              )}
            </div>
          ) : null}

          {tab === "completed" ? (
            <div className={styles.queueList}>
              <div className={styles.queueListHead}>
                <span>Signed completed reviews</span>
                <span>{completedReviews().length}</span>
              </div>
              {completedReviews().length === 0 ? (
                <p className={styles.queueEmpty}>No completed reviews yet.</p>
              ) : (
                completedReviews().map((r) => (
                  <article key={r.reviewId} className={styles.queueRow}>
                    <div className={styles.queueBodyStatic}>
                      <div className={styles.queueTitleRow}>
                        <Link
                          className={styles.queueNameLink}
                          href={`/reviews/${r.reviewId}?from=mentor-reviews`}
                        >
                          {r.apprenticeName}
                        </Link>
                        <StatusChip tone="green">Completed</StatusChip>
                      </div>
                      <p className={styles.queueMeta}>
                        {r.employerName} · {r.programmeName} · {r.reviewDate}
                      </p>
                      <p className={styles.queueNeed}>
                        {r.progressJudgement ?? "Judgement recorded"} ·{" "}
                        {r.actionsCreated} action
                        {r.actionsCreated === 1 ? "" : "s"}
                        {r.nextReviewDate
                          ? ` · Next ${r.nextReviewDate}`
                          : ""}
                      </p>
                    </div>
                    <div className={styles.queueAside}>
                      <Link
                        className={styles.secondaryBtn}
                        href={`/reviews/${r.reviewId}?from=mentor-reviews`}
                      >
                        Open record
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}
        </div>

        {selected ? (
          <aside className={styles.panel} aria-label="Preparation detail">
            <header className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>Preparation</p>
                <h2>{selected.apprenticeName}</h2>
                <p className={styles.panelMeta}>
                  {selected.programmeName} · {selected.employerName}
                </p>
              </div>
              <button
                type="button"
                className={styles.closePanel}
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </header>

            <div className={styles.panelStatusBar}>
              <div>
                <span className={styles.score}>{selected.readinessPercent}%</span>
                <span className={styles.scoreLabel}>ready</span>
              </div>
              <div className={styles.panelStatusChips}>
                <StatusChip tone={readinessTone(selected.readinessStatus)}>
                  {readinessStatusLabel(selected.readinessStatus)}
                </StatusChip>
                <StatusChip tone={dueTone(selected.dueStatus)}>
                  {dueLabel(selected.plannedReviewDate, selected.dueStatus)}
                </StatusChip>
              </div>
            </div>

            <p className={styles.panelDueLine}>
              {selected.reviewType} · planned {selected.plannedReviewDate}
              {selected.lastReviewDate
                ? ` · last review ${selected.lastReviewDate}`
                : " · first review"}
            </p>

            <div className={styles.panelStats}>
              <div>
                <span>Planned</span>
                <strong>
                  {selectedApprentice?.plannedProgressPercent != null
                    ? `${selectedApprentice.plannedProgressPercent}%`
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Actual</span>
                <strong>
                  {selectedApprentice?.actualProgressPercent != null
                    ? `${selectedApprentice.actualProgressPercent}%`
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Attendance</span>
                <strong>
                  {selectedApprentice?.attendancePercent != null
                    ? `${selectedApprentice.attendancePercent}%`
                    : "—"}
                </strong>
              </div>
            </div>

            <div className={styles.panelStage}>
              <span className={styles.previewDone}>1. Requirement</span>
              <span
                className={
                  selected.readinessStatus === "ready_to_create" ||
                  selected.readinessStatus === "ready_with_warnings"
                    ? styles.previewDone
                    : styles.previewCurrent
                }
              >
                2. Preparation
              </span>
              <span className={styles.previewNext}>3. Formal review</span>
            </div>

            {(() => {
              const blocking = hardItemsIncomplete(selected.checklist);
              const soft = softItemsIncomplete(selected.checklist);
              const doneCount = selected.checklist.filter(
                (i) =>
                  i.state === "complete" ||
                  i.state === "not_applicable" ||
                  i.state === "overridden",
              ).length;
              const gate = canCreateReview(selected.checklist);

              const renderItems = (
                items: typeof blocking,
                emptyLabel: string,
              ) =>
                items.length === 0 ? (
                  <p className={styles.allClear}>{emptyLabel}</p>
                ) : (
                  <ul className={styles.needList}>
                    {items.map((item) => (
                      <li key={item.key}>
                        <div>
                          <strong>{item.label}</strong>
                          {item.reason ? <p>{item.reason}</p> : null}
                        </div>
                        <span
                          className={
                            item.state === "requested"
                              ? styles.stateWait
                              : item.hard
                                ? styles.stateHard
                                : styles.stateSoft
                          }
                        >
                          {checklistStateLabel(item.state)}
                        </span>
                      </li>
                    ))}
                  </ul>
                );

              return (
                <>
                  <section className={styles.panelSection}>
                    <h3>
                      Must finish before create
                      {blocking.length > 0 ? (
                        <span> · {blocking.length}</span>
                      ) : null}
                    </h3>
                    {renderItems(blocking, "No hard blockers — you can create.")}
                  </section>

                  <section className={styles.panelSection}>
                    <h3>
                      Still useful to complete
                      {soft.length > 0 ? <span> · {soft.length}</span> : null}
                    </h3>
                    {renderItems(
                      soft,
                      "Soft items clear (or can be overridden).",
                    )}
                  </section>

                  <section className={styles.panelSection}>
                    <h3>Actions from last cycle</h3>
                    {(() => {
                      const prior = lastCycleActionsForReview({
                        apprenticeId: selected.apprenticeId,
                        reviewId:
                          selected.formalReviewId ??
                          `prep-${selected.requirementId}`,
                        reviewDate: selected.plannedReviewDate,
                        actions: ACTION_RECORDS,
                      });
                      if (prior.length === 0) {
                        return (
                          <p className={styles.allClear}>
                            No earlier actions to bring up — this cycle starts
                            fresh after create.
                          </p>
                        );
                      }
                      return (
                        <ul className={styles.priorActionList}>
                          {prior.slice(0, 5).map((row) => (
                            <li key={row.action.actionId}>
                              <div>
                                <strong>{row.action.title}</strong>
                                <p>
                                  {row.outcomeLabel}: {row.why}
                                </p>
                                <p className={styles.priorSource}>
                                  {humanSourceLabel(row.action)}
                                </p>
                              </div>
                              <span
                                className={
                                  row.outcome === "yes"
                                    ? styles.stateOk
                                    : row.outcome === "no"
                                      ? styles.stateHard
                                      : styles.stateSoft
                                }
                              >
                                {row.outcome === "yes"
                                  ? "Yes"
                                  : row.outcome === "no"
                                    ? "No"
                                    : "Open"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </section>

                  <section className={styles.panelSection}>
                    <h3>Contributions</h3>
                    <ul className={styles.contribList}>
                      {(
                        [
                          [
                            "Apprentice reflection",
                            "apprentice_reflection_received",
                          ],
                          [
                            "Employer feedback",
                            "employer_feedback_received",
                          ],
                          ["Tutor evidence", "tutor_evidence_received"],
                        ] as const
                      ).map(([label, key]) => {
                        const state = checklistState(selected, key);
                        const ok =
                          state === "complete" ||
                          state === "not_applicable" ||
                          state === "overridden";
                        return (
                          <li key={key}>
                            <span>{label}</span>
                            <span
                              className={
                                ok
                                  ? styles.stateOk
                                  : state === "requested"
                                    ? styles.stateWait
                                    : styles.stateHard
                              }
                            >
                              {checklistStateLabel(state)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>

                  <p className={styles.doneCount}>
                    {doneCount} of {selected.checklist.length} checklist items
                    complete
                  </p>

                  <div className={styles.panelActions}>
                    {!gate.allowed ? (
                      <p className={styles.blockNote}>
                        Create is blocked until the hard items above are done
                        (or requested and received).
                      </p>
                    ) : null}
                    {gate.allowed && gate.warnings.length > 0 ? (
                      <p className={styles.warnNote}>
                        Soft items remain — you can create with an override
                        reason.
                      </p>
                    ) : null}
                    {gate.allowed && gate.warnings.length === 0 ? (
                      <p className={styles.allClear}>
                        Ready to create the formal review record.
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={!gate.allowed || !canOverride}
                      onClick={() => handleCreate(selected.requirementId)}
                    >
                      Create review
                    </button>
                    <Link
                      href={`/reviews/rev-mia-open?from=mentor-reviews`}
                      className={styles.previewLink}
                    >
                      See an example completed review →
                    </Link>
                  </div>
                </>
              );
            })()}
          </aside>
        ) : null}
      </div>

      {overrideOpen && selected ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal>
          <div className={styles.modal}>
            <h3>Create with soft-warning override</h3>
            <p>
              Hard requirements are met, but soft warnings remain. Record a reason
              (audited). Management permission may be required for some items.
            </p>
            <textarea
              className={styles.textarea}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Override reason"
              rows={4}
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setOverrideOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={!overrideReason.trim() || !canOverride}
                onClick={() => handleCreate(selected.requirementId, true)}
              >
                Create with override
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MentorPageShell>
  );
}
