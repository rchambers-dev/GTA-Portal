import { NextResponse } from "next/server";
import { readReviewAttachment, saveReviewAttachment } from "@/features/review-assistant/attachments";
import { readReviewState } from "@/features/review-assistant/state-store";
import { requireReviewActor, tutorNameKey } from "@/features/review-assistant/source-runtime";
import { tutorMayReadAttachment } from "@/features/review-assistant/tutor-caseload";

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
  if (actor.access === "tutor") {
    const keyOf = await tutorNameKey();
    const allowed = tutorMayReadAttachment(
      readReviewState(),
      keyOf(actor.session.account.name),
      id,
      keyOf,
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
  const url = new URL(request.url);
  // The original client posts the file bytes with a name and no learner id.
  // Reading the stored file stays limited to the tutor's own linked reviews.
  try {
    const filename = String(url.searchParams.get("name") || request.headers.get("x-filename") || "review.pdf");
    const type = String(request.headers.get("content-type") || "application/pdf");
    const bytes = Buffer.from(await request.arrayBuffer());
    const attachment = saveReviewAttachment({ filename, type, bytes });
    return NextResponse.json({ attachment });
  } catch (error) {
    return statusError(error);
  }
}
