import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireTutorDeliveryAccess } from "@/features/programme-delivery/domain/staff-delivery-access";
import { getResourceBinary } from "@/features/programme-definition/domain/programme-resource-binaries-repository";
import { resourceBinaryHttpResponse } from "@/features/programme-definition/domain/resource-binary-http";
import { readResourceBinaryBytes } from "@/features/programme-definition/domain/resource-binary-storage";

export const runtime = "nodejs";

type Props = { params: Promise<{ resourceId: string }> };

/**
 * Authenticated tutor/curriculum download of an original binary.
 * Never a public URL. Apprentices must use the apprentice file route.
 */
export async function GET(request: Request, { params }: Props) {
  const access = await requireTutorDeliveryAccess(request);
  if (access instanceof NextResponse) return access;

  const { resourceId } = await params;
  const id = resourceId?.trim();
  const url = new URL(request.url);
  const programmeVersionId =
    url.searchParams.get("programmeVersionId")?.trim() || "";
  if (!id || !programmeVersionId) {
    return NextResponse.json(
      { ok: false, error: "programmeVersionId and resourceId are required." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: resource, error } = await supabase
      .from("gta_programme_resources")
      .select("id, filename")
      .eq("id", id)
      .eq("programme_version_id", programmeVersionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!resource) {
      return NextResponse.json(
        { ok: false, error: "Resource was not found." },
        { status: 404 },
      );
    }

    const binary = await getResourceBinary(supabase, programmeVersionId, id);
    if (!binary) {
      return NextResponse.json(
        { ok: false, error: "Original file not currently available" },
        { status: 404 },
      );
    }

    const bytes = await readResourceBinaryBytes({
      supabase,
      bucket: binary.storageBucket,
      storagePath: binary.storagePath,
    });
    const forceDownload = url.searchParams.get("download") === "1";
    return resourceBinaryHttpResponse({
      bytes,
      filename: binary.originalFilename || resource.filename,
      mimeType: binary.mimeType,
      forceDownload,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not open original file.",
      },
      { status: 500 },
    );
  }
}
