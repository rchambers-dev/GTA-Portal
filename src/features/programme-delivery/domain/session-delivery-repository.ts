/**
 * Persist / load gta_session_delivery_records.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionDeliveryRecord } from "./session-delivery";

type Row = {
  id: string;
  programme_version_id: string;
  session_id: string;
  apprentice_id: string;
  apprentice_programme_id: string;
  spine_item_id: string | null;
  status: string;
  delivered_at: string;
  signed_off_by: string | null;
  signed_off_by_name: string;
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

function rowToRecord(row: Row): SessionDeliveryRecord {
  return {
    id: row.id,
    programmeVersionId: row.programme_version_id,
    sessionId: row.session_id,
    apprenticeId: row.apprentice_id,
    apprenticeProgrammeId: row.apprentice_programme_id,
    spineItemId: row.spine_item_id,
    status: "delivered",
    deliveredAt: row.delivered_at,
    signedOffBy: row.signed_off_by,
    signedOffByName: row.signed_off_by_name || "",
    note: row.note || "",
    metadata: asMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSessionDeliveryRecords(
  supabase: SupabaseClient,
  opts: {
    programmeVersionId: string;
    apprenticeProgrammeId?: string;
    apprenticeId?: string;
    sessionId?: string;
  },
): Promise<SessionDeliveryRecord[]> {
  const versionId = opts.programmeVersionId.trim();
  if (!versionId) throw new Error("programmeVersionId is required.");

  let q = supabase
    .from("gta_session_delivery_records")
    .select(
      "id, programme_version_id, session_id, apprentice_id, apprentice_programme_id, spine_item_id, status, delivered_at, signed_off_by, signed_off_by_name, note, metadata, created_at, updated_at",
    )
    .eq("programme_version_id", versionId)
    .order("delivered_at", { ascending: true });

  if (opts.apprenticeProgrammeId) {
    q = q.eq("apprentice_programme_id", opts.apprenticeProgrammeId);
  }
  if (opts.apprenticeId) q = q.eq("apprentice_id", opts.apprenticeId);
  if (opts.sessionId) q = q.eq("session_id", opts.sessionId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(rowToRecord);
}

export type SignOffSessionDeliveryInput = {
  programmeVersionId: string;
  sessionId: string;
  apprenticeId: string;
  apprenticeProgrammeId: string;
  spineItemId?: string | null;
  deliveredAt?: string;
  signedOffBy?: string | null;
  signedOffByName: string;
  note?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Create a delivered record. Refuses if one already exists (no casual undo).
 */
export async function signOffSessionDelivered(
  supabase: SupabaseClient,
  input: SignOffSessionDeliveryInput,
): Promise<SessionDeliveryRecord> {
  const programmeVersionId = input.programmeVersionId.trim();
  const sessionId = input.sessionId.trim();
  const apprenticeId = input.apprenticeId.trim();
  const apprenticeProgrammeId = input.apprenticeProgrammeId.trim();
  if (
    !programmeVersionId ||
    !sessionId ||
    !apprenticeId ||
    !apprenticeProgrammeId
  ) {
    throw new Error(
      "programmeVersionId, sessionId, apprenticeId and apprenticeProgrammeId are required.",
    );
  }

  const existing = await listSessionDeliveryRecords(supabase, {
    programmeVersionId,
    apprenticeProgrammeId,
    sessionId,
  });
  if (existing.length > 0) {
    throw new Error(
      "This Session is already signed off as delivered for this apprentice. Casual undo is not available; authorised amendment is a future requirement.",
    );
  }

  // Validate session belongs to version
  const { data: session, error: sessErr } = await supabase
    .from("gta_programme_sessions")
    .select("id, programme_version_id, spine_item_id")
    .eq("id", sessionId)
    .eq("programme_version_id", programmeVersionId)
    .maybeSingle();
  if (sessErr) throw new Error(sessErr.message);
  if (!session) throw new Error("Session was not found on this programme version.");

  const { data: enrolment, error: enrErr } = await supabase
    .from("apprentice_programmes")
    .select("id, apprentice_id, gta_programme_version_id")
    .eq("id", apprenticeProgrammeId)
    .maybeSingle();
  if (enrErr) throw new Error(enrErr.message);
  if (!enrolment) throw new Error("Enrolment was not found.");
  if (enrolment.apprentice_id !== apprenticeId) {
    throw new Error("Enrolment does not match apprentice.");
  }
  if (
    enrolment.gta_programme_version_id &&
    enrolment.gta_programme_version_id !== programmeVersionId
  ) {
    throw new Error("Enrolment is not pinned to this programme version.");
  }

  const { data, error } = await supabase
    .from("gta_session_delivery_records")
    .insert({
      programme_version_id: programmeVersionId,
      session_id: sessionId,
      apprentice_id: apprenticeId,
      apprentice_programme_id: apprenticeProgrammeId,
      spine_item_id: input.spineItemId ?? session.spine_item_id,
      status: "delivered",
      delivered_at: input.deliveredAt || new Date().toISOString(),
      signed_off_by: input.signedOffBy || null,
      signed_off_by_name: input.signedOffByName.trim() || "Tutor",
      note: input.note?.trim() || "",
      metadata: {
        ...(input.metadata ?? {}),
        meaning:
          "Planned learning Session delivered/completed for this apprentice. Not competence, Task pass, OTJ, or attendance.",
      },
    })
    .select(
      "id, programme_version_id, session_id, apprentice_id, apprentice_programme_id, spine_item_id, status, delivered_at, signed_off_by, signed_off_by_name, note, metadata, created_at, updated_at",
    )
    .single();

  if (error) throw new Error(error.message);
  return rowToRecord(data as Row);
}
