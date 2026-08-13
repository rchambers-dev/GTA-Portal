/**
 * Load programme sessions for a pinned programme version.
 * No newest-version fallback.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LearningObjectivesReview } from "./programme-resources";
import type { LearnerFacingContent } from "./learner-facing-content";
import { parseLearnerFacingContent } from "./learner-facing-content";
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
  publish_status?: string | null;
  learning_objectives_review?: unknown;
  learner_facing_content?: unknown;
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

function asObjectivesReview(raw: unknown): LearningObjectivesReview {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { status: "empty" };
  }
  const o = raw as LearningObjectivesReview;
  if (
    o.status === "candidate_for_review" ||
    o.status === "approved_structured" ||
    o.status === "empty"
  ) {
    return o;
  }
  return { status: "empty" };
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
    publishStatus:
      row.publish_status === "published" ? "published" : "draft",
    learningObjectivesReview: asObjectivesReview(
      row.learning_objectives_review,
    ),
    learnerFacingContent: parseLearnerFacingContent(
      row.learner_facing_content,
    ),
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
      "id, programme_version_id, spine_item_id, session_key, sequence, calendar_week, session_index_in_week, title, topic, foundation_skill_code, planned_otj_hours, publish_status, learning_objectives_review, learner_facing_content, metadata, created_at, updated_at",
    )
    .eq("programme_version_id", id)
    .order("sequence", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as SessionRow[]).map(rowToRecord);
}

export async function updateProgrammeSessionAuthoring(
  supabase: SupabaseClient,
  programmeVersionId: string,
  sessionId: string,
  patch: {
    publishStatus?: "draft" | "published";
    learningObjectivesReview?: LearningObjectivesReview;
    learnerFacingContent?: LearnerFacingContent;
  },
): Promise<ProgrammeSessionRecord> {
  const versionId = programmeVersionId.trim();
  const id = sessionId.trim();
  if (!versionId || !id) {
    throw new Error("programmeVersionId and sessionId are required.");
  }

  const update: Record<string, unknown> = {};
  if (patch.publishStatus) update.publish_status = patch.publishStatus;
  if (patch.learningObjectivesReview) {
    update.learning_objectives_review = patch.learningObjectivesReview;
  }
  if (patch.learnerFacingContent) {
    update.learner_facing_content = patch.learnerFacingContent;
  }
  if (Object.keys(update).length === 0) {
    throw new Error("No session authoring fields to update.");
  }

  const { data, error } = await supabase
    .from("gta_programme_sessions")
    .update(update)
    .eq("id", id)
    .eq("programme_version_id", versionId)
    .select(
      "id, programme_version_id, spine_item_id, session_key, sequence, calendar_week, session_index_in_week, title, topic, foundation_skill_code, planned_otj_hours, publish_status, learning_objectives_review, learner_facing_content, metadata, created_at, updated_at",
    )
    .single();

  if (error) throw new Error(error.message);
  return rowToRecord(data as SessionRow);
}
