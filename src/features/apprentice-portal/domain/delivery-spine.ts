import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import type { DeliverySpine } from "@/features/administration/domain/cohort-products";
import { normalizeDeliverySpine } from "@/features/administration/domain/cohort-products";

export type ApprenticeDeliveryContext = {
  deliverySpine: DeliverySpine;
  standardVersion: string | null;
  cohortId: string | null;
  cohortName: string | null;
  /** Enrolment pin — authoritative GTA programme version for blocks delivery. */
  gtaProgrammeVersionId: string | null;
};

const DEFAULT_CONTEXT: ApprenticeDeliveryContext = {
  deliverySpine: "groups",
  standardVersion: null,
  cohortId: null,
  cohortName: null,
  gtaProgrammeVersionId: null,
};

/**
 * Resolve the signed-in apprentice's cohort product spine + enrolment pin.
 * Never invents a programme version when the pin is missing.
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
      .select("id, name, standard_version, delivery_spine")
      .eq("id", cohortId)
      .maybeSingle();

    if (!cohort) {
      return { ...DEFAULT_CONTEXT, gtaProgrammeVersionId };
    }

    return {
      deliverySpine: normalizeDeliverySpine(cohort.delivery_spine),
      standardVersion: cohort.standard_version?.trim() || null,
      cohortId: cohort.id,
      cohortName: cohort.name?.trim() || null,
      gtaProgrammeVersionId,
    };
  } catch {
    return DEFAULT_CONTEXT;
  }
}

