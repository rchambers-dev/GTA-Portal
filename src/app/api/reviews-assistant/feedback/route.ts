import { NextResponse } from "next/server";
import { addTutorFeedback, listTutorFeedback } from "@/features/review-assistant/feedback";
import { getReviewRepository } from "@/features/review-assistant/repository";
import { requireReviewActor, reviewPageDenied } from "@/features/review-assistant/source-runtime";

export const runtime = "nodejs";

export async function GET() {
  const actor = await requireReviewActor();
  if ("error" in actor) return actor.error;
  const denied = reviewPageDenied(actor.session, "/api/reviews-assistant/feedback", "read");
  if (denied) return denied;
  if (actor.access !== "office") {
    return NextResponse.json(
      { error: "Access denied. Admin or office role required." },
      { status: 403 },
    );
  }
  return NextResponse.json({ items: listTutorFeedback(await getReviewRepository().readDocument()) });
}

export async function POST(request: Request) {
  const actor = await requireReviewActor();
  if ("error" in actor) return actor.error;
  const denied = reviewPageDenied(actor.session, "/api/reviews-assistant/feedback", "edit");
  if (denied) return denied;
  const body = (await request.json()) as { message?: unknown; email?: string };
  const email = actor.session.account.email || "";
  if (body.email && body.email !== email) {
    return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
  }
  try {
    const items = addTutorFeedback({ message: body.message, email });
    if (actor.access === "office") return NextResponse.json({ items });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json(
      {
        error:
          status === 400 || status === 409
            ? (error as Error).message
            : "An error occurred.",
      },
      { status },
    );
  }
}
