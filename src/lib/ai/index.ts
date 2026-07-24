export { getAiConfig, isAiConfigured } from "./config";
export { AI_FEATURES, getAiFeature } from "./features";
export { runAi, runAiSandboxed, resolveAiProvider } from "./client";
export {
  AI_ACCESS_CONTAINERS,
  AI_GLOBAL_DENY_SCOPES,
  containerAllowsAction,
  containerAllowsScope,
  getAiAccessContainer,
} from "./access-container";
export type { AiAccessContainer, AiAction, AiDataScope, AiDeniedScope } from "./access-container";
export {
  AiAccessDeniedError,
  packAiSandbox,
} from "./sandbox";
export type {
  AiContextBag,
  AiPackedPrompt,
  AiSandboxedRequest,
} from "./sandbox";
export { AI_OUTPUT_CONTRACTS, getAiOutputContract } from "./output-contracts";
export {
  AI_CONSENT_POINTS,
  AI_CONSENT_STORAGE_KEY,
  AI_CONSENT_SUMMARY,
  AI_CONSENT_TITLE,
  AI_CONSENT_VERSION,
  clearAiConsent,
  defaultAiConsent,
  formatConsentDate,
  readAiConsent,
  writeAiConsent,
} from "./consent";
export type { AiConsentRecord } from "./consent";
export {
  countAiUsageToday,
  listAiUsage,
  recordAiUsage,
  summariseAiUsage,
} from "./usage";
export { getPortalAiStatus, requestPortalAi } from "./browser";
export type {
  PortalAiClientResult,
  PortalAiContextBag,
  PortalAiStatus,
} from "./browser";
export type {
  AiFeatureKey,
  AiFeatureMeta,
  AiMessage,
  AiProvider,
  AiRunRequest,
  AiRunResult,
  AiUsageEvent,
} from "./types";
