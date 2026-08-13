import { createSupabaseAdminClient } from "@/adapters/supabase/client";

export type ApprenticeDeliveryContext = {
  standardVersion: string | null;
  cohortId: string | null;
  cohortName: string | null;
  /** Enrolment pin — authoritative GTA programme version. */
  gtaProgrammeVersionId: string | null;
};

const DEFAULT_CONTEXT: ApprenticeDeliveryContext = {
  standardVersion: null,
  cohortId: null,
  cohortName: null,
  gtaProgrammeVersionId: null,
};

/**
 * Resolve the signed-in apprentice's enrolment pin + optional cohort metadata.
 * Controlled delivery is Blocks/Sessions/Tasks. Missing cohort does not fall
 * back to the retired Groups/CEA runtime.
 */
export async function resolveApprenticeDeliveryContext(
  apprenticeId: string | null | undefined,
): Promise<ApprenticeDeliveryContext> {
  if (!apprenticeId?.trim()) {
    return DEFAULT_CONTEXT;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: enrolment } = await supabase
      .from("apprentice_programmes")
      .select("cohort_id, gta_programme_version_id")
      .eq("apprentice_id", apprenticeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cohortId = enrolment?.cohort_id as string | null | undefined;
    const gtaProgrammeVersionId =
      (enrolment?.gta_programme_version_id as string | null | undefined)?.trim() ||
      null;

    if (!cohortId) {
      return { ...DEFAULT_CONTEXT, gtaProgrammeVersionId };
    }

    const { data: cohort } = await supabase
      .from("cohorts")
      .select("id, name, standard_version")
      .eq("id", cohortId)
      .maybeSingle();

    if (!cohort) {
      return { ...DEFAULT_CONTEXT, gtaProgrammeVersionId };
    }

    return {
      standardVersion: cohort.standard_version?.trim() || null,
      cohortId: cohort.id,
      cohortName: cohort.name?.trim() || null,
      gtaProgrammeVersionId,
    };
  } catch {
    return DEFAULT_CONTEXT;
  }
}
