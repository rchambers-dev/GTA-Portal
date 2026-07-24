/**
 * AI access container — deny-by-default sandbox.
 *
 * Each feature runs inside a container that only allows named data scopes
 * and actions. Context outside the allowlist is stripped and never sent
 * to the model. Extending access means editing the container registry —
 * not the feature UI.
 */

import type { AiFeatureKey } from "./types";

/** Named data domains AI may read when listed on a container. */
export type AiDataScope =
  | "cv.draft"
  | "cv.job_description"
  | "learner.profile_public"
  | "learner.programme_public"
  | "learner.modules_public"
  | "module.published_content"
  | "chat.thread_current"
  | "support.ticket_summary";

/**
 * Named actions AI may perform. Keep this list small and explicit.
 * "write.*" means suggest text only — never auto-persist unless a
 * separate human-confirmed flow does so.
 */
export type AiAction =
  | "text.rewrite"
  | "text.suggest"
  | "text.explain"
  | "cv.apply_suggestion";

/** Hard exclusions — always blocked, even if a caller tries to pass them. */
export const AI_GLOBAL_DENY_SCOPES = [
  "safeguarding.notes",
  "safeguarding.cases",
  "staff.internal_notes",
  "employer.concern_internal",
  "auth.credentials",
  "admin.system",
  "rbac.assignments",
  "finance",
  "other_learners",
] as const;

export type AiDeniedScope = (typeof AI_GLOBAL_DENY_SCOPES)[number];

export type AiAccessContainer = {
  feature: AiFeatureKey;
  /** Human-readable purpose injected into the boundary system prompt. */
  purpose: string;
  /** Data the model may receive for this feature. */
  allowedScopes: readonly AiDataScope[];
  /** Actions the feature is allowed to request. */
  allowedActions: readonly AiAction[];
  /**
   * Workspaces that may invoke this feature.
   * Empty = any workspace with AI_USE (still subject to permission).
   */
  allowedWorkspaces: readonly ("learner" | "staff" | "employer" | "quality" | "management" | "administration" | "safeguarding")[];
  /** Max characters of user-supplied context (after packing). */
  maxContextChars: number;
  /** Whether user messages may include free-form pasted text beyond scoped fields. */
  allowFreeformUserText: boolean;
};

/**
 * Per-feature containers. Default is deny — if a scope isn't listed, AI
 * cannot see it for that feature.
 */
export const AI_ACCESS_CONTAINERS: Record<AiFeatureKey, AiAccessContainer> = {
  "cv.improve_summary": {
    feature: "cv.improve_summary",
    purpose:
      "Improve the learner's own CV professional summary. Do not invent employers, grades, or qualifications.",
    allowedScopes: ["cv.draft", "learner.profile_public", "learner.programme_public"],
    allowedActions: ["text.rewrite", "cv.apply_suggestion"],
    allowedWorkspaces: ["learner"],
    maxContextChars: 8_000,
    allowFreeformUserText: false,
  },
  "cv.improve_bullets": {
    feature: "cv.improve_bullets",
    purpose:
      "Polish experience bullet points on the learner's own CV. Keep their meaning; do not fabricate achievements. Module titles may inform wording but must not invent work the learner did not do.",
    allowedScopes: [
      "cv.draft",
      "learner.profile_public",
      "learner.modules_public",
    ],
    allowedActions: ["text.rewrite", "cv.apply_suggestion"],
    allowedWorkspaces: ["learner"],
    maxContextChars: 8_000,
    allowFreeformUserText: false,
  },
  "cv.suggest_experience_bullets": {
    feature: "cv.suggest_experience_bullets",
    purpose:
      "Suggest short CV experience bullets grounded in the learner's completed and in-progress module titles. Do not invent employers, grades, or tasks beyond what modules and the draft support.",
    allowedScopes: [
      "cv.draft",
      "learner.profile_public",
      "learner.programme_public",
      "learner.modules_public",
    ],
    allowedActions: ["text.suggest", "cv.apply_suggestion"],
    allowedWorkspaces: ["learner"],
    maxContextChars: 8_000,
    allowFreeformUserText: false,
  },
  "cv.suggest_skills": {
    feature: "cv.suggest_skills",
    purpose:
      "Suggest relevant skills from the learner's programme and CV draft only.",
    allowedScopes: ["cv.draft", "learner.profile_public", "learner.programme_public"],
    allowedActions: ["text.suggest", "cv.apply_suggestion"],
    allowedWorkspaces: ["learner"],
    maxContextChars: 6_000,
    allowFreeformUserText: false,
  },
  "cv.tailor_to_job": {
    feature: "cv.tailor_to_job",
    purpose:
      "Tailor the learner's CV wording to a job description they pasted. Do not claim experience they did not provide.",
    allowedScopes: [
      "cv.draft",
      "cv.job_description",
      "learner.profile_public",
      "learner.programme_public",
    ],
    allowedActions: ["text.rewrite", "cv.apply_suggestion"],
    allowedWorkspaces: ["learner"],
    maxContextChars: 14_000,
    allowFreeformUserText: false,
  },
  "cv.improve_education": {
    feature: "cv.improve_education",
    purpose:
      "Rewrite education/training detail on the learner's CV using their public programme progress and completed module titles. Do not invent modules, grades, or awards.",
    allowedScopes: [
      "cv.draft",
      "learner.profile_public",
      "learner.programme_public",
      "learner.modules_public",
    ],
    allowedActions: ["text.rewrite", "cv.apply_suggestion"],
    allowedWorkspaces: ["learner"],
    maxContextChars: 10_000,
    allowFreeformUserText: false,
  },
  "chat.draft_reply": {
    feature: "chat.draft_reply",
    purpose:
      "Draft a reply for the current chat thread only. Never invent policy decisions or access other learners' data.",
    allowedScopes: ["chat.thread_current", "learner.profile_public"],
    allowedActions: ["text.suggest"],
    allowedWorkspaces: ["learner", "staff", "employer"],
    maxContextChars: 10_000,
    allowFreeformUserText: true,
  },
  "support.suggest_response": {
    feature: "support.suggest_response",
    purpose:
      "Suggest a staff support reply from the ticket summary only. Never access safeguarding case notes. Never auto-send.",
    allowedScopes: ["support.ticket_summary"],
    allowedActions: ["text.suggest"],
    allowedWorkspaces: ["staff"],
    maxContextChars: 8_000,
    allowFreeformUserText: true,
  },
  "learning.explain": {
    feature: "learning.explain",
    purpose:
      "Explain published module/topic content in simpler language. Do not reveal unpublished curriculum or staff notes.",
    allowedScopes: ["module.published_content", "learner.programme_public"],
    allowedActions: ["text.explain"],
    allowedWorkspaces: ["learner"],
    maxContextChars: 12_000,
    allowFreeformUserText: true,
  },
};

export function getAiAccessContainer(feature: AiFeatureKey): AiAccessContainer {
  return AI_ACCESS_CONTAINERS[feature];
}

export function containerAllowsScope(
  container: AiAccessContainer,
  scope: AiDataScope,
): boolean {
  return container.allowedScopes.includes(scope);
}

export function containerAllowsAction(
  container: AiAccessContainer,
  action: AiAction,
): boolean {
  return container.allowedActions.includes(action);
}
