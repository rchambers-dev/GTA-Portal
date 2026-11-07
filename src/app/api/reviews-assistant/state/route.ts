import { NextResponse } from "next/server";
import {
  preserveOfficeDocument,
  rejectOutdatedBuild,
  requireReviewActor,
  reviewPageDenied,
} from "@/features/review-assistant/source-runtime";
import {
  getReviewRepository,
  ReviewStoreNotConfigured,
} from "@/features/review-assistant/repository";
import type { ReviewState } from "@/features/review-assistant/state-store";
import { versionOf } from "@/features/review-assistant/version-rules";

export const runtime = "nodejs";

async function officeOrResponse() {
  const actor = await requireReviewActor();
  if ("error" in actor) return actor.error;
  if (actor.access !== "office") {
    return NextResponse.json(
      { error: "Access denied. Tutors must use the tutor review path." },
      { status: 403 },
    );
  }
  return actor.session;
}

export async function GET() {
  const session = await officeOrResponse();
  if (session instanceof NextResponse) return session;
  const denied = reviewPageDenied(session, "/api/reviews-assistant/state", "read");
  if (denied) return denied;
  try {
    return NextResponse.json({ state: await getReviewRepository().readDocument() });
  } catch (error) {
    if (error instanceof ReviewStoreNotConfigured) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await officeOrResponse();
  if (session instanceof NextResponse) return session;
  const denied = reviewPageDenied(session, "/api/reviews-assistant/state", "edit");
  if (denied) return denied;
  const body = (await request.json()) as ReviewState;
  const outdated = await rejectOutdatedBuild(body.appBuild);
  if (outdated) return outdated;
  delete body.appBuild;
  try {
    const repo = getReviewRepository();
    const stored = await repo.readDocument();
    const expected = Number(body.version) || 1;
    if (expected !== versionOf(stored)) {
      const conflict = await repo.saveDocument(body, expected, session.account.id);
      return NextResponse.json(conflict.body, { status: conflict.status });
    }
    await preserveOfficeDocument(body, stored);
    const result = await repo.saveDocument(body, expected, session.account.id);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof ReviewStoreNotConfigured) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}

export const PUT = POST;
