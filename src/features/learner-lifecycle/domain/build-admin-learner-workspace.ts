import type { AdminLearnerRecord } from "@/features/administration/domain/types";
import type { AdminLearnerEnrolment } from "@/features/administration/domain/types";
import type { LearnerWorkspaceDto } from "../types";
import { buildBlankPackRows } from "./pack-store";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Build a Learners pack workspace from an admin intake/enrolment record. */
export function buildAdminLearnerWorkspace(
  learner: AdminLearnerRecord,
  enrolment: AdminLearnerEnrolment | null,
): LearnerWorkspaceDto {
  const ready = learner.intakeStatus === "ready" || Boolean(enrolment);
  return {
    card: {
      learnerId: learner.id,
      displayName: learner.displayName,
      initials: initials(learner.displayName) || "?",
      programmeName: enrolment?.programmeName ?? "Not enrolled yet",
      employerName: enrolment?.employerName ?? null,
      programmeWeek: enrolment?.programmeWeek ?? null,
      programmeStatus: enrolment
        ? enrolment.status === "pending_start"
          ? "pre_start"
          : "on_programme"
        : "pre_start",
      overallStatus: enrolment
        ? enrolment.status === "pending_start"
          ? "pre_start"
          : "on_track"
        : "pre_start",
      primaryPriority: null,
      attendancePercent: enrolment?.attendancePercent ?? null,
      nextReviewDate: null,
      openActionCount: 0,
      missingMandatoryEvidenceCount: 0,
      evidenceCheckedCount: 0,
      evidenceTotalCount: 0,
      programmeOverdueLabel: null,
      boardWeek: enrolment?.programmeWeek ?? null,
      mentorName: enrolment?.mentorName ?? null,
      tutorName: enrolment?.tutorName ?? null,
      intakeComplete: ready,
    },
    learnerReference: learner.learnerReference,
    programmeStartDate: enrolment?.startDate ?? null,
    originalPlannedEndDate: null,
    currentWeekLabel:
      enrolment?.programmeWeek != null
        ? `Y${enrolment.programmeYear ?? "—"} · W${enrolment.programmeWeek}`
        : null,
    progressStatus: ready ? "Monitoring" : null,
    attendanceStatus:
      enrolment?.attendancePercent != null
        ? `${enrolment.attendancePercent}%`
        : null,
    complianceStatus: ready ? "Monitoring" : null,
    summaryNote: ready
      ? null
      : "Personal intake is still in progress — pack opens once they're marked ready.",
    evidenceRows: ready ? buildBlankPackRows() : [],
    timeline: [],
  };
}
