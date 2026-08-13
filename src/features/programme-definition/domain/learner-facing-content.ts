/**
 * Dedicated learner-facing Session copy.
 * Tutor lesson-plan extracts may seed a staff-side candidate.
 * Only approved_published copy is returned to apprentices.
 */

export const LEARNER_CONTENT_PENDING =
  "Your tutor will take you through this during the session. After it has been delivered, you can come back here to review what you learned.";

export const LEARNER_ACTIVITY_PENDING =
  "Your tutor will explain the activity during this session.";

export type LearnerFacingContentStatus =
  | "empty"
  | "candidate_for_review"
  | "approved_published";

export type LearnerFacingDraft = {
  summary: string;
  learningContent: string;
  activityPractice: string;
  sourceLabel: string;
};

export type LearnerFacingApproved = LearnerFacingDraft & {
  approvedAt: string;
  approvedByName: string;
};

export type LearnerFacingContent = {
  status: LearnerFacingContentStatus;
  candidate: LearnerFacingDraft | null;
  approved: LearnerFacingApproved | null;
};

export const EMPTY_LEARNER_FACING_CONTENT: LearnerFacingContent = {
  status: "empty",
  candidate: null,
  approved: null,
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asDraft(raw: unknown): LearnerFacingDraft | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const draft: LearnerFacingDraft = {
    summary: asText(o.summary),
    learningContent: asText(o.learningContent),
    activityPractice: asText(o.activityPractice),
    sourceLabel: asText(o.sourceLabel),
  };
  if (
    !draft.summary &&
    !draft.learningContent &&
    !draft.activityPractice
  ) {
    return null;
  }
  return draft;
}

export function parseLearnerFacingContent(raw: unknown): LearnerFacingContent {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return EMPTY_LEARNER_FACING_CONTENT;
  }
  const o = raw as Record<string, unknown>;
  const candidate = asDraft(o.candidate);
  const approvedDraft = asDraft(o.approved);
  const approved: LearnerFacingApproved | null = approvedDraft
    ? {
        ...approvedDraft,
        approvedAt: asText((o.approved as Record<string, unknown>)?.approvedAt),
        approvedByName: asText(
          (o.approved as Record<string, unknown>)?.approvedByName,
        ),
      }
    : null;
  const status =
    o.status === "approved_published" ||
    o.status === "candidate_for_review" ||
    o.status === "empty"
      ? o.status
      : approved
        ? "approved_published"
        : candidate
          ? "candidate_for_review"
          : "empty";
  return { status, candidate, approved };
}

export function approvedLearnerCopy(
  content: LearnerFacingContent | null | undefined,
): LearnerFacingDraft | null {
  if (!content || content.status !== "approved_published") return null;
  return content.approved;
}

export function candidateFromSource(input: {
  sourceLabel: string;
  topic?: string;
  lessonAims?: string[];
  byTheEnd?: string[];
  activityLines?: string[];
}): LearnerFacingDraft {
  const aims = (input.lessonAims ?? []).map((s) => s.trim()).filter(Boolean);
  const ends = (input.byTheEnd ?? []).map((s) => s.trim()).filter(Boolean);
  const activities = (input.activityLines ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const learningParts: string[] = [];
  if (aims.length) learningParts.push(aims.join(" "));
  if (ends.length) {
    learningParts.push(`By the end you should be able to: ${ends.join(" ")}`);
  }
  return {
    summary: (input.topic || "").trim(),
    learningContent: learningParts.join("\n\n"),
    activityPractice: activities.join("\n\n"),
    sourceLabel: input.sourceLabel.trim() || "Source extract",
  };
}

/** Learner-facing labels only. Controlled DB titles stay unchanged. */
const LEARNER_BLOCK_DISPLAY_LABELS: Record<number, string> = {
  1: "Foundation Skills",
};

export function learnerFacingBlockTitle(
  ordinal: number,
  storedTitle: string,
): string {
  const mapped = LEARNER_BLOCK_DISPLAY_LABELS[ordinal];
  if (mapped) return `Block ${ordinal} — ${mapped}`;
  const cleaned = storedTitle
    .replace(/^Block\s*\d+\s*[—–:\-]\s*/i, "")
    .replace(/\s*[-—–]\s*Shared Controlled Programme\s*$/i, "")
    .trim();
  if (!cleaned) return `Block ${ordinal}`;
  return `Block ${ordinal} — ${cleaned}`;
}

export function learnerFacingSessionTitle(input: {
  title: string;
  topic?: string | null;
}): string {
  const raw = (input.topic || input.title || "").trim();
  return raw.replace(/^FS\d{2}\s*[:.—–-]\s*/i, "").trim() || raw;
}

export function sessionCodesLine(input: {
  calendarWeek: number;
  foundationSkillCode?: string | null;
  sessionKey: string;
}): string {
  const parts = [`Week ${input.calendarWeek}`];
  if (input.foundationSkillCode?.trim()) {
    parts.push(input.foundationSkillCode.trim());
  }
  parts.push(input.sessionKey);
  return parts.join(" · ");
}

export function isSecurityTestFixtureResource(input: {
  title?: string;
  filename?: string;
}): boolean {
  const blob = `${input.title || ""} ${input.filename || ""}`;
  return /TEST learner|SAFE DEMO|_fixture|TEST_W00/i.test(blob);
}

export function labelLearnerMaterialPurpose(role: string): string {
  switch (role) {
    case "LEARNER_REVISION":
      return "Revision material";
    case "PRACTICE":
      return "Activity";
    case "ASSESSMENT_PREP":
      return "Assessment preparation";
    default:
      return "Learning material";
  }
}
