import type { AdminApprenticeRecord } from "@/features/administration/domain/types";
import type { AdminApprenticeEnrolment } from "@/features/administration/domain/types";
import type { ApprenticeWorkspaceDto } from "../types";
import { describeProgrammeTiming } from "./programme-week";
import { formatProgressStatusLabel } from "./progress-framing";
import { buildBlankPackRows } from "./pack-store";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Build a Apprentices pack workspace from an admin intake/enrolment record. */
export function buildAdminApprenticeWorkspace(
  apprentice: AdminApprenticeRecord,
  enrolment: AdminApprenticeEnrolment | null,
): ApprenticeWorkspaceDto {
  const ready = apprentice.intakeStatus === "ready" || Boolean(enrolment);
  const evidenceRows = buildBlankPackRows();
  const missingMandatory = evidenceRows.filter(
    (r) =>
      r.requirementKind === "mandatory" &&
      r.status !== "future_requirement" &&
      r.status === "missing",
  ).length;
  const timing = describeProgrammeTiming(enrolment?.startDate ?? null);
  const hasStarted = timing.hasStarted;
  const progress =
    enrolment?.startDate && enrolment.originalPlannedEndDate
      ? formatProgressStatusLabel({
          programmeStatus: enrolment.status,
          startDate: enrolment.startDate,
          originalPlannedEndDate: enrolment.originalPlannedEndDate,
          actualProgressPercent: enrolment.actualProgressPercent,
        })
      : null;
  return {
    card: {
      apprenticeId: apprentice.id,
      displayName: apprentice.displayName,
      initials: initials(apprentice.displayName) || "?",
      programmeName: enrolment?.programmeName ?? "Not enrolled yet",
      employerName: enrolment?.employerName ?? null,
      programmeWeek: timing.week,
      programmeStatus: enrolment
        ? enrolment.status === "withdrawn"
          ? "withdrawn"
          : enrolment.status === "completed"
            ? "completed"
            : hasStarted
              ? "on_programme"
              : "pre_start"
        : "pre_start",
      overallStatus: enrolment
        ? enrolment.status === "withdrawn"
          ? "unknown"
          : enrolment.status === "completed"
            ? "completed"
            : hasStarted
              ? "on_track"
              : "pre_start"
        : "pre_start",
      primaryPriority: null,
      attendancePercent: enrolment?.attendancePercent ?? null,
      nextReviewDate: null,
      openActionCount: 0,
      missingMandatoryEvidenceCount: missingMandatory,
      evidenceCheckedCount: 0,
      evidenceTotalCount: evidenceRows.length,
      programmeOverdueLabel: null,
      boardWeek: timing.week,
      mentorName: enrolment?.mentorName ?? null,
      tutorName: enrolment?.tutorName ?? null,
      intakeComplete: ready,
    },
    apprenticeReference: apprentice.apprenticeReference,
    programmeStartDate: enrolment?.startDate ?? null,
    originalPlannedEndDate: enrolment?.originalPlannedEndDate ?? null,
    currentWeekLabel: timing.timeOnProgramme
      ? `${timing.weekLabel} · ${timing.timeOnProgramme}`
      : timing.weekLabel,
    progressStatus: progress
      ? `${progress.badge} · ${progress.detail}`
      : ready
        ? "Monitoring"
        : null,
    attendanceStatus:
      enrolment?.attendancePercent != null
        ? `${enrolment.attendancePercent}%`
        : null,
    complianceStatus: ready
      ? "ADM14 pack ready for staff entry"
      : "Finish intake, then fill progressive pack documents here",
    summaryNote: [
      enrolment?.workplaceContact?.trim()
        ? `Workplace contact: ${enrolment.workplaceContact.trim()}`
        : null,
      enrolment?.collegeDays?.trim()
        ? `College days: ${enrolment.collegeDays.trim()}`
        : null,
      ready
        ? null
        : "Apprentice is on the system. Finish personal intake, then fill progressive pack documents here.",
    ]
      .filter(Boolean)
      .join(" · ") || null,
    // Full Main pack checklist is available as soon as the apprentice record exists.
    evidenceRows,
    timeline: [],
  };
}
