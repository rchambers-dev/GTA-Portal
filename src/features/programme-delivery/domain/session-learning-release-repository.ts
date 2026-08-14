/**
 * Persist / load gta_session_learning_releases.
 * Writes are service-role only via tutor delivery APIs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSessionLearningReleaseSource,
  type SessionLearningRelease,
  type SessionLearningReleaseSource,
} from "./session-learning-release";

type Row = {
  id: string;
  programme_version_id: string;
  session_id: string;
  apprentice_id: string;
  apprentice_programme_id: string;
  spine_item_id: string | null;
  teaching_group_id: string | null;
  source: string;
  released_at: string;
  released_by: string | null;
  released_by_name: string;
  note: string;
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

function rowToRecord(row: Row): SessionLearningRelease {
  const source: SessionLearningReleaseSource =
    isSessionLearningReleaseSource(row.source) ? row.source : "individual";
  return {
    id: row.id,
    programmeVersionId: row.programme_version_id,
    sessionId: row.session_id,
    apprenticeId: row.apprentice_id,
    apprenticeProgrammeId: row.apprentice_programme_id,
    spineItemId: row.spine_item_id,
    teachingGroupId: row.teaching_group_id,
    source,
    releasedAt: row.released_at,
    releasedBy: row.released_by,
    releasedByName: row.released_by_name || "",
    note: row.note || "",
    metadata: asMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLS =
  "id, programme_version_id, session_id, apprentice_id, apprentice_programme_id, spine_item_id, teaching_group_id, source, released_at, released_by, released_by_name, note, metadata, created_at, updated_at";

export async function listSessionLearningReleases(
  supabase: SupabaseClient,
  opts: {
    programmeVersionId: string;
    apprenticeProgrammeId?: string;
    apprenticeId?: string;
    sessionId?: string;
    teachingGroupId?: string;
  },
): Promise<SessionLearningRelease[]> {
  const versionId = opts.programmeVersionId.trim();
  if (!versionId) throw new Error("programmeVersionId is required.");

  let q = supabase
    .from("gta_session_learning_releases")
    .select(SELECT_COLS)
    .eq("programme_version_id", versionId)
    .order("released_at", { ascending: true });

  if (opts.apprenticeProgrammeId) {
    q = q.eq("apprentice_programme_id", opts.apprenticeProgrammeId);
  }
  if (opts.apprenticeId) q = q.eq("apprentice_id", opts.apprenticeId);
  if (opts.sessionId) q = q.eq("session_id", opts.sessionId);
  if (opts.teachingGroupId) q = q.eq("teaching_group_id", opts.teachingGroupId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(rowToRecord);
}

export type SessionLearningReleaseInsert = {
  programmeVersionId: string;
  sessionId: string;
  apprenticeId: string;
  apprenticeProgrammeId: string;
  spineItemId?: string | null;
  teachingGroupId?: string | null;
  source: SessionLearningReleaseSource;
  releasedAt?: string;
  releasedBy?: string | null;
  releasedByName: string;
  note?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Insert per-enrolment grants. Existing (session, enrolment) rows are skipped.
 * Does not update already-released learners and does not grant future joiners.
 */
export async function insertSessionLearningReleases(
  supabase: SupabaseClient,
  rows: SessionLearningReleaseInsert[],
): Promise<{ created: SessionLearningRelease[]; skippedExisting: number }> {
  if (rows.length === 0) return { created: [], skippedExisting: 0 };

  const payload = rows.map((row) => ({
    programme_version_id: row.programmeVersionId.trim(),
    session_id: row.sessionId.trim(),
    apprentice_id: row.apprenticeId.trim(),
    apprentice_programme_id: row.apprenticeProgrammeId.trim(),
    spine_item_id: row.spineItemId ?? null,
    teaching_group_id: row.teachingGroupId ?? null,
    source: row.source,
    released_at: row.releasedAt || new Date().toISOString(),
    released_by: row.releasedBy || null,
    released_by_name: row.releasedByName.trim() || "Tutor",
    note: row.note?.trim() || "",
    metadata: {
      meaning:
        "Approved learner-facing Session learning is available to this enrolment. Not attendance, completion, Task pass, competence, or OTJ.",
      ...(row.metadata ?? {}),
    },
  }));

  for (const row of payload) {
    if (
      !row.programme_version_id ||
      !row.session_id ||
      !row.apprentice_id ||
      !row.apprentice_programme_id
    ) {
      throw new Error(
        "programmeVersionId, sessionId, apprenticeId and apprenticeProgrammeId are required.",
      );
    }
  }

  const { data, error } = await supabase
    .from("gta_session_learning_releases")
    .upsert(payload, {
      onConflict: "session_id,apprentice_programme_id",
      ignoreDuplicates: true,
    })
    .select(SELECT_COLS);

  if (error) throw new Error(error.message);
  const created = ((data ?? []) as Row[]).map(rowToRecord);
  return {
    created,
    skippedExisting: Math.max(0, rows.length - created.length),
  };
}
