import { NextResponse } from "next/server";
import {
  preserveOfficeDocument,
  rejectOutdatedBuild,
  requireReviewActor,
} from "@/features/review-assistant/source-runtime";
import { readReviewState, saveReviewState, type ReviewState } from "@/features/review-assistant/state-store";
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
  return NextResponse.json({ state: readReviewState() });
}

export async function POST(request: Request) {
  const session = await officeOrResponse();
  if (session instanceof NextResponse) return session;
  const body = (await request.json()) as ReviewState;
  const outdated = await rejectOutdatedBuild(body.appBuild);
  if (outdated) return outdated;
  delete body.appBuild;
  const stored = readReviewState();
  const expected = Number(body.version) || 1;
  if (expected !== versionOf(stored)) {
    const conflict = saveReviewState(body, expected);
    return NextResponse.json(conflict.body, { status: conflict.status });
  }
  await preserveOfficeDocument(body, stored);
  const result = saveReviewState(body, expected);
  return NextResponse.json(result.body, { status: result.status });
}

export const PUT = POST;
