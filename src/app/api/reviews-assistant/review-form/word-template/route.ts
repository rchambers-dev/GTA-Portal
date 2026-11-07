import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireReviewActor } from "@/features/review-assistant/source-runtime";

export const runtime = "nodejs";

export async function GET() {
  const actor = await requireReviewActor();
  if ("error" in actor) return actor.error;
  const bytes = readFileSync(
    path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "public/review-assistant/forms/GTA_Review_Form.docx",
    ),
  );
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "cache-control": "private, max-age=86400",
    },
  });
}
