import { NextResponse } from "next/server";
import {
  parseAiJson,
  recommendLearningIntentHeuristic,
  type IntentRecommendContext,
} from "@/features/programme-definition/domain/ksb-intent-recommender";
import type { ImportedKsb, SpineItem } from "@/features/programme-definition/domain/types";
import { isAiConfigured, runAi } from "@/lib/ai";

export const runtime = "nodejs";

type Body = {
  ksbCode?: string;
  ksbType?: string;
  ksbDescription?: string;
  blockId?: string;
  blockTitle?: string;
  blockSequence?: number;
  hasPrimaryElsewhere?: boolean;
  primaryBlockTitle?: string | null;
  priorMappings?: Array<{
    blockId: string;
    intent: string;
    isPrimary: boolean;
    blockTitle: string;
    sequence: number;
  }>;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const ksb: ImportedKsb = {
    code: (body.ksbCode || "").toUpperCase(),
    type: (body.ksbType as ImportedKsb["type"]) || "knowledge",
    description: body.ksbDescription || "",
  };
  const block: SpineItem = {
    id: body.blockId || crypto.randomUUID(),
    itemType: "block",
    gatewayType: null,
    title: body.blockTitle || "Block",
    sequence: body.blockSequence ?? 1,
    plannedWeeks: null,
    plannedOtjHours: 0,
    countsTowardsLearningHours: true,
    metadata: {},
  };

  const prior = body.priorMappings || [];
  const ctx: IntentRecommendContext = {
    ksb,
    block,
    spineItems: prior.map((p) => ({
      id: p.blockId,
      itemType: "block" as const,
      gatewayType: null,
      title: p.blockTitle,
      sequence: p.sequence,
      plannedWeeks: null,
      plannedOtjHours: 0,
      countsTowardsLearningHours: true,
      metadata: {},
    })),
    existingMappings: prior.map((p) => ({
      id: crypto.randomUUID(),
      blockId: p.blockId,
      ksbCode: ksb.code,
      isPrimary: p.isPrimary,
      learningIntent: p.intent as IntentRecommendContext["existingMappings"][0]["learningIntent"],
      mappingSource: "manual" as const,
      recommendationProvider: null,
      recommendationFeature: null,
      recommendedIntent: null,
      recommendationAccepted: null,
      confidence: null,
      aiReasonSummary: null,
      createdBy: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    hasPrimaryElsewhere: Boolean(body.hasPrimaryElsewhere),
    primaryBlockTitle: body.primaryBlockTitle,
  };

  const heuristic = recommendLearningIntentHeuristic(ctx);

  if (!isAiConfigured() || !ksb.code) {
    return NextResponse.json({ ok: true, recommendation: heuristic });
  }

  try {
    const prompt = [
      "You recommend ONE LearningIntent for mapping a KSB onto a curriculum block.",
      "Allowed intents: introduce, practise, apply, reinforce, consolidate, assess.",
      "Return JSON only: {\"intent\":\"apply\",\"confidence\":0.91,\"reasonSummary\":\"...\"}",
      "Staff remains the authority — this is a suggestion only.",
      `KSB: ${ksb.code} (${ksb.type}) — ${ksb.description}`,
      `Current block: #${block.sequence} “${block.title}”`,
      `Already has primary elsewhere: ${ctx.hasPrimaryElsewhere}`,
      ctx.primaryBlockTitle
        ? `Primary block title: ${ctx.primaryBlockTitle}`
        : "No primary yet.",
      `Prior mappings: ${JSON.stringify(prior)}`,
      "Do not hard-code INTRODUCE; use context. Prefer pedagogical progression as a hint only.",
    ].join("\n");

    const result = await runAi({
      feature: "programme.recommend_ksb_intent",
      accountId: "programme-builder",
      workspace: "management",
      temperature: 0.2,
      maxTokens: 400,
      messages: [
        {
          role: "system",
          content:
            "You are a curriculum design assistant for UK apprenticeship programmes.",
        },
        { role: "user", content: prompt },
      ],
    });

    const parsed = parseAiJson(result.text);
    if (parsed) {
      return NextResponse.json({ ok: true, recommendation: parsed });
    }
  } catch {
    /* fall back */
  }

  return NextResponse.json({ ok: true, recommendation: heuristic });
}
