/**
 * AI configuration from environment.
 * Set keys in `.env.local` (never commit). See `.env.example`.
 */

export type AiConfig = {
  provider: "stub" | "openai" | "anthropic";
  apiKey: string | null;
  model: string;
  /** Soft daily cap per account for demo / cost control (0 = unlimited). */
  dailyRequestCap: number;
};

export function getAiConfig(): AiConfig {
  const providerRaw = (process.env.AI_PROVIDER ?? "stub").toLowerCase();
  const provider =
    providerRaw === "openai" || providerRaw === "anthropic" ? providerRaw : "stub";

  const apiKey =
    process.env.AI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim() ||
    null;

  const dailyRaw = Number(process.env.AI_DAILY_REQUEST_CAP ?? "50");
  const dailyRequestCap = Number.isFinite(dailyRaw) && dailyRaw >= 0 ? dailyRaw : 50;

  return {
    provider: apiKey && provider !== "stub" ? provider : apiKey ? "openai" : "stub",
    apiKey,
    model: process.env.AI_MODEL?.trim() || defaultModel(provider, Boolean(apiKey)),
    dailyRequestCap,
  };
}

function defaultModel(
  provider: AiConfig["provider"],
  hasKey: boolean,
): string {
  if (!hasKey || provider === "stub") return "stub";
  if (provider === "anthropic") return "claude-sonnet-4-20250514";
  return "gpt-4o-mini";
}

export function isAiConfigured(): boolean {
  const cfg = getAiConfig();
  return Boolean(cfg.apiKey) && cfg.provider !== "stub";
}
