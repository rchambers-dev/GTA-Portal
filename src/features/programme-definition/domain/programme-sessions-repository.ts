/**
 * Load programme sessions for a pinned programme version.
 * No newest-version fallback.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgrammeSessionRecord } from "./programme-sessions";

type SessionRow = {
  id: string;
  programme_version_id: string;
  spine_item_id: string | null;
  session_key: string;
  sequence: number;
  calendar_week: number;
  session_index_in_week: number;
  title: string;
  topic: string;
  foundation_skill_code: string | null;
  planned_otj_hours: number | null;
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

function rowToRecord(row: SessionRow): ProgrammeSessionRecord {
  return {
    id: row.id,
    programmeVersionId: row.programme_version_id,
    spineItemId: row.spine_item_id,
    sessionKey: row.session_key,
    sequence: Number(row.sequence) || 0,
    calendarWeek: Number(row.calendar_week) || 0,
    sessionIndexInWeek: Number(row.session_index_in_week) || 1,
    title: row.title || "",
    topic: row.topic || "",
    foundationSkillCode: row.foundation_skill_code,
    plannedOtjHours:
      row.planned_otj_hours == null ? null : Number(row.planned_otj_hours),
    metadata: asMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProgrammeSessionsForVersion(
  supabase: SupabaseClient,
  programmeVersionId: string,
): Promise<ProgrammeSessionRecord[]> {
  const id = programmeVersionId.trim();
  if (!id) {
    throw new Error("programmeVersionId is required.");
  }

  const { data, error } = await supabase
    .from("gta_programme_sessions")
    .select(
      "id, programme_version_id, spine_item_id, session_key, sequence, calendar_week, session_index_in_week, title, topic, foundation_skill_code, planned_otj_hours, metadata, created_at, updated_at",
    )
    .eq("programme_version_id", id)
    .order("sequence", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as SessionRow[]).map(rowToRecord);
}
