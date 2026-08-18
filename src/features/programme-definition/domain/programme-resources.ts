/**
 * Programme teaching resources and session/block attachments (Phase 2A).
 */

export const RESOURCE_ROLES = [
  "TUTOR_DELIVERY",
  "LEARNER_LEARNING",
  "LEARNER_REVISION",
  "PRACTICE",
  "ASSESSMENT_PREP",
  "CONTROLLED_FORM",
] as const;

export type ResourceRole = (typeof RESOURCE_ROLES)[number];

export const RESOURCE_AUDIENCES = ["TUTOR_ONLY", "LEARNER_VISIBLE"] as const;
export type ResourceAudience = (typeof RESOURCE_AUDIENCES)[number];

export const LEARNER_RELEASE_TIMINGS = [
  "WITH_SESSION",
  "REVIEW_LATER",
] as const;
export type LearnerReleaseTiming = (typeof LEARNER_RELEASE_TIMINGS)[number];

export type SessionPublishStatus = "draft" | "published";

export type LearningObjectivesReview = {
  status: "empty" | "candidate_for_review" | "approved_structured";
  sourceLabel?: string;
  lessonAims?: string[];
  byTheEnd?: string[];
  notes?: string;
};

export type ProgrammeResourceRecord = {
  id: string;
  programmeVersionId: string;
  resourceKey: string;
  title: string;
  filename: string;
  sourcePath: string;
  evidenceResourceId: string;
  extractPath: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ProgrammeResourceAttachmentRecord = {
  id: string;
  programmeVersionId: string;
  resourceId: string;
  sessionId: string | null;
  spineItemId: string;
  role: ResourceRole;
  audience: ResourceAudience;
  learnerReleaseTiming: LearnerReleaseTiming | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function isResourceRole(value: string): value is ResourceRole {
  return (RESOURCE_ROLES as readonly string[]).includes(value);
}

export function isResourceAudience(value: string): value is ResourceAudience {
  return (RESOURCE_AUDIENCES as readonly string[]).includes(value);
}

export function isLearnerReleaseTiming(
  value: string,
): value is LearnerReleaseTiming {
  return (LEARNER_RELEASE_TIMINGS as readonly string[]).includes(value);
}

/** Plain-language labels for curriculum users (hide raw enums in UI). */
export function labelResourceRole(role: ResourceRole): string {
  switch (role) {
    case "TUTOR_DELIVERY":
      return "Tutor delivery";
    case "LEARNER_LEARNING":
      return "Learner learning";
    case "LEARNER_REVISION":
      return "Reference";
    case "PRACTICE":
      return "Activity / practice";
    case "ASSESSMENT_PREP":
      return "Assessment preparation";
    case "CONTROLLED_FORM":
      return "Controlled form";
  }
}

export function labelResourceAudience(audience: ResourceAudience): string {
  switch (audience) {
    case "TUTOR_ONLY":
      return "Tutor only";
    case "LEARNER_VISIBLE":
      return "Learner visible";
  }
}

export function labelLearnerReleaseTiming(
  timing: LearnerReleaseTiming,
): string {
  switch (timing) {
    case "WITH_SESSION":
      return "With Session";
    case "REVIEW_LATER":
      return "Release later for review";
  }
}

/** Curriculum Lead sets audience independently of file type. */
export function suggestedAudienceForRole(role: ResourceRole): ResourceAudience {
  switch (role) {
    case "TUTOR_DELIVERY":
    case "CONTROLLED_FORM":
      return "TUTOR_ONLY";
    default:
      return "LEARNER_VISIBLE";
  }
}

export function defaultLearnerReleaseTiming(
  audience: ResourceAudience,
): LearnerReleaseTiming | null {
  return audience === "LEARNER_VISIBLE" ? "WITH_SESSION" : null;
}

export function isPowerpointFilename(filename: string): boolean {
  return /\.(ppt|pptx|pptm)$/i.test(filename.trim());
}

export type LearnerMaterialKind =
  | "powerpoint"
  | "handout"
  | "worksheet"
  | "document";

export function classifyLearnerMaterialKind(input: {
  filename: string;
  title?: string;
  role?: string;
}): {
  kind: LearnerMaterialKind;
  kindLabel: string;
  openLabel: string;
} {
  if (isPowerpointFilename(input.filename)) {
    return {
      kind: "powerpoint",
      kindLabel: "PowerPoint",
      openLabel: "Open presentation",
    };
  }
  const blob = `${input.title || ""} ${input.filename} ${input.role || ""}`.toLowerCase();
  if (input.role === "PRACTICE" || /worksheet/.test(blob)) {
    return {
      kind: "worksheet",
      kindLabel: "Worksheet",
      openLabel: "Open",
    };
  }
  if (/\.pdf$/i.test(input.filename) || /handout/.test(blob)) {
    return {
      kind: "handout",
      kindLabel: "Handout",
      openLabel: "Open",
    };
  }
  return {
    kind: "document",
    kindLabel: "Document",
    openLabel: "Open",
  };
}

/**
 * Honest catalogue openability. GTA Portal does not host original binaries.
 * Learners/tutors can read a stored extract when one exists.
 */
export function catalogueFileOpenCapabilities(filename: string): {
  extension: string;
  originalBinaryHostedInPortal: false;
  previewInBrowser: false;
  downloadOriginal: false;
  canShowExtractIfPresent: true;
} {
  const match = filename.trim().match(/(\.[a-z0-9]+)$/i);
  return {
    extension: (match?.[1] || "").toLowerCase(),
    originalBinaryHostedInPortal: false,
    previewInBrowser: false,
    downloadOriginal: false,
    canShowExtractIfPresent: true,
  };
}

export function staffResourceOpenLabels(filename: string): {
  viewExtract: string;
  openOriginal: string;
  originalAvailableInBrowser: boolean;
} {
  if (isPowerpointFilename(filename)) {
    return {
      viewExtract: "View extract",
      openOriginal: "Open PowerPoint",
      originalAvailableInBrowser: false,
    };
  }
  return {
    viewExtract: "View extract",
    openOriginal: "View resource",
    originalAvailableInBrowser: false,
  };
}
