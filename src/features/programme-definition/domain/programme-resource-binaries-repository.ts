import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProgrammeResourceBinaryRecord,
  ResourceVersionReview,
} from "./programme-resource-binaries";

type BinaryRow = {
  id: string;
  resource_id: string;
  programme_version_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  storage_bucket: string;
  storage_path: string;
  source_archive: string;
  source_path: string;
  source_group_code: string;
  source_group_folder: string;
  version_review: string;
  metadata: unknown;
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

function asMetadata(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function rowToRecord(row: BinaryRow): ProgrammeResourceBinaryRecord {
  return {
    id: row.id,
    resourceId: row.resource_id,
    programmeVersionId: row.programme_version_id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes) || 0,
    sha256: row.sha256,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    sourceArchive: row.source_archive,
    sourcePath: row.source_path,
    sourceGroupCode: row.source_group_code,
    sourceGroupFolder: row.source_group_folder,
    versionReview: row.version_review as ResourceVersionReview,
    metadata: asMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listResourceBinariesForVersion(
  supabase: SupabaseClient,
  programmeVersionId: string,
): Promise<ProgrammeResourceBinaryRecord[]> {
  const id = programmeVersionId.trim();
  if (!id) throw new Error("programmeVersionId is required.");
  const { data, error } = await supabase
    .from("gta_programme_resource_binaries")
    .select(
      "id, resource_id, programme_version_id, original_filename, mime_type, size_bytes, sha256, storage_bucket, storage_path, source_archive, source_path, source_group_code, source_group_folder, version_review, metadata, created_at, updated_at",
    )
    .eq("programme_version_id", id);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as BinaryRow[]).map(rowToRecord);
}

export async function getResourceBinary(
  supabase: SupabaseClient,
  programmeVersionId: string,
  resourceId: string,
): Promise<ProgrammeResourceBinaryRecord | null> {
  const versionId = programmeVersionId.trim();
  const id = resourceId.trim();
  if (!versionId || !id) return null;
  const { data, error } = await supabase
    .from("gta_programme_resource_binaries")
    .select(
      "id, resource_id, programme_version_id, original_filename, mime_type, size_bytes, sha256, storage_bucket, storage_path, source_archive, source_path, source_group_code, source_group_folder, version_review, metadata, created_at, updated_at",
    )
    .eq("programme_version_id", versionId)
    .eq("resource_id", id)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return null;
    throw new Error(error.message);
  }
  return data ? rowToRecord(data as BinaryRow) : null;
}

export async function upsertResourceBinary(
  supabase: SupabaseClient,
  input: {
    resourceId: string;
    programmeVersionId: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    storageBucket: string;
    storagePath: string;
    sourceArchive: string;
    sourcePath: string;
    sourceGroupCode: string;
    sourceGroupFolder: string;
    versionReview: ResourceVersionReview;
    metadata?: Record<string, unknown>;
  },
): Promise<ProgrammeResourceBinaryRecord> {
  const { data, error } = await supabase
    .from("gta_programme_resource_binaries")
    .upsert(
      {
        resource_id: input.resourceId,
        programme_version_id: input.programmeVersionId,
        original_filename: input.originalFilename,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        sha256: input.sha256,
        storage_bucket: input.storageBucket,
        storage_path: input.storagePath,
        source_archive: input.sourceArchive,
        source_path: input.sourcePath,
        source_group_code: input.sourceGroupCode,
        source_group_folder: input.sourceGroupFolder,
        version_review: input.versionReview,
        metadata: input.metadata || {},
      },
      { onConflict: "resource_id" },
    )
    .select(
      "id, resource_id, programme_version_id, original_filename, mime_type, size_bytes, sha256, storage_bucket, storage_path, source_archive, source_path, source_group_code, source_group_folder, version_review, metadata, created_at, updated_at",
    )
    .single();
  if (error) throw new Error(error.message);
  return rowToRecord(data as BinaryRow);
}

export async function upsertResourceSourcePath(
  supabase: SupabaseClient,
  input: {
    resourceId: string;
    binaryId: string | null;
    sourceArchive: string;
    sourcePath: string;
    sourceGroupCode: string;
    sourceGroupFolder: string;
    sha256: string;
  },
): Promise<void> {
  const { error } = await supabase.from("gta_programme_resource_source_paths").upsert(
    {
      resource_id: input.resourceId,
      binary_id: input.binaryId,
      source_archive: input.sourceArchive,
      source_path: input.sourcePath,
      source_group_code: input.sourceGroupCode,
      source_group_folder: input.sourceGroupFolder,
      sha256: input.sha256,
    },
    { onConflict: "resource_id,source_path" },
  );
  if (error) throw new Error(error.message);
}
