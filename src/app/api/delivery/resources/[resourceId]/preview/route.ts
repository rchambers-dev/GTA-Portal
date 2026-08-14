import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireTutorDeliveryAccess } from "@/features/programme-delivery/domain/staff-delivery-access";
import { getResourceBinary } from "@/features/programme-definition/domain/programme-resource-binaries-repository";
import { getResourcePreview } from "@/features/programme-definition/domain/programme-resource-previews-repository";
import { previewIsCurrent } from "@/features/programme-definition/domain/programme-resource-previews";

export const runtime = "nodejs";

type Props = { params: Promise<{ resourceId: string }> };

export async function GET(request: Request, { params }: Props) {
  const access = await requireTutorDeliveryAccess();
  if (access instanceof NextResponse) return access;
  const { resourceId } = await params;
  const id = resourceId?.trim();
  const programmeVersionId =
    new URL(request.url).searchParams.get("programmeVersionId")?.trim() || "";
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
      .select("id, title, filename")
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
    const preview = await getResourcePreview(supabase, programmeVersionId, id);
    if (
      !previewIsCurrent({
        preview,
        binarySha256: binary?.sha256 || null,
      })
    ) {
      return NextResponse.json(
        { ok: false, error: "Preview unavailable" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      resource: {
        id: resource.id,
        title: resource.title,
        filename: resource.filename,
      },
      preview: {
        type: preview!.previewType,
        slideCount: preview!.slideCount,
        slides: (preview!.manifest.slides || []).map((s) => ({
          index: s.index,
          hasImage: Boolean(s.storagePath),
          text: s.text || [],
        })),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not open preview.",
      },
      { status: 500 },
    );
  }
}
