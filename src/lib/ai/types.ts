/**
 * Shared portal AI — one client, one usage trail, many features.
 *
 * Features (CV builder, chat assist, etc.) call `runAi` with a feature key.
 * Provider + API key live here; never in feature screens.
 */

export type AiFeatureKey =
  | "cv.improve_summary"
  | "cv.improve_bullets"
  | "cv.suggest_experience_bullets"
  | "cv.suggest_skills"
  | "cv.tailor_to_job"
  | "cv.improve_education"
  | "chat.draft_reply"
  | "support.suggest_response"
  | "learning.explain"
  | "programme.recommend_ksb_intent";

export type AiFeatureMeta = {
  key: AiFeatureKey;
  label: string;
  /** Workspace / product area for usage reporting. */
  area: "apprentice" | "staff" | "employer" | "shared";
  description: string;
};

export type AiUsageEvent = {
  id: string;
  feature: AiFeatureKey;
  area: AiFeatureMeta["area"];
  accountId: string;
  workspace: string;
  createdAt: string;
  /** Prompt / completion token estimates when the provider returns them. */
  inputTokens?: number;
  outputTokens?: number;
  /** Wall time for the call. */
  durationMs: number;
  status: "ok" | "error" | "unavailable";
  errorMessage?: string;
  /** Scopes that reached the model (container allowlist). */
  acceptedScopes?: string[];
  /** Scopes the caller attempted but the container stripped. */
  strippedScopes?: string[];
};

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiRunRequest = {
  feature: AiFeatureKey;
  messages: AiMessage[];
  accountId: string;
  workspace: string;
  /** Optional temperature override (provider may ignore). */
  temperature?: number;
  maxTokens?: number;
};

export type AiRunResult = {
  text: string;
  usage: AiUsageEvent;
};

export type AiProvider = {
  readonly id: string;
  isConfigured(): boolean;
  complete(input: {
    messages: AiMessage[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    text: string;
    inputTokens?: number;
    outputTokens?: number;
  }>;
};
