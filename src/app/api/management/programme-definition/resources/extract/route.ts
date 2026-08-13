import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import {
  extractCandidateActivities,
  loadResourceExtractText,
} from "@/features/programme-definition/domain/resource-extract";

export const runtime = "nodejs";

/**
 * GET ?programmeVersionId=&resourceId=
 * Returns catalogue-referenced source extract text when available.
 * Does not claim binary DOCX is openable in-app.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const programmeVersionId =
      url.searchParams.get("programmeVersionId")?.trim() || "";
    const resourceId = url.searchParams.get("resourceId")?.trim() || "";
    if (!programmeVersionId || !resourceId) {
      return NextResponse.json(
        {
          ok: false,
          error: "programmeVersionId and resourceId are required.",
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("gta_programme_resources")
      .select(
        "id, title, filename, source_path, evidence_resource_id, extract_path, metadata",
      )
      .eq("id", resourceId)
      .eq("programme_version_id", programmeVersionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Resource was not found." },
        { status: 404 },
      );
    }

    const loaded = loadResourceExtractText({
      extractPath: data.extract_path || "",
      evidenceResourceId: data.evidence_resource_id || "",
    });

    return NextResponse.json({
      ok: true,
      resource: {
        id: data.id,
        title: data.title,
        filename: data.filename,
        sourcePath: data.source_path,
        evidenceResourceId: data.evidence_resource_id,
      },
      binaryAvailableInApp: false,
      note:
        loaded.mode === "extract_file"
          ? "Showing controlled source extract. Original lesson-plan binary is catalogue-referenced and not opened in-app."
          : "No extract file available for this resource. Filename remains catalogue-referenced only.",
      extractMode: loaded.mode,
      extractText: loaded.text,
      candidateActivities: extractCandidateActivities(loaded.text),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not load extract.",
      },
      { status: 500 },
    );
  }
}
