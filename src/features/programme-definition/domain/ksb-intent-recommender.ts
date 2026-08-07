/**
 * LearningIntent recommender — AI suggests; staff decides.
 * Heuristic fallback keeps assign flow usable when AI is unavailable.
 */

import type {
  BlockKsbMapping,
  ImportedKsb,
  LearningIntent,
  SpineItem,
} from "./types";
import { LEARNING_INTENTS, LEARNING_INTENT_LABELS } from "./types";

export type IntentRecommendContext = {
  ksb: ImportedKsb;
  block: SpineItem;
  spineItems: SpineItem[];
  existingMappings: BlockKsbMapping[];
  hasPrimaryElsewhere: boolean;
  primaryBlockTitle?: string | null;
};

export type IntentRecommendation = {
  intent: LearningIntent;
  confidence: number;
  reasonSummary: string;
  source: "ai" | "heuristic";
};

function blockLooksLike(title: string, words: string[]): boolean {
  const t = title.toLowerCase();
  return words.some((w) => t.includes(w));
}

/** Deterministic fallback used when AI is offline / fails. */
export function recommendLearningIntentHeuristic(
  ctx: IntentRecommendContext,
): IntentRecommendation {
  const prior = ctx.existingMappings
    .filter((m) => m.ksbCode.toUpperCase() === ctx.ksb.code.toUpperCase())
    .slice()
    .sort((a, b) => {
      const sa =
        ctx.spineItems.find((i) => i.id === a.blockId)?.sequence ?? 999;
      const sb =
        ctx.spineItems.find((i) => i.id === b.blockId)?.sequence ?? 999;
      return sa - sb;
    });

  const title = ctx.block.title || "";
  const priorIntents = new Set(prior.map((m) => m.learningIntent));

  if (
    blockLooksLike(title, ["assess", "gateway", "epa", "exam", "test"])
  ) {
    return {
      intent: "assess",
      confidence: 0.72,
      reasonSummary: `Recommended ASSESS because block “${title}” looks assessment-focused.`,
      source: "heuristic",
    };
  }

  if (!ctx.hasPrimaryElsewhere && prior.length === 0) {
    return {
      intent: "introduce",
      confidence: 0.8,
      reasonSummary: `${ctx.ksb.code} has no earlier block mapping — INTRODUCE is the usual first teaching intent.`,
      source: "heuristic",
    };
  }

  if (priorIntents.has("introduce") && !priorIntents.has("practise")) {
    return {
      intent: "practise",
      confidence: 0.74,
      reasonSummary: `${ctx.ksb.code} was INTRODUCEd earlier${ctx.primaryBlockTitle ? ` (primary in ${ctx.primaryBlockTitle})` : ""} — PRACTISE is a common next step.`,
      source: "heuristic",
    };
  }

  if (
    priorIntents.has("practise") ||
    priorIntents.has("apply") ||
    blockLooksLike(title, ["diagnos", "practical", "workshop", "independent"])
  ) {
    return {
      intent: "apply",
      confidence: 0.7,
      reasonSummary: `${ctx.ksb.code} already appears earlier — APPLY fits a realistic / independent use in “${title}”.`,
      source: "heuristic",
    };
  }

  if (blockLooksLike(title, ["revis", "recap", "consolidat", "fluenc"])) {
    return {
      intent: "consolidate",
      confidence: 0.68,
      reasonSummary: `Block “${title}” suggests consolidation of prior learning for ${ctx.ksb.code}.`,
      source: "heuristic",
    };
  }

  return {
    intent: "reinforce",
    confidence: 0.62,
    reasonSummary: `${ctx.ksb.code} already has a primary elsewhere — REINFORCE is a safe revisiting intent for “${title}”.`,
    source: "heuristic",
  };
}

function parseAiJson(text: string): IntentRecommendation | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const raw = JSON.parse(text.slice(start, end + 1)) as {
      intent?: string;
      confidence?: number;
      reasonSummary?: string;
    };
    const intent = String(raw.intent || "")
      .toLowerCase()
      .trim() as LearningIntent;
    if (!LEARNING_INTENTS.includes(intent)) return null;
    const confidence = Math.min(
      1,
      Math.max(0, Number(raw.confidence) || 0.5),
    );
    return {
      intent,
      confidence,
      reasonSummary:
        String(raw.reasonSummary || "").trim() ||
        `Recommended ${LEARNING_INTENT_LABELS[intent]}.`,
      source: "ai",
    };
  } catch {
    return null;
  }
}

/**
 * Client-side recommender: tries management AI endpoint, else heuristic.
 */
export async function recommendLearningIntent(
  ctx: IntentRecommendContext,
): Promise<IntentRecommendation> {
  const fallback = recommendLearningIntentHeuristic(ctx);
  try {
    const res = await fetch(
      "/api/management/programme-definition/recommend-intent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ksbCode: ctx.ksb.code,
          ksbType: ctx.ksb.type,
          ksbDescription: ctx.ksb.description,
          blockId: ctx.block.id,
          blockTitle: ctx.block.title,
          blockSequence: ctx.block.sequence,
          hasPrimaryElsewhere: ctx.hasPrimaryElsewhere,
          primaryBlockTitle: ctx.primaryBlockTitle ?? null,
          priorMappings: ctx.existingMappings
            .filter(
              (m) => m.ksbCode.toUpperCase() === ctx.ksb.code.toUpperCase(),
            )
            .map((m) => ({
              blockId: m.blockId,
              intent: m.learningIntent,
              isPrimary: m.isPrimary,
              blockTitle:
                ctx.spineItems.find((i) => i.id === m.blockId)?.title ?? "",
              sequence:
                ctx.spineItems.find((i) => i.id === m.blockId)?.sequence ?? 0,
            })),
        }),
      },
    );
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      ok?: boolean;
      recommendation?: IntentRecommendation;
    };
    if (data.ok && data.recommendation?.intent) {
      return {
        ...data.recommendation,
        intent: data.recommendation.intent,
        confidence: Math.min(1, Math.max(0, data.recommendation.confidence)),
      };
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

export { parseAiJson };
