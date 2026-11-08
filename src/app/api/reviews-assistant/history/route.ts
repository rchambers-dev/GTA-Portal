import { NextResponse } from "next/server";
import { requireReviewActor, reviewPageDenied } from "@/features/review-assistant/source-runtime";
import { getReviewRepository, ReviewStoreNotConfigured } from "@/features/review-assistant/repository";
import { reviewLearnerIdError } from "@/features/review-assistant/portal-roster";
import { versionOf } from "@/features/review-assistant/version-rules";

export const runtime = "nodejs";

export async function GET() {
  const actor = await requireReviewActor();
  if ("error" in actor) return actor.error;
  if (actor.access !== "office") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  const denied = reviewPageDenied(actor.session, "/api/reviews-assistant/history", "read");
  if (denied) return denied;
  try {
    const history = await getReviewRepository().documentHistory();
    return NextResponse.json({
      history: history.map((entry) => ({
        version: entry.version,
        savedAt: entry.savedAt,
        actorId: entry.actorId,
      })),
    });
  } catch (error) {
    if (error instanceof ReviewStoreNotConfigured) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const actor = await requireReviewActor();
  if ("error" in actor) return actor.error;
  if (actor.access !== "office") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  const denied = reviewPageDenied(actor.session, "/api/reviews-assistant/history", "edit");
  if (denied) return denied;
  const body = (await request.json()) as { version?: number };
  const version = Number(body.version);
  try {
    const repo = getReviewRepository();
    const history = await repo.documentHistory();
    const entry = history.find((item) => item.version === version);
    if (!entry) return NextResponse.json({ error: "That version was not found." }, { status: 404 });
    const learnerError = await reviewLearnerIdError(actor.session, entry.payload);
    if (learnerError) return NextResponse.json({ error: learnerError }, { status: 400 });
    const stored = await repo.readDocument();
    const result = await repo.saveDocument(entry.payload, versionOf(stored), actor.session.account.id);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof ReviewStoreNotConfigured) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
