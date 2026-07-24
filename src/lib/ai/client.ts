import { getAiConfig } from "./config";
import { getAiFeature } from "./features";
import {
  createAnthropicProvider,
  createOpenAiProvider,
  stubAiProvider,
} from "./provider";
import { packAiSandbox, type AiSandboxedRequest } from "./sandbox";
import type { AiProvider, AiRunRequest, AiRunResult, AiUsageEvent } from "./types";
import { countAiUsageToday, recordAiUsage } from "./usage";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function resolveAiProvider(): AiProvider {
  const cfg = getAiConfig();
  if (!cfg.apiKey) return stubAiProvider;
  if (cfg.provider === "anthropic") {
    return createAnthropicProvider({ apiKey: cfg.apiKey, model: cfg.model });
  }
  if (cfg.provider === "openai") {
    return createOpenAiProvider({
      apiKey: cfg.apiKey,
      model: cfg.model,
      baseUrl: process.env.AI_BASE_URL,
    });
  }
  return stubAiProvider;
}

async function executeAi(
  request: AiRunRequest,
  provider: AiProvider,
  extras?: {
    acceptedScopes?: string[];
    strippedScopes?: string[];
  },
): Promise<AiRunResult> {
  const meta = getAiFeature(request.feature);
  const cfg = getAiConfig();
  const started = Date.now();

  const baseEvent = {
    id: newId(),
    feature: request.feature,
    area: meta.area,
    accountId: request.accountId,
    workspace: request.workspace,
    createdAt: new Date().toISOString(),
    acceptedScopes: extras?.acceptedScopes,
    strippedScopes: extras?.strippedScopes,
  };

  if (!provider.isConfigured()) {
    const usage: AiUsageEvent = {
      ...baseEvent,
      durationMs: Date.now() - started,
      status: "unavailable",
      errorMessage: "AI provider is not configured.",
    };
    recordAiUsage(usage);
    throw new Error(
      "AI is not configured yet. Add AI_API_KEY in .env.local when you are ready.",
    );
  }

  if (cfg.dailyRequestCap > 0) {
    const used = countAiUsageToday(request.accountId);
    if (used >= cfg.dailyRequestCap) {
      const usage: AiUsageEvent = {
        ...baseEvent,
        durationMs: Date.now() - started,
        status: "error",
        errorMessage: `Daily AI request cap reached (${cfg.dailyRequestCap}).`,
      };
      recordAiUsage(usage);
      throw new Error(
        `Daily AI limit reached (${cfg.dailyRequestCap} requests). Try again tomorrow.`,
      );
    }
  }

  try {
    const result = await provider.complete({
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });

    const usage: AiUsageEvent = {
      ...baseEvent,
      durationMs: Date.now() - started,
      status: "ok",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
    recordAiUsage(usage);

    return { text: result.text, usage };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error";
    const usage: AiUsageEvent = {
      ...baseEvent,
      durationMs: Date.now() - started,
      status: "error",
      errorMessage: message,
    };
    recordAiUsage(usage);
    throw err instanceof Error ? err : new Error(message);
  }
}

/**
 * Preferred entry point — runs inside the feature's access container.
 * Only allowlisted scopes/actions reach the model.
 */
export async function runAiSandboxed(
  request: AiSandboxedRequest,
  provider: AiProvider = resolveAiProvider(),
): Promise<AiRunResult & { acceptedScopes: string[]; strippedScopes: string[] }> {
  let packed;
  try {
    packed = packAiSandbox(request);
  } catch (err) {
    const meta = getAiFeature(request.feature);
    recordAiUsage({
      id: newId(),
      feature: request.feature,
      area: meta.area,
      accountId: request.accountId,
      workspace: request.workspace,
      createdAt: new Date().toISOString(),
      durationMs: 0,
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Access denied",
    });
    throw err;
  }

  const result = await executeAi(
    {
      feature: request.feature,
      messages: packed.messages,
      accountId: request.accountId,
      workspace: request.workspace,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    },
    provider,
    {
      acceptedScopes: packed.acceptedScopes,
      strippedScopes: packed.strippedScopes,
    },
  );

  return {
    ...result,
    acceptedScopes: packed.acceptedScopes,
    strippedScopes: packed.strippedScopes,
  };
}

/**
 * Low-level entry — only for trusted server code that already built
 * container-safe messages. Prefer `runAiSandboxed` from API / features.
 */
export async function runAi(
  request: AiRunRequest,
  provider: AiProvider = resolveAiProvider(),
): Promise<AiRunResult> {
  return executeAi(request, provider);
}
