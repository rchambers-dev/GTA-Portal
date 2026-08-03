import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import type { DeliverySpine } from "@/features/administration/domain/cohort-products";
import { normalizeDeliverySpine } from "@/features/administration/domain/cohort-products";

export type ApprenticeDeliveryContext = {
  deliverySpine: DeliverySpine;
  standardVersion: string | null;
  cohortId: string | null;
  cohortName: string | null;
};

const DEFAULT_CONTEXT: ApprenticeDeliveryContext = {
  deliverySpine: "groups",
  standardVersion: null,
  cohortId: null,
  cohortName: null,
};

/**
 * Resolve the signed-in apprentice's cohort product spine.
 * Existing Autocare intakes default to groups until a blocks cohort is assigned.
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
      .select("cohort_id")
      .eq("apprentice_id", apprenticeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cohortId = enrolment?.cohort_id as string | null | undefined;
    if (!cohortId) return DEFAULT_CONTEXT;

    const { data: cohort } = await supabase
      .from("cohorts")
      .select("id, name, standard_version, delivery_spine")
      .eq("id", cohortId)
      .maybeSingle();

    if (!cohort) return DEFAULT_CONTEXT;

    return {
      deliverySpine: normalizeDeliverySpine(cohort.delivery_spine),
      standardVersion: cohort.standard_version?.trim() || null,
      cohortId: cohort.id,
      cohortName: cohort.name?.trim() || null,
    };
  } catch {
    return DEFAULT_CONTEXT;
  }
}
