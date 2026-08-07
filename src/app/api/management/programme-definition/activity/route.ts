import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import {
  ensureSeedActivityFromOfficial,
  insertActivity,
  listActivityForStandard,
} from "@/features/programme-definition/domain/activity-repository";
import type { ProgrammeActivityKind } from "@/features/programme-definition/domain/types";

export const runtime = "nodejs";

const KINDS = new Set<ProgrammeActivityKind>([
  "api_request",
  "api_ok",
  "api_error",
  "new_version",
  "official_cached",
  "draft_reopened",
  "programme_created",
  "spine_saved",
  "parameters_saved",
  "formula_published",
  "spine_published",
  "title_saved",
]);

/** Shared History & API log for a standard (all staff). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const standardCode = (url.searchParams.get("standardCode") || "")
      .trim()
      .toUpperCase();
    if (!standardCode) {
      return NextResponse.json(
        { ok: false, error: "standardCode is required." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    await ensureSeedActivityFromOfficial(supabase, standardCode);
    const entries = await listActivityForStandard(supabase, standardCode, 150);

    const lastApi = entries.find(
      (e) =>
        e.kind === "api_request" ||
        e.kind === "api_ok" ||
        e.kind === "api_error",
    );

    return NextResponse.json({
      ok: true,
      entries,
      lastApiCallAt: lastApi?.at ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Could not load activity.",
      },
      { status: 500 },
    );
  }
}

type PostBody = {
  kind?: string;
  summary?: string;
  actor?: string;
  standardCode?: string;
  externalVersion?: string;
  programmeId?: string;
  detail?: Record<string, string | number | boolean | null>;
  at?: string;
  id?: string;
};

/** Append one shared history row. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as PostBody;
    const kind = (body.kind || "").trim() as ProgrammeActivityKind;
    const summary = (body.summary || "").trim();
    const standardCode = (body.standardCode || "").trim().toUpperCase();

    if (!KINDS.has(kind)) {
      return NextResponse.json(
        { ok: false, error: "Invalid activity kind." },
        { status: 400 },
      );
    }
    if (!summary) {
      return NextResponse.json(
        { ok: false, error: "summary is required." },
        { status: 400 },
      );
    }
    if (!standardCode) {
      return NextResponse.json(
        { ok: false, error: "standardCode is required." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const entry = await insertActivity(supabase, {
      id: body.id,
      at: body.at || new Date().toISOString(),
      kind,
      summary,
      actor: (body.actor || "").trim() || "Unknown staff",
      standardCode,
      externalVersion: body.externalVersion,
      programmeId: body.programmeId,
      detail: body.detail,
    });

    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Could not save activity.",
      },
      { status: 500 },
    );
  }
}
