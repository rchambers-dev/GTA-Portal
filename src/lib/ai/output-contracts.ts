/**
 * Fixed output contracts for AI features.
 * Injected by the sandbox packer — callers cannot override free-form
 * instructions on locked containers.
 */

import type { AiFeatureKey } from "./types";

export const AI_OUTPUT_CONTRACTS: Partial<Record<AiFeatureKey, string>> = {
  "cv.improve_summary": [
    "Rewrite the professional summary only.",
    "Keep UK English, first person implied (no 'I' overuse), 3–5 sentences.",
    "Do not invent employers, grades, or qualifications.",
    "Return plain text only — no markdown headings, no JSON, no quotes wrapper.",
  ].join(" "),
  "cv.improve_bullets": [
    "Rewrite each experience description as stronger bullet points.",
    "Keep the same experience ids.",
    "One bullet per line inside description (use \\n between bullets).",
    "You may use module titles from apprentice.modules_public to sharpen wording when present.",
    "Do not invent achievements the apprentice did not provide.",
    'Return JSON only: {"experiences":[{"id":"...","description":"..."}]}',
  ].join(" "),
  "cv.suggest_experience_bullets": [
    "Suggest 3–6 short CV experience bullets for the role in the draft.",
    "Ground each bullet in completed or in-progress modules from apprentice.modules_public.",
    "UK English, action-led, one achievement or task per bullet, no leading bullet characters.",
    "Do not invent employers, grades, or work beyond the modules and draft.",
    "Avoid duplicating bullets already in the experience description.",
    'Return JSON only: {"bullets":["..."]}',
  ].join(" "),
  "cv.suggest_skills": [
    "Suggest 6–10 relevant skills based on the CV draft and programme.",
    "Prefer concrete technical and workplace skills.",
    "Merge thoughtfully with existing skills — avoid near-duplicates.",
    'Return JSON only: {"skills":["..."]}',
  ].join(" "),
  "cv.tailor_to_job": [
    "Tailor the CV wording to the job description without inventing experience.",
    "Update summary, skills, and experience bullet descriptions where helpful.",
    "Keep experience ids unchanged.",
    'Return JSON only: {"summary":"...","skills":["..."],"experiences":[{"id":"...","description":"..."}]}',
  ].join(" "),
  "cv.improve_education": [
    "Rewrite education detail text for the CV education entries provided.",
    "Use completed and in-progress module titles from apprentice.modules_public when present.",
    "Write concise UK English suitable for a CV (2–4 short sentences or a short paragraph).",
    "Mention progress (year/week) only if present in programme data.",
    "Do not invent modules, grades, awards, or institutions.",
    "Do not list every module as a raw semicolon dump — group or summarise naturally.",
    "Keep education ids unchanged.",
    'Return JSON only: {"education":[{"id":"...","detail":"..."}]}',
  ].join(" "),
  "chat.draft_reply":
    "Return a short draft reply the user can edit and send. Plain text only.",
  "support.suggest_response":
    "Return a suggested staff reply. Plain text only. Never claim actions have been taken.",
  "learning.explain":
    "Explain the topic simply for an apprentice. Plain text only. Use short paragraphs.",
  "programme.recommend_ksb_intent":
    'Return JSON only: {"intent":"introduce|practise|apply|reinforce|consolidate|assess","confidence":0.0-1.0,"reasonSummary":"..."}. Suggest only; never claim the mapping was saved.',
};

export function getAiOutputContract(feature: AiFeatureKey): string | null {
  return AI_OUTPUT_CONTRACTS[feature] ?? null;
}
