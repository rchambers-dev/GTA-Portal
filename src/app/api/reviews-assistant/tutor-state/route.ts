import { NextResponse } from "next/server";
import {
  rejectOutdatedBuild,
  requireReviewActor,
  tutorNameKey,
} from "@/features/review-assistant/source-runtime";
import { readReviewState, saveReviewState, type ReviewState } from "@/features/review-assistant/state-store";
import { filterStateForTutor, mergeTutorReviewUpdates } from "@/features/review-assistant/tutor-caseload";
import { conflictBody, sameSavedContent, versionOf } from "@/features/review-assistant/version-rules";

export const runtime = "nodejs";

async function tutorOrResponse() {
  const actor = await requireReviewActor();
  if ("error" in actor) return actor.error;
  if (actor.access !== "tutor") {
    return NextResponse.json({ error: "Access denied. Tutor role required." }, { status: 403 });
  }
  return actor.session;
}

export async function GET() {
  const session = await tutorOrResponse();
  if (session instanceof NextResponse) return session;
  const keyOf = await tutorNameKey();
  return NextResponse.json({
    state: filterStateForTutor(readReviewState(), keyOf(session.account.name), keyOf),
  });
}

export async function POST(request: Request) {
  const session = await tutorOrResponse();
  if (session instanceof NextResponse) return session;
  const updates = (await request.json()) as ReviewState;
  const outdated = await rejectOutdatedBuild(updates.appBuild);
  if (outdated) return outdated;
  delete updates.appBuild;
  const keyOf = await tutorNameKey();
  const tutorKey = keyOf(session.account.name);
  const stored = readReviewState();
  const storedVersion = versionOf(stored);
  const clientVersion = Number(updates.version) || 1;
  if (clientVersion !== storedVersion) {
    return NextResponse.json(
      conflictBody(clientVersion, storedVersion, filterStateForTutor(stored, tutorKey, keyOf)),
      { status: 409 },
    );
  }
  let merged: ReviewState;
  try {
    merged = mergeTutorReviewUpdates(stored, updates, tutorKey, keyOf);
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return NextResponse.json(
      { error: status === 400 ? (error as Error).message : "An error occurred." },
      { status },
    );
  }
  if (sameSavedContent(merged, stored)) {
    return NextResponse.json({
      state: filterStateForTutor(stored, tutorKey, keyOf),
      version: storedVersion,
      savedAt: stored.savedAt || "",
      unchanged: true,
    });
  }
  merged.version = storedVersion;
  const saved = saveReviewState(merged, storedVersion);
  if (saved.status === 409) {
    return NextResponse.json(
      conflictBody(clientVersion, versionOf(readReviewState()), filterStateForTutor(readReviewState(), tutorKey, keyOf)),
      { status: 409 },
    );
  }
  const next = readReviewState();
  return NextResponse.json({
    state: filterStateForTutor(next, tutorKey, keyOf),
    version: saved.body.version,
    savedAt: "savedAt" in saved.body ? saved.body.savedAt : next.savedAt,
  });
}
