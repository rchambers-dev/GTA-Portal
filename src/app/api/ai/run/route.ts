import { NextResponse } from "next/server";
import { z } from "zod";
import { getStandalonePorts } from "@/adapters/standalone";
import {
  AiAccessDeniedError,
  countAiUsageToday,
  getAiConfig,
  isAiConfigured,
  runAiSandboxed,
  summariseAiUsage,
  type AiFeatureKey,
} from "@/lib/ai";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

const AI_FEATURE_KEYS = [
  "cv.improve_summary",
  "cv.improve_bullets",
  "cv.suggest_experience_bullets",
  "cv.suggest_skills",
  "cv.tailor_to_job",
  "cv.improve_education",
  "chat.draft_reply",
  "support.suggest_response",
  "learning.explain",
  "programme.recommend_ksb_intent",
] as const satisfies readonly AiFeatureKey[];

const AI_ACTIONS = [
  "text.rewrite",
  "text.suggest",
  "text.explain",
  "cv.apply_suggestion",
] as const;

const AI_SCOPES = [
  "cv.draft",
  "cv.job_description",
  "apprentice.profile_public",
  "apprentice.programme_public",
  "apprentice.modules_public",
  "module.published_content",
  "chat.thread_current",
  "support.ticket_summary",
] as const;

const bodySchema = z.object({
  feature: z.enum(AI_FEATURE_KEYS),
  action: z.enum(AI_ACTIONS),
  context: z
    .array(
      z.object({
        scope: z.enum(AI_SCOPES),
        data: z.unknown(),
      }),
    )
    .max(12)
    .optional(),
  userText: z.string().max(8_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(64).max(4000).optional(),
});

/**
 * Shared portal AI endpoint.
 * Requests are packed through the feature access container before the model sees them.
 */
export async function POST(request: Request) {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.AI_USE)) {
    return NextResponse.json({ error: "AI is not enabled for this account." }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error: "AI is not configured yet.",
        code: "AI_NOT_CONFIGURED",
        hint: "Set AI_API_KEY and AI_PROVIDER in .env.local.",
      },
      { status: 503 },
    );
  }

  try {
    const result = await runAiSandboxed({
      feature: parsed.data.feature,
      action: parsed.data.action,
      context: parsed.data.context,
      userText: parsed.data.userText,
      accountId: session.account.id,
      workspace: session.account.workspace,
      temperature: parsed.data.temperature,
      maxTokens: parsed.data.maxTokens,
    });

    return NextResponse.json({
      text: result.text,
      acceptedScopes: result.acceptedScopes,
      strippedScopes: result.strippedScopes,
      usage: {
        id: result.usage.id,
        feature: result.usage.feature,
        area: result.usage.area,
        durationMs: result.usage.durationMs,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        acceptedScopes: result.acceptedScopes,
        strippedScopes: result.strippedScopes,
      },
    });
  } catch (err) {
    if (err instanceof AiAccessDeniedError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 403 },
      );
    }
    const message = err instanceof Error ? err.message : "AI request failed.";
    const status = /daily/i.test(message) ? 429 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET() {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const cfg = getAiConfig();
  const usedToday = countAiUsageToday(session.account.id);

  return NextResponse.json({
    configured: isAiConfigured(),
    provider: cfg.provider,
    model: cfg.model,
    canUse: hasPermission(session, PERMISSIONS.AI_USE),
    dailyRequestCap: cfg.dailyRequestCap,
    usedToday,
    remainingToday:
      cfg.dailyRequestCap > 0
        ? Math.max(0, cfg.dailyRequestCap - usedToday)
        : null,
    summary: summariseAiUsage(session.account.id),
  });
}
