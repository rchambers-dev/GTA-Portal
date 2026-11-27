import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { londonToday } from "@/features/administration/domain/apprentice-tutor";
import {
  canReadAllLearnerConcerns,
  concernGtaIdsForReader,
  tutorCountsForConcerns,
  visibleConcerns,
} from "./concern-access";

export type LearnerConcernRow = {
  id: string;
  gta_id: string;
  resolved_on: string | null;
};

/** Concerns this signed-in reader is allowed to see. The database function also writes the read audit. */
export async function loadVisibleLearnerConcerns(
  supabase: SupabaseClient,
): Promise<{ data: LearnerConcernRow[]; error: { message: string } | null }> {
  const session = await getSupabaseEffectiveSession();
  const [result, profile, links] = await Promise.all([
    supabase.rpc("get_learner_concerns", { p_gta_id: null }),
    session
      ? supabase.from("profiles").select("portal_status, archived_at").eq("id", session.account.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    session
      ? supabase
          .from("apprentice_tutors")
          .select("apprentice_id")
          .eq("tutor_id", session.account.id)
          .is("end_date", null)
          .lte("start_date", londonToday())
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (result.error) return { data: [], error: result.error };
  const rows = (Array.isArray(result.data) ? result.data : []) as LearnerConcernRow[];
  if (!session) return { data: [], error: null };
  const profileRow = profile.data as { portal_status?: string | null; archived_at?: string | null } | null;
  const allowed = concernGtaIdsForReader({
    canReadAll: canReadAllLearnerConcerns({
      baseRole: session.account.baseRole,
      permissions: session.permissions,
    }),
    tutorCounted: tutorCountsForConcerns({
      portalStatus: profileRow?.portal_status ?? null,
      archivedAt: profileRow?.archived_at ?? null,
    }),
    assignedGtaIds: ((links.data ?? []) as { apprentice_id: string }[]).map((row) => row.apprentice_id),
  });
  return { data: visibleConcerns(rows, allowed), error: null };
}
