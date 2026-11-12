import { NextResponse } from "next/server";
import { getReviewRepository } from "@/features/review-assistant/repository";
import { requireReviewActor, reviewPageDenied } from "@/features/review-assistant/source-runtime";
import { learnerAssignedToTutor, tutorMayReadAttachment } from "@/features/review-assistant/tutor-caseload";
import { loadReviewApprentices } from "@/features/review-assistant/portal-roster";

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
  const repo = getReviewRepository();
  const binding = await repo.attachmentBinding(id);
  const allowedIds = new Set((await loadReviewApprentices(actor.session)).map((item) => item.id));
  if (actor.access === "tutor") {
    if (!tutorMayReadAttachment(allowedIds, binding)) {
      return NextResponse.json(
        { error: "Access denied. You can only access attachments for learners assigned to you." },
        { status: 403 },
      );
    }
  } else if (actor.access === "office") {
    const canonical = binding?.portalApprenticeId || binding?.learnerId || "";
    if (!canonical || !allowedIds.has(canonical)) {
      return NextResponse.json({ error: "Choose a Portal apprentice. This screen does not create one." }, { status: 403 });
    }
  }
  try {
    const stored = await repo.readAttachment(id);
    if (!stored.bytes) throw Object.assign(new Error("Attached review not found."), { status: 404 });
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
  const allowedIds = new Set((await loadReviewApprentices(actor.session)).map((item) => item.id));
  if (!learnerAssignedToTutor(allowedIds, learnerId)) {
    return NextResponse.json(
      {
        error:
          actor.access === "tutor"
            ? "Access denied. You can only upload reviews for learners assigned to you."
            : "Choose a Portal apprentice. This screen does not create one.",
      },
      { status: actor.access === "tutor" ? 403 : 400 },
    );
  }
  try {
    const filename = String(url.searchParams.get("name") || request.headers.get("x-filename") || "review.pdf");
    const type = String(request.headers.get("content-type") || "application/pdf");
    const bytes = Buffer.from(await request.arrayBuffer());
    const attachment = await getReviewRepository().saveAttachment({
      filename,
      type,
      bytes,
      actorId: actor.session.account.id,
      learnerId,
      portalApprenticeId: learnerId,
    });
    return NextResponse.json({ attachment });
  } catch (error) {
    return statusError(error);
  }
}
