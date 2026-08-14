import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireTutorDeliveryAccess } from "@/features/programme-delivery/domain/staff-delivery-access";
import {
  extractCandidateActivities,
  loadResourceExtractText,
} from "@/features/programme-definition/domain/resource-extract";
import { getResourceBinary } from "@/features/programme-definition/domain/programme-resource-binaries-repository";

export const runtime = "nodejs";

/**
 * GET ?programmeVersionId=&resourceId=
 * Returns catalogue-referenced source extract text when available.
 * Does not claim binary DOCX is openable in-app.
 */
export async function GET(request: Request) {
  const access = await requireTutorDeliveryAccess();
  if (access instanceof NextResponse) return access;
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
    const binary = await getResourceBinary(
      supabase,
      programmeVersionId,
      resourceId,
    );
    const binaryAvailable = Boolean(binary);
    const isPpt = /\.(ppt|pptx|pptm)$/i.test(data.filename || "");
    const note = binaryAvailable
      ? loaded.mode === "extract_file"
        ? isPpt
          ? "Showing the controlled slide extract. Use Open presentation to download the original PowerPoint. Browsers cannot preview .ppt files."
          : "Showing the controlled extract. Use Open file to download the original."
        : isPpt
          ? "Use Open presentation to download the original PowerPoint. Browsers cannot preview .ppt files."
          : "Use Open file to download the original."
      : loaded.mode === "extract_file"
        ? isPpt
          ? "Original file not currently available. Showing the controlled slide extract."
          : "Original file not currently available. Showing controlled source extract."
        : isPpt
          ? "Original file not currently available. No slide extract is available."
          : "Original file not currently available. No extract file is available for this resource.";

    return NextResponse.json({
      ok: true,
      resource: {
        id: data.id,
        title: data.title,
        filename: data.filename,
        sourcePath: data.source_path,
        evidenceResourceId: data.evidence_resource_id,
      },
      binaryAvailableInApp: binaryAvailable,
      powerpointOpenableInBrowser: false,
      note,
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
