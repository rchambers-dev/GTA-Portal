import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ImportedDuty,
  ImportedKsb,
  OfficialStandardVersion,
} from "./types";

type StandardRow = {
  id: string;
  standard_code: string;
  occupation_code: string;
  title: string;
};

type VersionRow = {
  id: string;
  standard_id: string;
  external_version: string;
  level: number;
  status: string;
  typical_duration_months: number | null;
  assessment_period_months: number | null;
  minimum_compliance_hours: number | null;
  maximum_funding_pounds: number | null;
  lars_code: number | null;
  route: string;
  pathway: string;
  cluster_name: string;
  assessment_plan_url: string;
  approved_for_delivery_date: string | null;
  updated_date: string | null;
  apprenticeship_details_complete: boolean;
  occupation_raw_payload: unknown;
  apprenticeship_raw_payload: unknown | null;
  source_hash: string;
  imported_at: string;
  is_current: boolean;
};

export async function findOfficialInDatabase(
  supabase: SupabaseClient,
  args: { occupationCode?: string; standardCode?: string },
): Promise<OfficialStandardVersion | null> {
  const occupationCode = args.occupationCode?.trim().toUpperCase() || "";
  const standardCode = args.standardCode?.trim().toUpperCase() || "";

  let standardQuery = supabase.from("se_standards").select("*");
  if (standardCode) {
    standardQuery = standardQuery.eq("standard_code", standardCode);
  } else if (occupationCode) {
    standardQuery = standardQuery.eq("occupation_code", occupationCode);
  } else {
    return null;
  }

  const { data: standard, error: standardError } = await standardQuery
    .limit(1)
    .maybeSingle();
  if (standardError) throw new Error(standardError.message);
  if (!standard) return null;

  const { data: version, error: versionError } = await supabase
    .from("se_standard_versions")
    .select("*")
    .eq("standard_id", standard.id)
    .order("is_current", { ascending: false })
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw new Error(versionError.message);
  if (!version) return null;

  return hydrateOfficial(supabase, standard as StandardRow, version as VersionRow);
}

async function hydrateOfficial(
  supabase: SupabaseClient,
  standard: StandardRow,
  version: VersionRow,
): Promise<OfficialStandardVersion> {
  const { data: duties, error: dutiesError } = await supabase
    .from("se_duties")
    .select("id, duty_code, description")
    .eq("standard_version_id", version.id);
  if (dutiesError) throw new Error(dutiesError.message);

  const { data: ksbs, error: ksbsError } = await supabase
    .from("se_ksbs")
    .select("id, ksb_code, ksb_type, description")
    .eq("standard_version_id", version.id);
  if (ksbsError) throw new Error(ksbsError.message);

  const dutyIds = (duties ?? []).map((d) => d.id);
  const ksbById = new Map((ksbs ?? []).map((k) => [k.id, k]));
  const mappingsByDuty = new Map<string, string[]>();

  if (dutyIds.length > 0) {
    const { data: maps, error: mapsError } = await supabase
      .from("se_duty_ksb_mappings")
      .select("duty_id, ksb_id")
      .in("duty_id", dutyIds);
    if (mapsError) throw new Error(mapsError.message);
    for (const row of maps ?? []) {
      const ksb = ksbById.get(row.ksb_id);
      if (!ksb) continue;
      const list = mappingsByDuty.get(row.duty_id) ?? [];
      list.push(String(ksb.ksb_code).toUpperCase());
      mappingsByDuty.set(row.duty_id, list);
    }
  }

  const importedDuties: ImportedDuty[] = (duties ?? []).map((d) => ({
    code: d.duty_code,
    description: d.description ?? "",
    mappedKsbCodes: mappingsByDuty.get(d.id) ?? [],
  }));

  const importedKsbs: ImportedKsb[] = (ksbs ?? []).map((k) => ({
    code: String(k.ksb_code).toUpperCase(),
    type:
      k.ksb_type === "skill" || k.ksb_type === "behaviour"
        ? k.ksb_type
        : "knowledge",
    description: k.description ?? "",
  }));

  return {
    id: version.id,
    standardCode: standard.standard_code,
    occupationCode: standard.occupation_code,
    title: standard.title || "",
    externalVersion: version.external_version,
    level: version.level,
    status: version.status,
    typicalDurationMonths: version.typical_duration_months,
    assessmentPeriodMonths: version.assessment_period_months,
    minimumComplianceHours: version.minimum_compliance_hours,
    maximumFundingPounds: version.maximum_funding_pounds,
    larsCode: version.lars_code,
    route: version.route ?? "",
    pathway: version.pathway ?? "",
    cluster: version.cluster_name ?? "",
    assessmentPlanUrl: version.assessment_plan_url ?? "",
    approvedForDeliveryDate: version.approved_for_delivery_date,
    updatedDate: version.updated_date,
    apprenticeshipDetailsComplete: version.apprenticeship_details_complete,
    duties: importedDuties,
    ksbs: importedKsbs,
    linkedProducts: [],
    occupationRawPayload: version.occupation_raw_payload ?? {},
    apprenticeshipRawPayload: version.apprenticeship_raw_payload,
    sourceHash: version.source_hash,
    importedAt: version.imported_at,
    locked: true,
  };
}

export async function saveOfficialToDatabase(
  supabase: SupabaseClient,
  official: OfficialStandardVersion,
): Promise<OfficialStandardVersion> {
  const existing = await findOfficialInDatabase(supabase, {
    standardCode: official.standardCode,
    occupationCode: official.occupationCode,
  });
  if (
    existing &&
    existing.externalVersion === official.externalVersion
  ) {
    // Never duplicate an already-stored version.
    return existing;
  }

  const { data: standardUpsert, error: standardError } = await supabase
    .from("se_standards")
    .upsert(
      {
        standard_code: official.standardCode,
        occupation_code: official.occupationCode,
        title: official.title,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "standard_code" },
    )
    .select("*")
    .single();
  if (standardError) throw new Error(standardError.message);

  // Clear current flag on older versions of this standard.
  await supabase
    .from("se_standard_versions")
    .update({ is_current: false })
    .eq("standard_id", standardUpsert.id);

  const { data: versionInsert, error: versionError } = await supabase
    .from("se_standard_versions")
    .insert({
      standard_id: standardUpsert.id,
      external_version: official.externalVersion,
      level: official.level,
      status: official.status,
      typical_duration_months: official.typicalDurationMonths,
      assessment_period_months: official.assessmentPeriodMonths,
      minimum_compliance_hours: official.minimumComplianceHours,
      maximum_funding_pounds: official.maximumFundingPounds,
      lars_code: official.larsCode,
      route: official.route,
      pathway: official.pathway,
      cluster_name: official.cluster,
      assessment_plan_url: official.assessmentPlanUrl,
      approved_for_delivery_date: official.approvedForDeliveryDate,
      updated_date: official.updatedDate,
      apprenticeship_details_complete: official.apprenticeshipDetailsComplete,
      occupation_raw_payload: official.occupationRawPayload ?? {},
      apprenticeship_raw_payload: official.apprenticeshipRawPayload,
      source_hash: official.sourceHash,
      imported_at: official.importedAt,
      is_current: true,
    })
    .select("*")
    .single();

  if (versionError) {
    // Unique conflict → return existing version instead of duplicating.
    if (versionError.code === "23505") {
      const again = await findOfficialInDatabase(supabase, {
        standardCode: official.standardCode,
      });
      if (again) return again;
    }
    throw new Error(versionError.message);
  }

  const dutyRows = official.duties.map((d) => ({
    standard_version_id: versionInsert.id,
    duty_code: d.code,
    description: d.description,
  }));
  const { data: savedDuties, error: dutyError } = await supabase
    .from("se_duties")
    .insert(dutyRows)
    .select("id, duty_code");
  if (dutyError) throw new Error(dutyError.message);

  const ksbRows = official.ksbs.map((k) => ({
    standard_version_id: versionInsert.id,
    ksb_code: k.code,
    ksb_type: k.type,
    description: k.description,
  }));
  const { data: savedKsbs, error: ksbError } = await supabase
    .from("se_ksbs")
    .insert(ksbRows)
    .select("id, ksb_code");
  if (ksbError) throw new Error(ksbError.message);

  const dutyIdByCode = new Map(
    (savedDuties ?? []).map((d) => [String(d.duty_code).toUpperCase(), d.id]),
  );
  const ksbIdByCode = new Map(
    (savedKsbs ?? []).map((k) => [String(k.ksb_code).toUpperCase(), k.id]),
  );

  const mappingRows: Array<{ duty_id: string; ksb_id: string }> = [];
  for (const duty of official.duties) {
    const dutyId = dutyIdByCode.get(duty.code.toUpperCase());
    if (!dutyId) continue;
    for (const code of duty.mappedKsbCodes) {
      const ksbId = ksbIdByCode.get(code.toUpperCase());
      if (!ksbId) continue;
      mappingRows.push({ duty_id: dutyId, ksb_id: ksbId });
    }
  }
  if (mappingRows.length > 0) {
    const { error: mapError } = await supabase
      .from("se_duty_ksb_mappings")
      .insert(mappingRows);
    if (mapError) throw new Error(mapError.message);
  }

  return {
    ...official,
    id: versionInsert.id,
  };
}
