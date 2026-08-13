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

/** Plain-language labels for curriculum users (hide raw enums in UI). */
export function labelResourceRole(role: ResourceRole): string {
  switch (role) {
    case "TUTOR_DELIVERY":
      return "Tutor delivery";
    case "LEARNER_LEARNING":
      return "Learner learning";
    case "LEARNER_REVISION":
      return "Learner revision";
    case "PRACTICE":
      return "Practice";
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
      return "Visible to learners";
  }
}
