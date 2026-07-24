import type { AiAction, AiDataScope } from "./access-container";
import type { AiFeatureKey, AiUsageEvent } from "./types";

export type PortalAiClientResult = {
  text: string;
  usage: Pick<
    AiUsageEvent,
    | "id"
    | "feature"
    | "area"
    | "durationMs"
    | "inputTokens"
    | "outputTokens"
    | "acceptedScopes"
    | "strippedScopes"
  >;
  acceptedScopes: string[];
  strippedScopes: string[];
};

export type PortalAiStatus = {
  configured: boolean;
  provider: string;
  model: string;
  canUse: boolean;
  dailyRequestCap: number;
  usedToday: number;
  remainingToday: number | null;
  summary: {
    total: number;
    byFeature: Record<string, number>;
    byArea: Record<string, number>;
  };
};

export type PortalAiContextBag = {
  scope: AiDataScope;
  data: unknown;
};

/**
 * Browser helper — features call this with scoped context only.
 * The server packs the access container before anything reaches the model.
 */
export async function requestPortalAi(input: {
  feature: AiFeatureKey;
  action: AiAction;
  context?: PortalAiContextBag[];
  userText?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<PortalAiClientResult> {
  const res = await fetch("/api/ai/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = (await res.json().catch(() => ({}))) as {
    text?: string;
    usage?: PortalAiClientResult["usage"];
    acceptedScopes?: string[];
    strippedScopes?: string[];
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    const err = new Error(data.error || `AI request failed (${res.status})`);
    (err as Error & { code?: string }).code = data.code;
    throw err;
  }

  if (!data.text || !data.usage) {
    throw new Error("AI response was incomplete.");
  }

  return {
    text: data.text,
    usage: data.usage,
    acceptedScopes: data.acceptedScopes ?? data.usage.acceptedScopes ?? [],
    strippedScopes: data.strippedScopes ?? data.usage.strippedScopes ?? [],
  };
}

export async function getPortalAiStatus(): Promise<PortalAiStatus> {
  const res = await fetch("/api/ai/run", { method: "GET" });
  if (!res.ok) {
    throw new Error("Could not load AI status.");
  }
  return (await res.json()) as PortalAiStatus;
}
