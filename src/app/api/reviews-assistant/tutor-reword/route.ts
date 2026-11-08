import { NextResponse } from "next/server";
import { resolveAiProvider } from "@/lib/ai/client";
import { getAiConfig } from "@/lib/ai/config";
import { requireReviewActor, reviewPageDenied } from "@/features/review-assistant/source-runtime";

export const runtime = "nodejs";

const MAX_INPUT_LENGTH = 5000;

export async function POST(request: Request) {
  const actor = await requireReviewActor();
  if ("error" in actor) return actor.error;
  const denied = reviewPageDenied(actor.session, "/api/reviews-assistant/tutor-reword", "edit");
  if (denied) return denied;
  const body = (await request.json()) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "Write something in this box first." }, { status: 400 });
  }
  if (text.length > MAX_INPUT_LENGTH) {
    return NextResponse.json(
      { error: `Text too long. Maximum ${MAX_INPUT_LENGTH} characters allowed.` },
      { status: 400 },
    );
  }
  const config = getAiConfig();
  if (!config.apiKey) {
    return NextResponse.json(
      { error: "AI wording is not configured on this server." },
      { status: 500 },
    );
  }
  try {
    const result = await resolveAiProvider().complete({
      messages: [
        {
          role: "system",
          content: "Rewrite the tutor's review wording. Keep the facts. Do not add people, dates, or results that were not written.",
        },
        { role: "user", content: text },
      ],
      temperature: 0.2,
      maxTokens: 800,
    });
    const rewritten = String(result.text || "").trim();
    if (!rewritten) {
      return NextResponse.json({ error: "AI wording is not configured on this server." }, { status: 500 });
    }
    return NextResponse.json({ text: rewritten });
  } catch {
    return NextResponse.json({ error: "AI wording is not configured on this server." }, { status: 500 });
  }
}
