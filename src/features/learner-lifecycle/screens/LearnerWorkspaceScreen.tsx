"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type {
  EvidenceRequirementRowDto,
  EvidenceRequirementStatus,
  LearnerWorkspaceDto,
} from "../types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  evidenceStatusLabel,
  evidenceStatusTone,
  overallStatusLabel,
  overallStatusTone,
} from "../lib/status";
import {
  ADM14_FORM_CODE,
  ADM14_FORM_TITLE,
} from "../domain/adm14-checklist";
import {
  getPackSnapshot,
  mergePackOntoRows,
  subscribePackStore,
} from "../domain/pack-store";
import { PackItemEditor } from "../components/PackItemEditor";
import {
  learnerRecordHref,
  type LearnerTab,
} from "@/features/shared-records";
import styles from "./LearnerWorkspaceScreen.module.css";

type Props = {
  workspace: LearnerWorkspaceDto;
  learnerId?: string;
  activeTab?: LearnerTab;
  from?: string | null;
  returnHref?: string;
  returnLabel?: string;
  canViewSupportDetail?: boolean;
};

type PackSection = {
  sectionKey: string;
  sectionTitle: string;
  originalBookletSection: string;
  rows: EvidenceRequirementRowDto[];
};

type RowAttention = "critical" | "attention" | "ok" | "muted";

function groupEvidenceBySection(
  rows: EvidenceRequirementRowDto[],
): PackSection[] {
  const order: string[] = [];
  const map = new Map<string, PackSection>();

  for (const row of rows) {
    const existing = map.get(row.sectionKey);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    order.push(row.sectionKey);
    map.set(row.sectionKey, {
      sectionKey: row.sectionKey,
      sectionTitle: row.sectionTitle,
      originalBookletSection: row.originalBookletSection,
      rows: [row],
    });
  }

  return order.map((key) => map.get(key)!);
}

function rowAttention(row: EvidenceRequirementRowDto): RowAttention {
  const status = row.status;
  const mandatory = row.requirementKind === "mandatory";

  if (
    status === "not_applicable" ||
    status === "future_requirement" ||
    status === "archived" ||
    status === "superseded"
  ) {
    return "muted";
  }

  if (
    status === "missing" ||
    status === "correction_required" ||
    status === "disputed" ||
    status === "expired"
  ) {
    return mandatory ? "critical" : "attention";
  }

  if (
    status === "due_for_review" ||
    status === "awaiting_check" ||
    status === "received" ||
    status === "requested"
  ) {
    return "attention";
  }

  if (status === "checked_and_accepted") {
    return "ok";
  }

  return mandatory ? "attention" : "muted";
}

function isAttentionStatus(status: EvidenceRequirementStatus): boolean {
  return (
    status === "missing" ||
    status === "correction_required" ||
    status === "disputed" ||
    status === "expired" ||
    status === "due_for_review" ||
    status === "awaiting_check" ||
    status === "received" ||
    status === "requested"
  );
}

function sectionAttentionCount(section: PackSection): number {
  return section.rows.filter(
    (row) =>
      isAttentionStatus(row.status) &&
      row.status !== "not_applicable" &&
      row.status !== "future_requirement",
  ).length;
}

function sectionCriticalCount(section: PackSection): number {
  return section.rows.filter(
    (row) =>
      row.requirementKind === "mandatory" &&
      (row.status === "missing" ||
        row.status === "correction_required" ||
        row.status === "disputed" ||
        row.status === "expired"),
  ).length;
}

function apprenticeshipOutcomeLabel(
  programmeStatus: LearnerWorkspaceDto["card"]["programmeStatus"],
): string {
  switch (programmeStatus) {
    case "completed":
      return "Completed";
    case "withdrawn":
      return "Withdrawn";
    case "break_in_learning":
      return "Break in learning";
    case "gateway":
      return "Gateway";
    case "epa":
      return "EPA";
    case "pre_start":
      return "Pre-start";
    default:
      return "In progress";
  }
}

function contextStatusTone(
  label: string | null | undefined,
): "on_track" | "monitoring" | "priority" | "neutral" {
  if (!label) return "neutral";
  const value = label.toLowerCase();
  const percentMatch = value.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    const pct = Number(percentMatch[1]);
    if (pct >= 95) return "on_track";
    if (pct >= 85) return "monitoring";
    return "priority";
  }
  if (
    value.includes("on track") ||
    value.includes("good") ||
    value.includes("clear")
  ) {
    return "on_track";
  }
  if (
    value.includes("priority") ||
    value.includes("overdue") ||
    value.includes("at risk") ||
    value.includes("behind")
  ) {
    return "priority";
  }
  if (value.includes("monitor") || value.includes("review")) {
    return "monitoring";
  }
  return "neutral";
}

function activityTone(
  eventType: string,
): "on_track" | "monitoring" | "priority" | "neutral" {
  const value = eventType.toLowerCase();
  if (value.includes("checked") || value.includes("enrolled")) return "on_track";
  if (value.includes("action") || value.includes("concern")) return "priority";
  if (value.includes("received") || value.includes("scheduled") || value.includes("review")) {
    return "monitoring";
  }
  return "neutral";
}

const ATTENTION_ROW_CLASS: Record<RowAttention, string> = {
  critical: styles.rowCritical,
  attention: styles.rowAttention,
  ok: styles.rowOk,
  muted: styles.rowMuted,
};

/**
 * Permanent feature screen — canonical shared learner record.
 * Presents the ADM14 apprenticeship file pack as the primary page.
 */
export function LearnerWorkspaceScreen({
  workspace,
  learnerId,
  activeTab = "evidence",
  from = null,
  returnHref = "/learners",
  returnLabel = "Back to learners",
  canViewSupportDetail = false,
}: Props) {
  const { card } = workspace;
  const resolvedLearnerId = learnerId ?? card.learnerId;
  const packHref = learnerRecordHref(card.learnerId, {
    tab: "evidence",
    ...(from ? { from } : {}),
  });

  useSyncExternalStore(
    subscribePackStore,
    () => JSON.stringify(getPackSnapshot().byLearner[resolvedLearnerId] ?? {}),
    () => "",
  );

  const evidenceRows = mergePackOntoRows(resolvedLearnerId, workspace.evidenceRows);

  const sections = useMemo(
    () => groupEvidenceBySection(evidenceRows),
    [evidenceRows],
  );

  const defaultSectionKey = useMemo(() => {
    const withCritical = sections.find((s) => sectionCriticalCount(s) > 0);
    if (withCritical) return withCritical.sectionKey;
    const withAttention = sections.find((s) => sectionAttentionCount(s) > 0);
    if (withAttention) return withAttention.sectionKey;
    return sections[0]?.sectionKey ?? "";
  }, [sections]);

  const [activeSectionKey, setActiveSectionKey] = useState(defaultSectionKey);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const activeSection =
    sections.find((s) => s.sectionKey === activeSectionKey) ?? sections[0];

  const editingRow =
    evidenceRows.find((row) => row.id === editingRowId) ?? null;

  const packTotals = useMemo(() => {
    const critical = sections.reduce((n, s) => n + sectionCriticalCount(s), 0);
    const attention = sections.reduce(
      (n, s) => n + sectionAttentionCount(s),
      0,
    );
    const checked = evidenceRows.filter(
      (r) => r.status === "checked_and_accepted",
    ).length;
    return { critical, attention, checked, total: evidenceRows.length };
  }, [evidenceRows, sections]);

  function openFirstGap() {
    const gap =
      evidenceRows.find(
        (row) =>
          row.requirementKind === "mandatory" &&
          (row.status === "missing" ||
            row.status === "requested" ||
            row.status === "correction_required"),
      ) ?? evidenceRows.find((row) => row.status !== "future_requirement");
    if (gap) {
      setActiveSectionKey(gap.sectionKey);
      setEditingRowId(gap.id);
    }
  }

  const recentTimeline = workspace.timeline.slice(0, 5);

  const attendanceHref = learnerRecordHref(card.learnerId, {
    tab: "attendance",
    ...(from ? { from } : {}),
  });
  const showPack = activeTab === "evidence" || activeTab === "timeline";
  const showAttendance = activeTab === "attendance";

  const showRestrictedSupport =
    activeTab === "support" && !canViewSupportDetail;
  const showLegacyStub =
    activeTab !== "evidence" &&
    activeTab !== "timeline" &&
    activeTab !== "support" &&
    activeTab !== "attendance";

  const attendancePercent = card.attendancePercent;
  const attendanceTone = contextStatusTone(workspace.attendanceStatus);
  const attendanceEvents = workspace.timeline.filter((event) =>
    /attendance/i.test(`${event.eventType} ${event.summary}`),
  );

  return (
    <div className={styles.root}>
      <div className={styles.backRow}>
        {showAttendance ? (
          <>
            <Link href={packHref} className={styles.packReturnLink}>
              ← Back to ADM14.0 file pack
            </Link>
            <span className={styles.backDivider} aria-hidden>
              ·
            </span>
            <Link href={returnHref} className={styles.backLink}>
              {returnLabel}
            </Link>
          </>
        ) : (
          <Link href={returnHref} className={styles.backLink}>
            ← {returnLabel}
          </Link>
        )}
      </div>

      <header className={styles.packBanner}>
        <div className={styles.packBannerTop}>
          <div className={styles.packBannerMain}>
            <p className={styles.formEyebrow}>
              {ADM14_FORM_CODE} · {ADM14_FORM_TITLE}
            </p>
            <div className={styles.learnerHero}>
              <div className={styles.heroAvatar} aria-hidden>
                {card.initials}
              </div>
              <div>
                <h1 className={styles.packTitle}>{card.displayName}</h1>
                <p className={styles.heroSub}>
                  {card.programmeName}
                  {workspace.learnerReference
                    ? ` · ${workspace.learnerReference}`
                    : ""}
                </p>
              </div>
            </div>
          </div>
          <div className={styles.packBannerMeta}>
            <StatusBadge tone={overallStatusTone(card.overallStatus)} size="md">
              {overallStatusLabel(card.overallStatus)}
            </StatusBadge>
            <div className={styles.evidenceActions}>
              {showAttendance ? (
                <Link href={packHref} className={styles.packReturnButton}>
                  Back to ADM14.0 pack
                </Link>
              ) : (
                <>
                  <Button variant="secondary" size="sm" disabled>
                    Export
                  </Button>
                  <Button
                    size="sm"
                    onClick={openFirstGap}
                    disabled={evidenceRows.length === 0}
                  >
                    Add / update evidence
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={styles.packFacts}>
          <div>
            <span className={styles.factLabel}>Start</span>
            <span className={styles.factValue}>
              {workspace.programmeStartDate ?? "—"}
            </span>
          </div>
          <div>
            <span className={styles.factLabel}>End</span>
            <span className={styles.factValue}>
              {workspace.originalPlannedEndDate ?? "—"}
            </span>
          </div>
          <div>
            <span className={styles.factLabel}>Outcome</span>
            <span className={styles.factValue}>
              {apprenticeshipOutcomeLabel(card.programmeStatus)}
            </span>
          </div>
          <div>
            <span className={styles.factLabel}>Week</span>
            <span className={styles.factValue}>
              {workspace.currentWeekLabel ?? "—"}
            </span>
          </div>
          <div>
            <span className={styles.factLabel}>Employer</span>
            <span className={styles.factValue}>
              {card.employerName ?? "—"}
            </span>
          </div>
        </div>

        {evidenceRows.length > 0 ? (
          <div className={styles.packPulse} aria-label="Pack status summary">
            <div
              className={
                packTotals.critical > 0
                  ? styles.pulseCritical
                  : styles.pulseQuiet
              }
            >
              <strong>{packTotals.critical}</strong>
              <span>Mandatory missing</span>
            </div>
            <div
              className={
                packTotals.attention > 0
                  ? styles.pulseAttention
                  : styles.pulseQuiet
              }
            >
              <strong>{packTotals.attention}</strong>
              <span>Needs attention</span>
            </div>
            <div className={styles.pulseOk}>
              <strong>{packTotals.checked}</strong>
              <span>Checked</span>
            </div>
            <div className={styles.pulseTotal}>
              <strong>{packTotals.total}</strong>
              <span>Total</span>
            </div>
          </div>
        ) : null}
      </header>

      <div className={styles.layout}>
        <div className={styles.packColumn}>
          {showRestrictedSupport ? (
            <EmptyState
              title="Restricted information exists"
              description="You do not have permission to view support detail. Return to the learner file pack to continue."
            />
          ) : null}

          {showLegacyStub ? (
            <div className={styles.legacyNotice}>
              <p>
                Shared {activeTab.replace(/_/g, " ")} panel will mount here in
                a later stage. The learner file pack remains the primary record.
              </p>
              <Link href={packHref} className={styles.backLink}>
                View learner file pack
              </Link>
            </div>
          ) : null}

          {!showRestrictedSupport && showAttendance ? (
            <section className={styles.attendancePanel} aria-label="Attendance">
              <header className={styles.sectionHeading}>
                <div>
                  <h2 id="attendance-heading">Attendance</h2>
                  <p className={styles.sectionHint}>
                    Attendance record for {card.displayName}.
                  </p>
                </div>
                <Link href={packHref} className={styles.packReturnButton}>
                  ← Back to ADM14.0 pack
                </Link>
              </header>

              <div className={styles.attendanceHero}>
                <div>
                  <p className={styles.factLabel}>Current attendance</p>
                  <p className={styles.attendancePercent}>
                    {attendancePercent != null
                      ? `${attendancePercent}%`
                      : "Not recorded"}
                  </p>
                </div>
                <StatusBadge tone={attendanceTone} size="md">
                  {attendancePercent == null
                    ? "No data"
                    : attendancePercent >= 95
                      ? "Good"
                      : attendancePercent >= 85
                        ? "Monitoring"
                        : "Concern"}
                </StatusBadge>
              </div>

              <div className={styles.attendanceGrid}>
                <div className={styles.attendanceCard}>
                  <p className={styles.factLabel}>Threshold</p>
                  <p className={styles.factValue}>
                    Below 85% triggers attendance concern follow-up
                  </p>
                </div>
                <div className={styles.attendanceCard}>
                  <p className={styles.factLabel}>Employer</p>
                  <p className={styles.factValue}>
                    {card.employerName ?? "Not yet recorded"}
                  </p>
                </div>
                <div className={styles.attendanceCard}>
                  <p className={styles.factLabel}>Tutor</p>
                  <p className={styles.factValue}>
                    {card.tutorName ?? "Not assigned"}
                  </p>
                </div>
                <div className={styles.attendanceCard}>
                  <p className={styles.factLabel}>Priority</p>
                  <p className={styles.factValue}>
                    {card.primaryPriority?.title ?? "None recorded"}
                  </p>
                </div>
              </div>

              {card.primaryPriority?.summary &&
              /attendance/i.test(
                `${card.primaryPriority.title} ${card.primaryPriority.summary}`,
              ) ? (
                <div className={styles.attendanceAlert}>
                  <StatusBadge tone="priority">Attendance concern</StatusBadge>
                  <p>{card.primaryPriority.summary}</p>
                </div>
              ) : null}

              <div className={styles.timelineBlock}>
                <h3 className={styles.panelTitle}>Attendance activity</h3>
                {attendanceEvents.length === 0 ? (
                  <p className={styles.timelineEmpty}>
                    No attendance-specific timeline events yet. Session-level
                    registers will appear here once attendance tracking is
                    connected.
                  </p>
                ) : (
                  <ol className={styles.timelineList}>
                    {attendanceEvents.map((event) => (
                      <li key={event.id} className={styles.timelineItem}>
                        <StatusBadge tone={activityTone(event.eventType)}>
                          {event.eventType}
                        </StatusBadge>
                        <p className={styles.eventSummary}>{event.summary}</p>
                        <p className={styles.eventMeta}>
                          {event.actorName ?? "System"} ·{" "}
                          {new Date(event.occurredAt).toLocaleDateString(
                            "en-GB",
                          )}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          ) : null}

          {!showRestrictedSupport && showPack ? (
            <>
              {workspace.summaryNote ? (
                <EmptyState
                  title="Awaiting intake"
                  description={workspace.summaryNote}
                  className={styles.intakeEmpty}
                />
              ) : null}

              {sections.length > 0 ? (
                <nav className={styles.sectionNav} aria-label="ADM14 sections">
                  {sections.map((section) => {
                    const critical = sectionCriticalCount(section);
                    const attention = sectionAttentionCount(section);
                    const selected = section.sectionKey === activeSection?.sectionKey;
                    return (
                      <button
                        key={section.sectionKey}
                        type="button"
                        className={
                          selected
                            ? styles.sectionNavActive
                            : critical > 0
                              ? styles.sectionNavCritical
                              : attention > 0
                                ? styles.sectionNavAttention
                                : styles.sectionNavLink
                        }
                        aria-pressed={selected}
                        onClick={() => setActiveSectionKey(section.sectionKey)}
                      >
                        <span className={styles.sectionNavText}>
                          <span className={styles.sectionNavNumber}>
                            {section.originalBookletSection}
                          </span>
                          <span className={styles.sectionNavName}>
                            {section.sectionTitle}
                          </span>
                        </span>
                        {critical > 0 ? (
                          <span className={styles.navBadgeCritical}>
                            {critical}
                          </span>
                        ) : attention > 0 ? (
                          <span className={styles.navBadgeAttention}>
                            {attention}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </nav>
              ) : null}

              {evidenceRows.length === 0 ? (
                <EmptyState
                  title="Evidence pack not yet initialised"
                  description="Requirements will attach when the learner is linked to a framework version during intake."
                />
              ) : activeSection ? (
                <section
                  className={styles.sectionCard}
                  aria-labelledby={`heading-${activeSection.sectionKey}`}
                >
                  <header className={styles.sectionHeading}>
                    <div>
                      <h2 id={`heading-${activeSection.sectionKey}`}>
                        {activeSection.originalBookletSection} ·{" "}
                        {activeSection.sectionTitle}
                      </h2>
                      <p className={styles.sectionHint}>
                        Showing this section only — switch above to change.
                      </p>
                    </div>
                    <div className={styles.sectionMeta}>
                      {sectionCriticalCount(activeSection) > 0 ? (
                        <span className={styles.metaCritical}>
                          {sectionCriticalCount(activeSection)} mandatory
                          missing
                        </span>
                      ) : null}
                      {sectionAttentionCount(activeSection) > 0 ? (
                        <span className={styles.metaAttention}>
                          {sectionAttentionCount(activeSection)} need attention
                        </span>
                      ) : (
                        <span className={styles.metaOk}>Section clear</span>
                      )}
                      <span className={styles.sectionCount}>
                        {activeSection.rows.length} item
                        {activeSection.rows.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </header>

                  <ul className={styles.requirementList}>
                    {activeSection.rows.map((row) => {
                      const attention = rowAttention(row);
                      return (
                        <li
                          key={row.id}
                          className={`${styles.requirementRow} ${ATTENTION_ROW_CLASS[attention]}`}
                          role="button"
                          tabIndex={0}
                          aria-label={`${row.status === "future_requirement" ? "View" : "Enter data for"} ${row.reference} ${row.title}`}
                          onClick={() => setEditingRowId(row.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setEditingRowId(row.id);
                            }
                          }}
                        >
                          <div className={styles.requirementTop}>
                            <div className={styles.requirementIdentity}>
                              <span className={styles.refCell}>
                                {row.reference}
                              </span>
                              <span
                                className={
                                  row.requirementKind === "mandatory"
                                    ? styles.kindMandatory
                                    : styles.kindOptional
                                }
                                title={
                                  row.requirementKind === "mandatory"
                                    ? "Mandatory"
                                    : "Optional / where applicable"
                                }
                              >
                                {row.requirementKind === "mandatory"
                                  ? "Mandatory"
                                  : "Optional"}
                              </span>
                            </div>
                            <StatusBadge tone={evidenceStatusTone(row.status)}>
                              {evidenceStatusLabel(row.status)}
                            </StatusBadge>
                          </div>

                          <p className={styles.documentTitle}>{row.title}</p>
                          <p className={styles.applicability}>
                            {row.applicability}
                            {row.isRecurring
                              ? ` · Recurring · ${row.evidenceCount} record${row.evidenceCount === 1 ? "" : "s"}`
                              : null}
                          </p>

                          <dl className={styles.requirementMeta}>
                            <div>
                              <dt>Received</dt>
                              <dd>{row.dateReceived ?? "—"}</dd>
                            </div>
                            <div>
                              <dt>Staff</dt>
                              <dd>{row.checkedBy ?? "—"}</dd>
                            </div>
                            <div>
                              <dt>Notes</dt>
                              <dd>{row.notes ?? "—"}</dd>
                            </div>
                          </dl>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
        </div>

        <aside className={styles.supportPanel} aria-label="Learner context">
          <div className={styles.sidePeople}>
            <div className={styles.sidePerson}>
              <span className={styles.sidePersonLabel}>Tutor</span>
              <span className={styles.sidePersonValue}>
                {card.tutorName ?? "Not assigned"}
              </span>
            </div>
            <div className={styles.sidePerson}>
              <span className={styles.sidePersonLabel}>Mentor</span>
              <span className={styles.sidePersonValue}>
                {card.mentorName ?? "Not assigned"}
              </span>
            </div>
          </div>

          <div className={styles.ragRow}>
            <div className={styles.ragItem}>
              <span className={styles.ragLabel}>Progress</span>
              <StatusBadge
                tone={contextStatusTone(workspace.progressStatus)}
              >
                {workspace.progressStatus ?? "Unknown"}
              </StatusBadge>
            </div>
            <Link
              href={attendanceHref}
              className={
                showAttendance
                  ? styles.ragButtonActive
                  : styles.ragButton
              }
              aria-current={showAttendance ? "page" : undefined}
            >
              <span className={styles.ragLabel}>Attendance</span>
              <StatusBadge tone={attendanceTone}>
                {workspace.attendanceStatus ?? "Not recorded"}
              </StatusBadge>
            </Link>
            <div className={styles.ragItem}>
              <span className={styles.ragLabel}>Compliance</span>
              <StatusBadge
                tone={contextStatusTone(workspace.complianceStatus)}
              >
                {workspace.complianceStatus ?? "Unknown"}
              </StatusBadge>
            </div>
          </div>

          <div className={styles.timelineBlock}>
            <h2 className={styles.panelTitle}>Recent activity</h2>
            {recentTimeline.length === 0 ? (
              <p className={styles.timelineEmpty}>No timeline events yet.</p>
            ) : (
              <ol className={styles.timelineList}>
                {recentTimeline.map((event) => (
                  <li key={event.id} className={styles.timelineItem}>
                    <StatusBadge tone={activityTone(event.eventType)}>
                      {event.eventType}
                    </StatusBadge>
                    <p className={styles.eventSummary}>{event.summary}</p>
                    <p className={styles.eventMeta}>
                      {event.actorName ?? "System"} ·{" "}
                      {new Date(event.occurredAt).toLocaleDateString("en-GB")}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>

      {editingRow ? (
        <PackItemEditor
          learnerId={resolvedLearnerId}
          row={editingRow}
          onClose={() => setEditingRowId(null)}
          onSaved={() => {
            /* pack store subscription refreshes rows */
          }}
        />
      ) : null}
    </div>
  );
}
