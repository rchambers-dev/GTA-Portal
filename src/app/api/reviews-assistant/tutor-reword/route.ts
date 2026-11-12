import { NextResponse } from "next/server";
import { requireReviewActor, reviewPageDenied } from "@/features/review-assistant/source-runtime";

export const runtime = "nodejs";

const MAX_INPUT_LENGTH = 5000;

/**
 * Review wording stays hard off. The applied rate_limit_hit function deletes
 * every bucket older than two hours, so a day cap cannot be enforced with it.
 * A generic AI key and REVIEW_ASSISTANT_AI must not start a model call.
 */
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
  return NextResponse.json(
    {
      error:
        "AI wording is disabled. The applied rate limit only keeps two hours of buckets, so a day cap is not in force.",
    },
    { status: 503 },
  );
}
