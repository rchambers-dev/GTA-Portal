import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProgrammeResourcePreviewRecord,
  ResourcePreviewManifest,
  ResourcePreviewStatus,
  ResourcePreviewType,
} from "./programme-resource-previews";
import { previewIsCurrent } from "./programme-resource-previews";

type PreviewRow = {
  id: string;
  resource_id: string;
  binary_id: string | null;
  programme_version_id: string;
  preview_type: string;
  status: string;
  generated_from_binary_hash: string;
  storage_bucket: string;
  slide_count: number;
  failure_reason: string;
  manifest: unknown;
  created_at: string;
  updated_at: string;
};

function isMissingTable(error: { message?: string; code?: string }): boolean {
  const msg = String(error.message || "");
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(msg)
  );
}

function asManifest(raw: unknown): ResourcePreviewManifest {
  if (raw && typeof raw === "object" && Array.isArray((raw as { slides?: unknown }).slides)) {
    return raw as ResourcePreviewManifest;
  }
  return { slides: [] };
}

function rowToRecord(row: PreviewRow): ProgrammeResourcePreviewRecord {
  return {
    id: row.id,
    resourceId: row.resource_id,
    binaryId: row.binary_id,
    programmeVersionId: row.programme_version_id,
    previewType: row.preview_type as ResourcePreviewType,
    status: row.status as ResourcePreviewStatus,
    generatedFromBinaryHash: row.generated_from_binary_hash,
    storageBucket: row.storage_bucket,
    slideCount: Number(row.slide_count) || 0,
    failureReason: row.failure_reason || "",
    manifest: asManifest(row.manifest),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT =
  "id, resource_id, binary_id, programme_version_id, preview_type, status, generated_from_binary_hash, storage_bucket, slide_count, failure_reason, manifest, created_at, updated_at";

export async function listResourcePreviewsForVersion(
  supabase: SupabaseClient,
  programmeVersionId: string,
): Promise<ProgrammeResourcePreviewRecord[]> {
  const id = programmeVersionId.trim();
  if (!id) throw new Error("programmeVersionId is required.");
  const { data, error } = await supabase
    .from("gta_programme_resource_previews")
    .select(SELECT)
    .eq("programme_version_id", id);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as PreviewRow[]).map(rowToRecord);
}

export async function getResourcePreview(
  supabase: SupabaseClient,
  programmeVersionId: string,
  resourceId: string,
): Promise<ProgrammeResourcePreviewRecord | null> {
  const versionId = programmeVersionId.trim();
  const id = resourceId.trim();
  if (!versionId || !id) return null;
  const { data, error } = await supabase
    .from("gta_programme_resource_previews")
    .select(SELECT)
    .eq("programme_version_id", versionId)
    .eq("resource_id", id)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return null;
    throw new Error(error.message);
  }
  return data ? rowToRecord(data as PreviewRow) : null;
}

export async function upsertResourcePreview(
  supabase: SupabaseClient,
  input: {
    resourceId: string;
    binaryId: string | null;
    programmeVersionId: string;
    previewType: ResourcePreviewType;
    status: ResourcePreviewStatus;
    generatedFromBinaryHash: string;
    storageBucket: string;
    slideCount: number;
    failureReason?: string;
    manifest: ResourcePreviewManifest;
  },
): Promise<ProgrammeResourcePreviewRecord> {
  const { data, error } = await supabase
    .from("gta_programme_resource_previews")
    .upsert(
      {
        resource_id: input.resourceId,
        binary_id: input.binaryId,
        programme_version_id: input.programmeVersionId,
        preview_type: input.previewType,
        status: input.status,
        generated_from_binary_hash: input.generatedFromBinaryHash,
        storage_bucket: input.storageBucket,
        slide_count: input.slideCount,
        failure_reason: input.failureReason || "",
        manifest: input.manifest,
      },
      { onConflict: "resource_id" },
    )
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);
  return rowToRecord(data as PreviewRow);
}

export function currentPreviewResourceIds(
  previews: ProgrammeResourcePreviewRecord[],
  hashesByResourceId: Map<string, string>,
): Set<string> {
  const ids = new Set<string>();
  for (const preview of previews) {
    if (
      previewIsCurrent({
        preview,
        binarySha256: hashesByResourceId.get(preview.resourceId) || null,
      })
    ) {
      ids.add(preview.resourceId);
    }
  }
  return ids;
}
