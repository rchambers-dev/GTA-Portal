import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import {
  APPRENTICE_PLACEMENT_COLUMNS,
  EMPLOYER_COLUMNS,
  EMPLOYER_MANAGER_COLUMNS,
  EMPLOYER_SITE_COLUMNS,
  LAST_SITE_MESSAGE,
  assembleEmployers,
  canDeactivateSite,
  employerFromRow,
  explainEmployerWriteError,
  isAssignedEmployerId,
  isRecordId,
  mapEmployerManager,
  mapEmployerSite,
  toManagerInsert,
  toSiteInsert,
  type ApprenticeNameRow,
  type ApprenticePlacementRow,
  type EmployerListItem,
  type EmployerManager,
  type EmployerManagerRow,
  type EmployerMutationResult,
  type EmployerRow,
  type EmployerSite,
  type EmployerSiteRow,
  type ValidatedManager,
  type ValidatedSite,
} from "./employer-record";

export type EmployersPageData = {
  employers: EmployerListItem[];
  loadError: string | null;
};

/**
 * Reads employers, sites, managers, and current placements with the signed-in
 * user's session. RLS decides what comes back. The service role is not used.
 */
export async function loadEmployersPage(): Promise<EmployersPageData> {
  const supabase = await createSupabaseServerClient();
  const [employersResult, sitesResult, managersResult, placementsResult] = await Promise.all([
    supabase.from("employers").select(EMPLOYER_COLUMNS).order("company_name", { ascending: true }),
    supabase.from("employer_sites").select(EMPLOYER_SITE_COLUMNS),
    supabase.from("employer_managers").select(EMPLOYER_MANAGER_COLUMNS),
    supabase.from("apprentice_employments").select(APPRENTICE_PLACEMENT_COLUMNS),
  ]);

  const problems: string[] = [];
  if (employersResult.error) {
    problems.push(`Employers could not be loaded. ${employersResult.error.message}`);
  }
  if (sitesResult.error) {
    problems.push(`Sites could not be loaded. ${sitesResult.error.message}`);
  }
  if (managersResult.error) {
    problems.push(`Managers could not be loaded. ${managersResult.error.message}`);
  }
  if (placementsResult.error) {
    problems.push(`Apprentices could not be loaded. ${placementsResult.error.message}`);
  }

  const placements = placementsResult.error
    ? []
    : ((placementsResult.data ?? []) as ApprenticePlacementRow[]);
  const gtaIds = [...new Set(placements.map((row) => row.gta_id))];
  const namesResult =
    gtaIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("apprentices")
          .select("gta_id, first_name, middle_names, last_name, status")
          .in("gta_id", gtaIds);

  if (namesResult.error) {
    problems.push(`Apprentice names could not be loaded. ${namesResult.error.message}`);
  }

  return {
    employers: assembleEmployers(
      (employersResult.data ?? []) as EmployerRow[],
      (sitesResult.data ?? []) as EmployerSiteRow[],
      (managersResult.data ?? []) as EmployerManagerRow[],
      placements,
      (namesResult.data ?? []) as ApprenticeNameRow[],
    ),
    loadError: problems.length > 0 ? problems.join(" ") : null,
  };
}

/**
 * Creates the employer and its first site together.
 * create_employer_with_site assigns the employer ID and satisfies the
 * deferred rule that every employer has a site.
 */
export async function createEmployerWithSiteRecord(
  supabase: SupabaseClient,
  companyName: string,
  site: ValidatedSite,
): Promise<EmployerMutationResult<EmployerListItem>> {
  const { data, error } = await supabase.rpc("create_employer_with_site", {
    p_company_name: companyName,
    p_postcode: site.postcode,
    p_area_name: site.areaName,
  });

  if (error) return readBackOrExplain(error, "employer");
  const employerId = typeof data === "string" ? data.trim() : "";
  if (!isAssignedEmployerId(employerId)) {
    return {
      ok: false,
      fieldErrors: {},
      formError: employerId
        ? `The database returned “${employerId}”, which is not a GTA-EMP-NNNNNN ID.`
        : "The employer could not be saved. The database did not return an employer ID.",
    };
  }

  const [employerResult, siteResult] = await Promise.all([
    supabase.from("employers").select(EMPLOYER_COLUMNS).eq("employer_id", employerId).single(),
    supabase.from("employer_sites").select(EMPLOYER_SITE_COLUMNS).eq("employer_id", employerId),
  ]);

  if (employerResult.error) return readBackOrExplain(employerResult.error, "employer");
  if (siteResult.error) return readBackOrExplain(siteResult.error, "site");
  const row = employerResult.data as EmployerRow | null;
  const siteRows = (siteResult.data ?? []) as EmployerSiteRow[];
  if (!row) {
    return missing("The employer could not be saved. Refresh the list.");
  }
  return { ok: true, value: employerFromRow(row, siteRows.map(mapEmployerSite)) };
}

export async function renameEmployerRecord(
  supabase: SupabaseClient,
  employerId: string,
  companyName: string,
): Promise<EmployerMutationResult<{ employerId: string; companyName: string }>> {
  if (!isAssignedEmployerId(employerId)) {
    return missing("That employer could not be found. Refresh the list.");
  }
  const { data, error } = await supabase
    .from("employers")
    .update({ company_name: companyName })
    .eq("employer_id", employerId)
    .select(EMPLOYER_COLUMNS)
    .single();

  if (error) return readBackOrExplain(error, "employer");
  const row = data as EmployerRow | null;
  if (!row) return missing("That employer could not be saved. Refresh the list.");
  return { ok: true, value: { employerId: row.employer_id, companyName: row.company_name } };
}

export async function insertEmployerSiteRecord(
  supabase: SupabaseClient,
  employerId: string,
  value: ValidatedSite,
): Promise<EmployerMutationResult<EmployerSite>> {
  if (!isAssignedEmployerId(employerId)) {
    return missing("That employer could not be found. Refresh the list.");
  }
  const { data, error } = await supabase
    .from("employer_sites")
    .insert(toSiteInsert(employerId, value))
    .select(EMPLOYER_SITE_COLUMNS)
    .single();

  if (error) return readBackOrExplain(error, "site");
  const row = data as EmployerSiteRow | null;
  if (!row) return missing("The site could not be saved. Refresh the list.");
  return { ok: true, value: mapEmployerSite(row) };
}

export async function updateEmployerSiteRecord(
  supabase: SupabaseClient,
  employerId: string,
  siteId: string,
  value: ValidatedSite,
): Promise<EmployerMutationResult<EmployerSite>> {
  if (!isAssignedEmployerId(employerId) || !isRecordId(siteId)) {
    return missing("That site could not be found. Refresh the list.");
  }
  const { data, error } = await supabase
    .from("employer_sites")
    .update({
      postcode: value.postcode,
      area_name: value.areaName,
    })
    .eq("id", siteId)
    .eq("employer_id", employerId)
    .select(EMPLOYER_SITE_COLUMNS)
    .single();

  if (error) return readBackOrExplain(error, "site");
  const row = data as EmployerSiteRow | null;
  if (!row) return missing("The site could not be saved. Refresh the list.");
  return { ok: true, value: mapEmployerSite(row) };
}

export async function setEmployerSiteActiveRecord(
  supabase: SupabaseClient,
  employerId: string,
  siteId: string,
  isActive: boolean,
): Promise<EmployerMutationResult<EmployerSite>> {
  if (!isAssignedEmployerId(employerId) || !isRecordId(siteId)) {
    return missing("That site could not be found. Refresh the list.");
  }
  if (!isActive) {
    const { data, error } = await supabase
      .from("employer_sites")
      .select("id, is_active")
      .eq("employer_id", employerId);
    if (error) return readBackOrExplain(error, "site");
    const sites = ((data ?? []) as { id: string; is_active: boolean }[]).map((row) => ({
      id: row.id,
      isActive: row.is_active,
    }));
    if (!sites.some((site) => site.id === siteId)) {
      return missing("That site could not be found. Refresh the list.");
    }
    if (!canDeactivateSite(sites, siteId)) {
      return { ok: false, fieldErrors: {}, formError: LAST_SITE_MESSAGE };
    }
  }

  const { data, error } = await supabase
    .from("employer_sites")
    .update({ is_active: isActive })
    .eq("id", siteId)
    .eq("employer_id", employerId)
    .select(EMPLOYER_SITE_COLUMNS)
    .single();

  if (error) return readBackOrExplain(error, "site");
  const row = data as EmployerSiteRow | null;
  if (!row) return missing("That site could not be updated. Refresh the list.");
  return { ok: true, value: mapEmployerSite(row) };
}

export async function insertEmployerManagerRecord(
  supabase: SupabaseClient,
  employerId: string,
  value: ValidatedManager,
): Promise<EmployerMutationResult<EmployerManager>> {
  if (!isAssignedEmployerId(employerId)) {
    return missing("That employer could not be found. Refresh the list.");
  }
  const siteCheck = await assertManagerSite(supabase, employerId, value.siteId);
  if (!siteCheck.ok) return siteCheck;

  const { data, error } = await supabase
    .from("employer_managers")
    .insert(toManagerInsert(employerId, value))
    .select(EMPLOYER_MANAGER_COLUMNS)
    .single();

  if (error) return readBackOrExplain(error, "manager");
  const row = data as EmployerManagerRow | null;
  if (!row) return missing("The manager could not be saved. Refresh the list.");
  return { ok: true, value: mapEmployerManager(row) };
}

export async function updateEmployerManagerRecord(
  supabase: SupabaseClient,
  employerId: string,
  managerId: string,
  value: ValidatedManager,
): Promise<EmployerMutationResult<EmployerManager>> {
  if (!isAssignedEmployerId(employerId) || !isRecordId(managerId)) {
    return missing("That manager could not be found. Refresh the list.");
  }
  const siteCheck = await assertManagerSite(supabase, employerId, value.siteId);
  if (!siteCheck.ok) return siteCheck;

  const { data, error } = await supabase
    .from("employer_managers")
    .update({
      first_name: value.firstName,
      middle_names: value.middleNames,
      last_name: value.lastName,
      phone: value.phone,
      email: value.email,
      site_id: value.siteId,
    })
    .eq("id", managerId)
    .eq("employer_id", employerId)
    .select(EMPLOYER_MANAGER_COLUMNS)
    .single();

  if (error) return readBackOrExplain(error, "manager");
  const row = data as EmployerManagerRow | null;
  if (!row) return missing("The manager could not be saved. Refresh the list.");
  return { ok: true, value: mapEmployerManager(row) };
}

export async function deleteEmployerManagerRecord(
  supabase: SupabaseClient,
  managerId: string,
): Promise<EmployerMutationResult<{ managerId: string }>> {
  if (!isRecordId(managerId)) return missing("That manager could not be found. Refresh the list.");
  const { data, error } = await supabase
    .from("employer_managers")
    .delete()
    .eq("id", managerId)
    .select("id");

  if (error) return readBackOrExplain(error, "manager");
  const removed = (data ?? []) as { id: string }[];
  if (removed.length === 0) return missing("That manager could not be removed. Refresh the list.");
  return { ok: true, value: { managerId } };
}

async function assertManagerSite(
  supabase: SupabaseClient,
  employerId: string,
  siteId: string | null,
): Promise<EmployerMutationResult<null>> {
  if (!siteId) return { ok: true, value: null };
  const { data, error } = await supabase
    .from("employer_sites")
    .select("id, employer_id")
    .eq("id", siteId)
    .maybeSingle();

  if (error) return readBackOrExplain(error, "site");
  const site = data as { id: string; employer_id: string } | null;
  if (!site || site.employer_id !== employerId) {
    return {
      ok: false,
      fieldErrors: { siteId: "Choose one of this employer's sites." },
      formError: null,
    };
  }
  return { ok: true, value: null };
}

function missing(formError: string): EmployerMutationResult<never> {
  return { ok: false, fieldErrors: {}, formError };
}

function readBackOrExplain(
  error: { code?: string; message?: string; details?: string },
  noun: "employer" | "site" | "manager",
): EmployerMutationResult<never> {
  if (error.code === "PGRST116") {
    return {
      ok: false,
      fieldErrors: {},
      formError: `The ${noun} may have been saved, but it could not be read back. Refresh the list before trying again.`,
    };
  }
  const explained = explainEmployerWriteError(error);
  return { ok: false, ...explained };
}
