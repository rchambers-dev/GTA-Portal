"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MentorPageShell,
  StatusChip,
  ViewTabs,
} from "../components/MentorWorkQueue";
import { ACTION_RECORDS } from "../domain/actions/mock-store";
import {
  cycleOutcome,
  humanSourceLabel,
} from "../domain/actions/cycle";
import { actionSortRank } from "../domain/actions/smartto";
import type { ActionRecord, ActionsTabId } from "../domain/actions/types";
import { MENTOR_BASE } from "../lib/metric-links";
import styles from "./ActionCentreScreen.module.css";

type Props = {
  filters: Record<string, string | undefined>;
};

const TABS: { id: ActionsTabId; label: string }[] = [
  { id: "assigned_to_me", label: "Assigned to Me" },
  { id: "assigned_by_me", label: "Assigned by Me" },
  { id: "due_today", label: "Due Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
  { id: "employer_commitments", label: "Employer Commitments" },
  { id: "apprentice_targets", label: "Apprentice Targets" },
  { id: "awaiting_evidence", label: "Awaiting Evidence" },
  { id: "escalated", label: "Escalated" },
  { id: "completed", label: "Completed" },
];

const TODAY = "2026-07-17";

function resolveTab(filters: Record<string, string | undefined>): ActionsTabId {
  const raw = filters.tab ?? filters.view;
  if (raw === "employer") return "employer_commitments";
  if (raw === "apprentice") return "apprentice_targets";
  if (raw && TABS.some((t) => t.id === raw)) return raw as ActionsTabId;
  if (filters.status === "overdue" || filters.ownerType === "employer") {
    if (filters.status === "overdue") return "overdue";
    if (filters.ownerType === "employer") return "employer_commitments";
  }
  return "assigned_to_me";
}

function statusTone(
  status: ActionRecord["status"],
): "green" | "amber" | "red" | "orange" | "blue" | "neutral" {
  switch (status) {
    case "completed":
    case "impact_confirmed":
      return "green";
    case "overdue":
    case "escalated":
      return "red";
    case "checkpoint_due":
    case "awaiting_evidence":
      return "amber";
    case "in_progress":
    case "agreed":
      return "blue";
    default:
      return "neutral";
  }
}

function outcomeTone(
  outcome: "yes" | "no" | "in_progress",
): "green" | "red" | "amber" {
  if (outcome === "yes") return "green";
  if (outcome === "no") return "red";
  return "amber";
}

function priorityTone(
  p: ActionRecord["priority"],
): "green" | "amber" | "red" | "orange" | "neutral" {
  switch (p) {
    case "critical":
      return "red";
    case "high":
      return "orange";
    case "medium":
      return "amber";
    default:
      return "neutral";
  }
}

function filterByTab(list: ActionRecord[], tab: ActionsTabId): ActionRecord[] {
  switch (tab) {
    case "assigned_to_me":
      return list.filter(
        (a) =>
          a.assignedToMe &&
          a.status !== "completed" &&
          a.status !== "impact_confirmed" &&
          a.status !== "closed",
      );
    case "assigned_by_me":
      return list.filter((a) => a.assignedByMe);
    case "due_today":
      return list.filter((a) => a.dueDate === TODAY && a.status !== "completed");
    case "upcoming":
      return list.filter(
        (a) =>
          a.dueDate > TODAY &&
          ![
            "completed",
            "impact_confirmed",
            "closed",
            "cancelled",
            "overdue",
            "escalated",
          ].includes(a.status),
      );
    case "overdue":
      return list.filter(
        (a) => a.status === "overdue" || filtersOwnerOverdue(a),
      );
    case "employer_commitments":
      return list.filter(
        (a) => a.ownerType === "employer" && a.status !== "cancelled",
      );
    case "apprentice_targets":
      return list.filter((a) => a.ownerType === "apprentice");
    case "awaiting_evidence":
      return list.filter((a) => a.status === "awaiting_evidence");
    case "escalated":
      return list.filter(
        (a) => a.status === "escalated" || Boolean(a.escalationStatus),
      );
    case "completed":
      return list.filter(
        (a) =>
          a.status === "completed" ||
          a.status === "impact_confirmed" ||
          a.status === "closed",
      );
    default:
      return list;
  }
}

function filtersOwnerOverdue(a: ActionRecord): boolean {
  return (
    a.dueDate < TODAY &&
    !["completed", "impact_confirmed", "closed", "cancelled"].includes(a.status)
  );
}

function sourceHref(action: ActionRecord): string {
  switch (action.sourceType) {
    case "review":
      return `/reviews/${action.sourceId}?from=action-centre`;
    case "intervention":
      return `/interventions/${action.sourceId}?from=action-centre`;
    case "employer_concern":
      return `/employer-concerns?from=action-centre`;
    default:
      return action.learnerId
        ? `/learners/${action.learnerId}?from=action-centre`
        : `/actions/${action.actionId}?from=action-centre`;
  }
}

function openLabel(a: ActionRecord): string {
  if (a.status === "checkpoint_due") return "Record checkpoint";
  if (a.status === "awaiting_evidence") return "Review evidence";
  if (a.status === "overdue" || a.status === "escalated") return "Update";
  return "Open";
}

export function ActionCentreScreen({ filters }: Props) {
  const router = useRouter();
  const fromLifecycle = filters.from === "lifecycle";
  const tab = resolveTab(filters);
  const [q, setQ] = useState(filters.q ?? "");

  const filtered = useMemo(() => {
    let list = [...ACTION_RECORDS];
    if (filters.ownerType) {
      list = list.filter((a) => a.ownerType === filters.ownerType);
    }
    if (filters.status === "overdue") {
      list = list.filter(
        (a) => a.status === "overdue" || filtersOwnerOverdue(a),
      );
    }
    if (filters.source) {
      list = list.filter((a) => a.sourceId === filters.source);
    }
    list = filterByTab(list, tab);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(needle) ||
          (a.learnerName ?? "").toLowerCase().includes(needle) ||
          (a.employerName ?? "").toLowerCase().includes(needle) ||
          a.owner.toLowerCase().includes(needle) ||
          humanSourceLabel(a).toLowerCase().includes(needle),
      );
    }
    return list.sort((a, b) => actionSortRank(a) - actionSortRank(b));
  }, [filters, tab, q]);

  const counts = useMemo(() => {
    const base = ACTION_RECORDS;
    return Object.fromEntries(
      TABS.map((t) => [t.id, filterByTab(base, t.id).length]),
    ) as Record<ActionsTabId, number>;
  }, []);

  const tabs = TABS.map((t) => ({ ...t, count: counts[t.id] }));

  return (
    <MentorPageShell
      eyebrow="Progress Mentor · Reviews & Actions"
      title="Action Centre"
      description="Work agreed in reviews (and other sources). Chase here, then take Yes / No / Why back into the next review."
      fromLifecycle={fromLifecycle}
      toolbar={
        <input
          className={styles.search}
          placeholder="Search action, learner, employer, owner, source"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const params = new URLSearchParams();
              if (filters.from) params.set("from", filters.from);
              if (filters.ownerType) params.set("ownerType", filters.ownerType);
              if (filters.status) params.set("status", filters.status);
              params.set("tab", tab);
              if (q) params.set("q", q);
              router.push(`${MENTOR_BASE}/actions?${params.toString()}`);
            }
          }}
        />
      }
    >
      <p className={styles.cycleStrip}>
        <strong>Cycle:</strong> Review agrees the action → Action Centre tracks
        it → Next review asks completed? Yes / No — and why — before new targets
        are set.
      </p>

      <ViewTabs
        tabs={tabs}
        active={tab}
        basePath={`${MENTOR_BASE}/actions`}
        paramKey="tab"
        preserve={{
          from: filters.from,
          ownerType: filters.ownerType,
          status: filters.status,
          source: filters.source,
          q: filters.q,
        }}
      />

      <div className={styles.queueList}>
        <div className={styles.queueListHead}>
          <span>
            {tab === "completed"
              ? "Completed — ready to confirm impact at the next review"
              : "Open work — bring unfinished items into the next review"}
          </span>
          <span>{filtered.length}</span>
        </div>

        {filtered.length === 0 ? (
          <p className={styles.queueEmpty}>No actions in this view.</p>
        ) : (
          filtered.map((a) => {
            const cycle = cycleOutcome(a);
            return (
              <article key={a.actionId} className={styles.queueRow}>
                <div className={styles.queueBody}>
                  <div className={styles.queueTitleRow}>
                    <Link
                      className={styles.queueTitle}
                      href={`/actions/${a.actionId}?from=action-centre`}
                    >
                      {a.title}
                    </Link>
                    <StatusChip tone={priorityTone(a.priority)}>
                      {a.priority}
                    </StatusChip>
                    <StatusChip tone={statusTone(a.status)}>
                      {a.status.replace(/_/g, " ")}
                    </StatusChip>
                  </div>
                  <p className={styles.queueMeta}>
                    {a.learnerName ?? "No learner"} · Owner {a.owner} (
                    {a.ownerType}) · Due{" "}
                    <span
                      className={
                        a.status === "overdue" || a.dueDate < TODAY
                          ? styles.dueOverdue
                          : a.dueDate === TODAY
                            ? styles.dueToday
                            : undefined
                      }
                    >
                      {a.dueDate}
                    </span>
                  </p>
                  <p className={styles.queueSource}>
                    From{" "}
                    <Link href={sourceHref(a)}>{humanSourceLabel(a)}</Link>
                  </p>
                  <div className={styles.outcomeBlock}>
                    <StatusChip tone={outcomeTone(cycle.outcome)}>
                      {cycle.outcomeLabel}
                    </StatusChip>
                    <p className={styles.outcomeWhy}>{cycle.why}</p>
                    {cycle.bringUpAtNextReview ? (
                      <p className={styles.bringUp}>
                        Bring this up at the next review before agreeing new
                        actions.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className={styles.queueAside}>
                  <Link
                    className={styles.openBtn}
                    href={`/actions/${a.actionId}?from=action-centre`}
                  >
                    {openLabel(a)}
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </div>
    </MentorPageShell>
  );
}
