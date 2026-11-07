import { NextResponse } from "next/server";
import { readAttachmentBinding, readReviewAttachment, saveReviewAttachment } from "@/features/review-assistant/attachments";
import { readReviewState } from "@/features/review-assistant/state-store";
import { requireReviewActor, reviewPageDenied, tutorNameKey } from "@/features/review-assistant/source-runtime";
import { learnerAssignedToTutor, tutorMayReadAttachment } from "@/features/review-assistant/tutor-caseload";

export const runtime = "nodejs";

function statusError(error: unknown) {
  const status = (error as { status?: number }).status || 500;
  const message =
    status === 400 || status === 404
      ? (error as Error).message
      : "An error occurred.";
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const actor = await requireReviewActor();
  if ("error" in actor) return actor.error;
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Missing attachment id." }, { status: 400 });
  const denied = reviewPageDenied(actor.session, "/api/reviews-assistant/review-attachment", "read");
  if (denied) return denied;
  const binding = readAttachmentBinding(id);
  if (actor.access === "tutor") {
    const keyOf = await tutorNameKey();
    const allowed = tutorMayReadAttachment(
      readReviewState(),
      keyOf(actor.session.account.name),
      id,
      keyOf,
      binding,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Access denied. You can only access attachments for learners assigned to you." },
        { status: 403 },
      );
    }
  }
  try {
    const stored = readReviewAttachment(id);
    const filename = String(url.searchParams.get("name") || id)
      .replace(/[<>:"/\\|?*]+/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 80);
    return new NextResponse(new Uint8Array(stored.bytes), {
      headers: {
        "content-type": stored.type,
        "content-disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
      },
    });
  } catch (error) {
    return statusError(error);
  }
}

export async function POST(request: Request) {
  const actor = await requireReviewActor();
  if ("error" in actor) return actor.error;
  const denied = reviewPageDenied(actor.session, "/api/reviews-assistant/review-attachment", "edit");
  if (denied) return denied;
  const url = new URL(request.url);
  const learnerId = String(url.searchParams.get("learner") || "").trim();
  if (!learnerId) {
    return NextResponse.json({ error: "Attachment must be bound to a learner." }, { status: 400 });
  }
  if (actor.access === "tutor") {
    const keyOf = await tutorNameKey();
    const allowed = learnerAssignedToTutor(
      readReviewState(),
      keyOf(actor.session.account.name),
      learnerId,
      keyOf,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Access denied. You can only upload reviews for learners assigned to you." },
        { status: 403 },
      );
    }
  }
  try {
    const filename = String(url.searchParams.get("name") || request.headers.get("x-filename") || "review.pdf");
    const type = String(request.headers.get("content-type") || "application/pdf");
    const bytes = Buffer.from(await request.arrayBuffer());
    const attachment = saveReviewAttachment({
      filename,
      type,
      bytes,
      actorId: actor.session.account.id,
      learnerId,
    });
    return NextResponse.json({ attachment });
  } catch (error) {
    return statusError(error);
  }
}
