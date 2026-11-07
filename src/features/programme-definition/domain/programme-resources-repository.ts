/**
 * Resources + attachments for programme session authoring (Phase 2A).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultLearnerReleaseTiming,
  isLearnerReleaseTiming,
  isResourceAudience,
  isResourceRole,
  type LearnerReleaseTiming,
  type ProgrammeResourceAttachmentRecord,
  type ProgrammeResourceRecord,
  type ResourceAudience,
  type ResourceRole,
} from "./programme-resources";

type ResourceRow = {
  id: string;
  programme_version_id: string;
  resource_key: string;
  title: string;
  filename: string;
  source_path: string;
  evidence_resource_id: string;
  extract_path: string;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

type AttachmentRow = {
  id: string;
  programme_version_id: string;
  resource_id: string;
  session_id: string | null;
  spine_item_id: string;
  role: string;
  audience: string;
  learner_release_timing: string | null;
  sort_order: number;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

function asMetadata(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function resourceRowToRecord(row: ResourceRow): ProgrammeResourceRecord {
  return {
    id: row.id,
    programmeVersionId: row.programme_version_id,
    resourceKey: row.resource_key,
    title: row.title || "",
    filename: row.filename || "",
    sourcePath: row.source_path || "",
    evidenceResourceId: row.evidence_resource_id || "",
    extractPath: row.extract_path || "",
    metadata: asMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function learnerReleaseTimingFromRow(row: AttachmentRow): LearnerReleaseTiming | null {
  if (row.audience !== "LEARNER_VISIBLE") return null;
  const timing = row.learner_release_timing || "";
  return isLearnerReleaseTiming(timing) ? timing : "WITH_SESSION";
}

function attachmentRowToRecord(
  row: AttachmentRow,
): ProgrammeResourceAttachmentRecord {
  if (!isResourceRole(row.role)) throw new Error(`Unknown role: ${row.role}`);
  if (!isResourceAudience(row.audience)) {
    throw new Error(`Unknown audience: ${row.audience}`);
  }
  return {
    id: row.id,
    programmeVersionId: row.programme_version_id,
    resourceId: row.resource_id,
    sessionId: row.session_id,
    spineItemId: row.spine_item_id,
    role: row.role,
    audience: row.audience,
    learnerReleaseTiming: learnerReleaseTimingFromRow(row),
    sortOrder: Number(row.sort_order) || 0,
    metadata: asMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProgrammeResourcesForVersion(
  supabase: SupabaseClient,
  programmeVersionId: string,
): Promise<ProgrammeResourceRecord[]> {
  const id = programmeVersionId.trim();
  if (!id) throw new Error("programmeVersionId is required.");
  const { data, error } = await supabase
    .from("gta_programme_resources")
    .select(
      "id, programme_version_id, resource_key, title, filename, source_path, evidence_resource_id, extract_path, metadata, created_at, updated_at",
    )
    .eq("programme_version_id", id)
    .order("filename", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ResourceRow[]).map(resourceRowToRecord);
}

export async function listResourceAttachmentsForVersion(
  supabase: SupabaseClient,
  programmeVersionId: string,
  opts?: { spineItemId?: string; sessionId?: string },
): Promise<ProgrammeResourceAttachmentRecord[]> {
  const id = programmeVersionId.trim();
  if (!id) throw new Error("programmeVersionId is required.");
  let q = supabase
    .from("gta_programme_resource_attachments")
    .select(
      "id, programme_version_id, resource_id, session_id, spine_item_id, role, audience, learner_release_timing, sort_order, metadata, created_at, updated_at",
    )
    .eq("programme_version_id", id)
    .order("sort_order", { ascending: true });
  if (opts?.spineItemId) q = q.eq("spine_item_id", opts.spineItemId);
  if (opts?.sessionId) q = q.eq("session_id", opts.sessionId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as AttachmentRow[]).map(attachmentRowToRecord);
}

export type ResourceUpsertInput = {
  resourceKey: string;
  title: string;
  filename: string;
  sourcePath?: string;
  evidenceResourceId?: string;
  extractPath?: string;
  metadata?: Record<string, unknown>;
};

export async function upsertProgrammeResources(
  supabase: SupabaseClient,
  programmeVersionId: string,
  resources: ResourceUpsertInput[],
): Promise<ProgrammeResourceRecord[]> {
  const versionId = programmeVersionId.trim();
  if (!versionId) throw new Error("programmeVersionId is required.");
  const saved: ProgrammeResourceRecord[] = [];
  for (const r of resources) {
    const key = r.resourceKey?.trim();
    if (!key) throw new Error("resourceKey is required.");
    const { data, error } = await supabase
      .from("gta_programme_resources")
      .upsert(
        {
          programme_version_id: versionId,
          resource_key: key,
          title: r.title || "",
          filename: r.filename || "",
          source_path: r.sourcePath || "",
          evidence_resource_id: r.evidenceResourceId || "",
          extract_path: r.extractPath || "",
          metadata: r.metadata ?? {},
        },
        { onConflict: "programme_version_id,resource_key" },
      )
      .select(
        "id, programme_version_id, resource_key, title, filename, source_path, evidence_resource_id, extract_path, metadata, created_at, updated_at",
      )
      .single();
    if (error) throw new Error(error.message);
    saved.push(resourceRowToRecord(data as ResourceRow));
  }
  return saved;
}

export type AttachmentUpsertInput = {
  resourceId: string;
  spineItemId: string;
  sessionId?: string | null;
  role: ResourceRole;
  audience: ResourceAudience;
  learnerReleaseTiming?: LearnerReleaseTiming | null;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
};

export async function upsertResourceAttachments(
  supabase: SupabaseClient,
  programmeVersionId: string,
  attachments: AttachmentUpsertInput[],
): Promise<ProgrammeResourceAttachmentRecord[]> {
  const versionId = programmeVersionId.trim();
  if (!versionId) throw new Error("programmeVersionId is required.");
  const saved: ProgrammeResourceAttachmentRecord[] = [];

  for (const a of attachments) {
    if (!isResourceRole(a.role) || !isResourceAudience(a.audience)) {
      throw new Error("Invalid role or audience.");
    }
    const learnerReleaseTiming =
      a.audience === "LEARNER_VISIBLE"
        ? a.learnerReleaseTiming ?? defaultLearnerReleaseTiming(a.audience)
        : null;
    if (
      a.audience === "LEARNER_VISIBLE" &&
      (!learnerReleaseTiming || !isLearnerReleaseTiming(learnerReleaseTiming))
    ) {
      throw new Error("Invalid learner release timing.");
    }
    const sessionId = a.sessionId?.trim() || null;
    const spineItemId = a.spineItemId?.trim();
    const resourceId = a.resourceId?.trim();
    if (!spineItemId || !resourceId) {
      throw new Error("resourceId and spineItemId are required.");
    }

    // Upsert via delete+insert for unplaced uniqueness is awkward; use select then insert/update
    let existingQuery = supabase
      .from("gta_programme_resource_attachments")
      .select("id")
      .eq("programme_version_id", versionId)
      .eq("resource_id", resourceId)
      .eq("role", a.role)
      .eq("spine_item_id", spineItemId);
    if (sessionId) existingQuery = existingQuery.eq("session_id", sessionId);
    else existingQuery = existingQuery.is("session_id", null);

    const { data: existing, error: findErr } = await existingQuery.maybeSingle();
    if (findErr) throw new Error(findErr.message);

    const payload = {
      programme_version_id: versionId,
      resource_id: resourceId,
      session_id: sessionId,
      spine_item_id: spineItemId,
      role: a.role,
      audience: a.audience,
      learner_release_timing: learnerReleaseTiming,
      sort_order: a.sortOrder ?? 0,
      metadata: a.metadata ?? {},
    };

    const { data, error } = existing?.id
      ? await supabase
          .from("gta_programme_resource_attachments")
          .update(payload)
          .eq("id", existing.id)
          .select(
            "id, programme_version_id, resource_id, session_id, spine_item_id, role, audience, learner_release_timing, sort_order, metadata, created_at, updated_at",
          )
          .single()
      : await supabase
          .from("gta_programme_resource_attachments")
          .insert(payload)
          .select(
            "id, programme_version_id, resource_id, session_id, spine_item_id, role, audience, learner_release_timing, sort_order, metadata, created_at, updated_at",
          )
          .single();

    if (error) throw new Error(error.message);
    saved.push(attachmentRowToRecord(data as AttachmentRow));
  }
  return saved;
}

export async function deleteResourceAttachment(
  supabase: SupabaseClient,
  programmeVersionId: string,
  attachmentId: string,
): Promise<void> {
  const versionId = programmeVersionId.trim();
  const id = attachmentId.trim();
  if (!versionId || !id) {
    throw new Error("programmeVersionId and attachmentId are required.");
  }
  const { error, count } = await supabase
    .from("gta_programme_resource_attachments")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("programme_version_id", versionId);
  if (error) throw new Error(error.message);
  if (!count) throw new Error("Attachment was not found.");
}

/**
 * Place an unplaced attachment onto a session (same resource/role/audience),
 * then remove the unplaced row. Caller chooses session — no auto mapping.
 */
export async function placeUnplacedAttachmentOnSession(
  supabase: SupabaseClient,
  programmeVersionId: string,
  attachmentId: string,
  sessionId: string,
): Promise<ProgrammeResourceAttachmentRecord> {
  const versionId = programmeVersionId.trim();
  const attId = attachmentId.trim();
  const targetSessionId = sessionId.trim();
  if (!versionId || !attId || !targetSessionId) {
    throw new Error(
      "programmeVersionId, attachmentId and sessionId are required.",
    );
  }

  const { data: existing, error: findErr } = await supabase
    .from("gta_programme_resource_attachments")
    .select(
      "id, programme_version_id, resource_id, session_id, spine_item_id, role, audience, learner_release_timing, sort_order, metadata",
    )
    .eq("id", attId)
    .eq("programme_version_id", versionId)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!existing) throw new Error("Attachment was not found.");
  if (existing.session_id != null) {
    throw new Error("Attachment is already placed on a session.");
  }

  const { data: session, error: sessErr } = await supabase
    .from("gta_programme_sessions")
    .select("id, spine_item_id, programme_version_id")
    .eq("id", targetSessionId)
    .eq("programme_version_id", versionId)
    .maybeSingle();
  if (sessErr) throw new Error(sessErr.message);
  if (!session) throw new Error("Session was not found.");
  if (session.spine_item_id !== existing.spine_item_id) {
    throw new Error("Session does not belong to this block.");
  }

  const created = await upsertResourceAttachments(supabase, versionId, [
    {
      resourceId: existing.resource_id,
      spineItemId: existing.spine_item_id,
      sessionId: targetSessionId,
      role: existing.role as ResourceRole,
      audience: existing.audience as ResourceAudience,
      learnerReleaseTiming: isLearnerReleaseTiming(
        existing.learner_release_timing || "",
      )
        ? existing.learner_release_timing
        : null,
      sortOrder: existing.sort_order,
      metadata: {
        ...(typeof existing.metadata === "object" && existing.metadata
          ? (existing.metadata as Record<string, unknown>)
          : {}),
        placedFromUnplaced: true,
      },
    },
  ]);

  await deleteResourceAttachment(supabase, versionId, attId);
  const row = created[0];
  if (!row) throw new Error("Could not create placed attachment.");
  return row;
}
