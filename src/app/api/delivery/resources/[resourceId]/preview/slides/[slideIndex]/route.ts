import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireTutorDeliveryAccess } from "@/features/programme-delivery/domain/staff-delivery-access";
import { getResourceBinary } from "@/features/programme-definition/domain/programme-resource-binaries-repository";
import { getResourcePreview } from "@/features/programme-definition/domain/programme-resource-previews-repository";
import { previewIsCurrent } from "@/features/programme-definition/domain/programme-resource-previews";
import { readResourceBinaryBytes } from "@/features/programme-definition/domain/resource-binary-storage";

export const runtime = "nodejs";

type Props = { params: Promise<{ resourceId: string; slideIndex: string }> };

export async function GET(request: Request, { params }: Props) {
  const access = await requireTutorDeliveryAccess(request);
  if (access instanceof NextResponse) return access;
  const { resourceId, slideIndex } = await params;
  const id = resourceId?.trim();
  const index = Number(slideIndex);
  const programmeVersionId =
    new URL(request.url).searchParams.get("programmeVersionId")?.trim() || "";
  if (!id || !programmeVersionId || !Number.isInteger(index) || index < 1) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  try {
    const supabase = createSupabaseAdminClient();
    const { data: resource, error } = await supabase
      .from("gta_programme_resources")
      .select("id")
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
    const slide = (preview!.manifest.slides || []).find((s) => s.index === index);
    if (!slide?.storagePath) {
      return NextResponse.json(
        { ok: false, error: "Slide image not currently available" },
        { status: 404 },
      );
    }
    const bytes = await readResourceBinaryBytes({
      supabase,
      bucket: preview!.storageBucket,
      storagePath: slide.storagePath,
    });
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": slide.mimeType || "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not open slide.",
      },
      { status: 500 },
    );
  }
}
