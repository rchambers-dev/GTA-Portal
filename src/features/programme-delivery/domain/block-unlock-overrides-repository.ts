import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateEnrolmentBlockUnlockInput,
  EnrolmentBlockUnlock,
} from "./block-unlock-overrides";

type Row = {
  id: string;
  apprentice_programme_id: string;
  spine_item_id: string;
  unlocked_by: string | null;
  unlocked_by_name: string;
  unlocked_at: string;
  reason: string;
  created_at: string;
  updated_at: string;
};

function rowToRecord(row: Row): EnrolmentBlockUnlock {
  return {
    id: row.id,
    apprenticeProgrammeId: row.apprentice_programme_id,
    spineItemId: row.spine_item_id,
    unlockedBy: row.unlocked_by,
    unlockedByName: row.unlocked_by_name || "",
    unlockedAt: row.unlocked_at || row.created_at,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listEnrolmentBlockUnlocks(
  supabase: SupabaseClient,
  apprenticeProgrammeId: string,
): Promise<EnrolmentBlockUnlock[]> {
  const id = apprenticeProgrammeId.trim();
  if (!id) return [];
  const { data, error } = await supabase
    .from("gta_enrolment_block_unlocks")
    .select(
      "id, apprentice_programme_id, spine_item_id, unlocked_by, unlocked_by_name, unlocked_at, reason, created_at, updated_at",
    )
    .eq("apprentice_programme_id", id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(rowToRecord);
}

export async function createEnrolmentBlockUnlock(
  supabase: SupabaseClient,
  input: CreateEnrolmentBlockUnlockInput,
): Promise<EnrolmentBlockUnlock> {
  const enrolmentId = input.apprenticeProgrammeId.trim();
  const spineItemId = input.spineItemId.trim();
  const reason = input.reason.trim();
  if (!enrolmentId) throw new Error("apprenticeProgrammeId is required.");
  if (!spineItemId) throw new Error("spineItemId is required.");
  if (!reason) throw new Error("reason is required.");

  const { data, error } = await supabase
    .from("gta_enrolment_block_unlocks")
    .upsert(
      {
        apprentice_programme_id: enrolmentId,
        spine_item_id: spineItemId,
        unlocked_by: input.unlockedBy,
        unlocked_by_name: input.unlockedByName.trim() || "Staff",
        unlocked_at: new Date().toISOString(),
        reason,
      },
      { onConflict: "apprentice_programme_id,spine_item_id" },
    )
    .select(
      "id, apprentice_programme_id, spine_item_id, unlocked_by, unlocked_by_name, unlocked_at, reason, created_at, updated_at",
    )
    .single();
  if (error) throw new Error(error.message);
  return rowToRecord(data as Row);
}
