import { NextResponse } from "next/server";
import {
  rejectOutdatedBuild,
  requireReviewActor,
  reviewPageDenied,
  tutorNameKey,
} from "@/features/review-assistant/source-runtime";
import type { ReviewState } from "@/features/review-assistant/state-store";
import { getReviewRepository } from "@/features/review-assistant/repository";
import { filterStateForTutor, mergeTutorReviewUpdates } from "@/features/review-assistant/tutor-caseload";
import { reviewLearnerIdError } from "@/features/review-assistant/portal-roster";
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
  const denied = reviewPageDenied(session, "/api/reviews-assistant/tutor-state", "read");
  if (denied) return denied;
  const keyOf = await tutorNameKey();
  const stored = await getReviewRepository().readDocument();
  return NextResponse.json({
    state: filterStateForTutor(stored, keyOf(session.account.name), keyOf),
  });
}

export async function POST(request: Request) {
  const session = await tutorOrResponse();
  if (session instanceof NextResponse) return session;
  const denied = reviewPageDenied(session, "/api/reviews-assistant/tutor-state", "edit");
  if (denied) return denied;
  const updates = (await request.json()) as ReviewState;
  const outdated = await rejectOutdatedBuild(updates.appBuild);
  if (outdated) return outdated;
  delete updates.appBuild;
  const keyOf = await tutorNameKey();
  const tutorKey = keyOf(session.account.name);
  const repo = getReviewRepository();
  const stored = await repo.readDocument();
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
    merged = await mergeTutorReviewUpdates(stored, updates, tutorKey, keyOf, async (id, learnerId) => {
      return getReviewRepository()
        .attachmentBinding(id)
        .then((binding) =>
          Boolean(binding && binding.learnerId === learnerId && binding.actorId === session.account.id),
        );
    });
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return NextResponse.json(
      { error: status === 400 ? (error as Error).message : "An error occurred." },
      { status },
    );
  }
  const learnerError = await reviewLearnerIdError(session, merged);
  if (learnerError) return NextResponse.json({ error: learnerError }, { status: 400 });
  if (sameSavedContent(merged, stored)) {
    return NextResponse.json({
      state: filterStateForTutor(stored, tutorKey, keyOf),
      version: storedVersion,
      savedAt: stored.savedAt || "",
      unchanged: true,
    });
  }
  merged.version = storedVersion;
  const saved = await repo.saveDocument(merged, storedVersion, session.account.id);
  if (saved.status === 409) {
    const latest = await repo.readDocument();
    return NextResponse.json(
      conflictBody(clientVersion, versionOf(latest), filterStateForTutor(latest, tutorKey, keyOf)),
      { status: 409 },
    );
  }
  const next = await repo.readDocument();
  return NextResponse.json({
    state: filterStateForTutor(next, tutorKey, keyOf),
    version: saved.body.version,
    savedAt: "savedAt" in saved.body ? saved.body.savedAt : next.savedAt,
  });
}
