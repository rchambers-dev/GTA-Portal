import type { AiFeatureKey, AiFeatureMeta } from "./types";

/**
 * Registry of AI entry points across the portal.
 * Add a key here before wiring UI — keeps usage reports consistent.
 */
export const AI_FEATURES: Record<AiFeatureKey, AiFeatureMeta> = {
  "cv.improve_summary": {
    key: "cv.improve_summary",
    label: "Improve CV summary",
    area: "apprentice",
    description: "Rewrite an apprentice CV professional summary for clarity and impact.",
  },
  "cv.improve_bullets": {
    key: "cv.improve_bullets",
    label: "Improve CV bullets",
    area: "apprentice",
    description: "Polish experience bullet points while keeping the apprentice's meaning.",
  },
  "cv.suggest_experience_bullets": {
    key: "cv.suggest_experience_bullets",
    label: "Suggest bullets from modules",
    area: "apprentice",
    description:
      "Draft experience bullet points from completed and in-progress portal modules.",
  },
  "cv.suggest_skills": {
    key: "cv.suggest_skills",
    label: "Suggest CV skills",
    area: "apprentice",
    description: "Suggest skills from programme and workplace context.",
  },
  "cv.tailor_to_job": {
    key: "cv.tailor_to_job",
    label: "Tailor CV to job",
    area: "apprentice",
    description: "Rewrite CV sections to better match a pasted job description.",
  },
  "cv.improve_education": {
    key: "cv.improve_education",
    label: "Improve CV education detail",
    area: "apprentice",
    description:
      "Rewrite education detail using programme progress and completed module titles.",
  },
  "chat.draft_reply": {
    key: "chat.draft_reply",
    label: "Draft chat reply",
    area: "shared",
    description: "Suggest a draft reply in portal messaging.",
  },
  "support.suggest_response": {
    key: "support.suggest_response",
    label: "Support response hint",
    area: "staff",
    description: "Suggest a staff support reply (never auto-send).",
  },
  "learning.explain": {
    key: "learning.explain",
    label: "Explain learning topic",
    area: "apprentice",
    description: "Explain a module or topic in simpler language.",
  },
};

export function getAiFeature(key: AiFeatureKey): AiFeatureMeta {
  return AI_FEATURES[key];
}
