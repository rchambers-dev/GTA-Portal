import type { MentorApprenticeRow } from "../../data/mentor-caseload";
import type { FormalReview, ReviewRequirement } from "./types";

/** Realistic review narrative content keyed from apprentice position. */
export function buildReviewNarrative(
  apprentice: MentorApprenticeRow,
  requirement: ReviewRequirement,
): Pick<
  FormalReview,
  | "discussionNotes"
  | "barriersNotes"
  | "wellbeingNotes"
  | "learningFocus"
  | "employerWorkplaceNotes"
  | "progressJudgement"
> {
  const variance = apprentice.actualProgressPercent - apprentice.plannedProgressPercent;
  const behind = variance < -5;
  const ahead = variance > 3;

  const judgement = behind
    ? apprentice.programmeOverdue
      ? "Significantly behind — recovery required"
      : "Behind — recovering"
    : ahead
      ? "Ahead of planned progress"
      : "On track";

  const apprenticeReady =
    requirement.checklist.find((c) => c.key === "apprentice_reflection_received")
      ?.state === "complete";
  const employerReady =
    requirement.checklist.find((c) => c.key === "employer_feedback_received")
      ?.state === "complete";

  return {
    progressJudgement: judgement,
    discussionNotes: [
      `${apprentice.displayName} is on Year ${apprentice.programmeYear} of ${apprentice.programmeName} with ${apprentice.employerName}.`,
      `Planned progress at review: ${apprentice.plannedProgressPercent}%. Actual: ${apprentice.actualProgressPercent}% (${variance >= 0 ? "+" : ""}${variance}% variance).`,
      behind
        ? "Discussion focused on recovering unfinished modules, clarifying workplace opportunities, and agreeing checkpoint dates."
        : ahead
          ? "Discussion confirmed strong workplace practice and readiness to stretch into the next module set."
          : "Discussion confirmed learning is broadly on plan; focus remained on consolidating current modules and evidence quality.",
      apprenticeReady
        ? "Apprentice reflection was reviewed in the meeting and used to shape actions."
        : "Apprentice reflection was not available at create time; discussion still covered learning and confidence.",
    ].join(" "),
    barriersNotes: behind
      ? apprentice.employerConcernStatus !== "none"
        ? "Workplace access / employer concern remains open and is affecting off-the-job opportunities. Mentor to chase employer commitment and record barrier impact."
        : apprentice.attendancePercent != null && apprentice.attendancePercent < 90
          ? "Attendance dips are reducing workshop continuity. Agreed to monitor weekly and involve employer if absences continue."
          : "Main barrier is incomplete mandatory evidence and slower module throughput than planned. No safeguarding concern identified."
      : apprentice.missingMandatoryEvidence > 0
        ? `${apprentice.missingMandatoryEvidence} mandatory evidence item(s) still outstanding — not blocking learning but needed before next gateway checkpoint.`
        : "No significant barriers recorded. Workplace mentoring reported as supportive.",
    wellbeingNotes:
      "Wellbeing prompts completed. Apprentice confirmed they feel supported at work and by GTA. No safeguarding disclosure. Reminders given on who to contact if concerns arise.",
    learningFocus: behind
      ? `Priority learning focus: close remaining Year ${apprentice.programmeYear} modules already started, secure tutor observation evidence, and stabilise attendance/OTJ logging.`
      : `Priority learning focus: deepen competence on current Year ${apprentice.programmeYear} modules and prepare clean evidence for the next review cycle.`,
    employerWorkplaceNotes: employerReady
      ? `${apprentice.employerName} feedback confirms workplace tasks are being allocated. Mentor discussed mentoring hours and evidence the employer can confirm.`
      : `Employer feedback was incomplete at preparation. Workplace discussion still covered task allocation with ${apprentice.employerName}; follow-up feedback requested.`,
  };
}

export function buildContributionText(
  apprentice: MentorApprenticeRow,
  kind: "apprentice" | "employer" | "tutor",
  received: boolean,
): string | null {
  if (!received) return null;

  if (kind === "apprentice") {
    return [
      `I feel more confident on the practical side of ${apprentice.programmeName}, especially the tasks I get to repeat at ${apprentice.employerName}.`,
      apprentice.actualProgressPercent < apprentice.plannedProgressPercent
        ? "I know I am a bit behind on some evidence and want clearer weekly targets so I do not fall further behind."
        : "I am happy with how the modules are going and would like more stretch tasks where the workplace can support them.",
      "I would like more feedback after assessments so I know exactly what to improve before the next review.",
    ].join(" ");
  }

  if (kind === "employer") {
    return [
      `${apprentice.displayName} is engaged in the workplace and follows instruction well.`,
      apprentice.attendancePercent != null && apprentice.attendancePercent < 90
        ? "Attendance has been inconsistent on a few occasions; we have spoken about reliability."
        : "Attendance and punctuality have been good.",
      "We can continue to provide mentoring time and confirm workplace evidence when asked. Please keep us updated on any module deadlines that need workplace tasks.",
    ].join(" ");
  }

  return [
    `Tutor evidence confirms ${apprentice.displayName} is working through the Year ${apprentice.programmeYear} module set for ${apprentice.programmeName}.`,
    apprentice.actualProgressPercent < apprentice.plannedProgressPercent
      ? "Current concern is pace against plan — recommend focused workshop support and closer checking of outstanding evidence."
      : "Progress against taught modules is appropriate for this stage; continue consolidating assessment criteria.",
    "Observation notes and marked work have been attached to the preparation pack where available.",
  ].join(" ");
}
