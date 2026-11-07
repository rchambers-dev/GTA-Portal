import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import type { DirectoryAction } from "@/features/employer-directory/domain/model";
import { reduceDirectory } from "@/features/employer-directory/domain/reduce";
import { requireEmployerDirectoryAccess } from "@/features/employer-directory/server/access";
import {
  applyDirectoryWrites,
  isReferenceCollision,
  loadDirectorySnapshot,
} from "@/features/employer-directory/server/snapshot";

export const runtime = "nodejs";

const ACTIONS = new Set<DirectoryAction["action"]>([
  "createCompany",
  "createSite",
  "linkCompanySite",
  "unlinkCompanySite",
  "createManager",
  "assignManagerRole",
  "removeManagerRole",
  "createReviewLearner",
  "updateReviewLearner",
  "linkReviewLearner",
]);

export async function GET() {
  const session = await requireEmployerDirectoryAccess();
  if (session instanceof NextResponse) return session;
  try {
    const snapshot = await loadDirectorySnapshot(createSupabaseAdminClient());
    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load the directory." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await requireEmployerDirectoryAccess();
  if (session instanceof NextResponse) return session;
  const body = (await request.json().catch(() => null)) as DirectoryAction | null;
  if (!body || !ACTIONS.has(body.action)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const snapshot = await loadDirectorySnapshot(supabase);
      const result = reduceDirectory(snapshot, body);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code, candidates: result.candidates },
          { status: result.status },
        );
      }
      await applyDirectoryWrites(supabase, result.writes);
      return NextResponse.json({ snapshot: result.snapshot });
    } catch (error) {
      if (body.action === "createReviewLearner" && isReferenceCollision(error) && attempt < 2) {
        continue;
      }
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to save." },
        { status: 500 },
      );
    }
  }
  return NextResponse.json({ error: "Could not allocate a unique portal reference." }, { status: 409 });
}
