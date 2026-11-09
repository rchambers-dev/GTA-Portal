import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import {
  EMPLOYER_COLUMNS,
  EMPLOYER_MANAGER_COLUMNS,
  EMPLOYER_SITE_COLUMNS,
  assembleEmployers,
  employerFromRow,
  explainEmployerWriteError,
  isAssignedEmployerId,
  isEmployerArea,
  isRecordId,
  mapEmployerManager,
  mapEmployerSite,
  toEmployerInsert,
  toManagerInsert,
  type EmployerArea,
  type EmployerListItem,
  type EmployerManager,
  type EmployerManagerRow,
  type EmployerMutationResult,
  type EmployerRow,
  type EmployerSite,
  type EmployerSiteRow,
  type ValidatedManager,
} from "./employer-record";

export type EmployersPageData = {
  employers: EmployerListItem[];
  loadError: string | null;
};

/**
 * Reads employers, sites, and managers with the signed-in user's session.
 * RLS decides what comes back. The service role is not used.
 */
export async function loadEmployersPage(): Promise<EmployersPageData> {
  const supabase = await createSupabaseServerClient();
  const [employersResult, sitesResult, managersResult] = await Promise.all([
    supabase.from("employers").select(EMPLOYER_COLUMNS).order("company_name", { ascending: true }),
    supabase.from("employer_sites").select(EMPLOYER_SITE_COLUMNS),
    supabase.from("employer_managers").select(EMPLOYER_MANAGER_COLUMNS),
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

  return {
    employers: assembleEmployers(
      (employersResult.data ?? []) as EmployerRow[],
      (sitesResult.data ?? []) as EmployerSiteRow[],
      (managersResult.data ?? []) as EmployerManagerRow[],
    ),
    loadError: problems.length > 0 ? problems.join(" ") : null,
  };
}

/**
 * Inserts one employer and returns the ID the database assigned.
 * The insert object has no employer_id, so next_employer_id() supplies it.
 */
export async function insertEmployerRecord(
  supabase: SupabaseClient,
  companyName: string,
): Promise<EmployerMutationResult<EmployerListItem>> {
  const { data, error } = await supabase
    .from("employers")
    .insert(toEmployerInsert(companyName))
    .select(EMPLOYER_COLUMNS)
    .single();

  if (error) return readBackOrExplain(error, "employer");
  const row = data as EmployerRow | null;
  const employerId = row?.employer_id?.trim() ?? "";
  if (!row || !employerId) {
    return {
      ok: false,
      fieldErrors: {},
      formError: "The employer could not be saved. The database did not return an employer ID.",
    };
  }
  if (!isAssignedEmployerId(employerId)) {
    return {
      ok: false,
      fieldErrors: {},
      formError: `The database returned “${employerId}”, which is not a GTA-EMP-NNNNNN ID.`,
    };
  }
  return { ok: true, value: employerFromRow(row) };
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
  areaName: EmployerArea,
): Promise<EmployerMutationResult<EmployerSite>> {
  if (!isAssignedEmployerId(employerId)) {
    return missing("That employer could not be found. Refresh the list.");
  }
  const { data, error } = await supabase
    .from("employer_sites")
    .insert({ employer_id: employerId, area_name: areaName })
    .select(EMPLOYER_SITE_COLUMNS)
    .single();

  if (error) return readBackOrExplain(error, "site");
  const row = data as EmployerSiteRow | null;
  if (!row || !isEmployerArea(row.area_name)) {
    return missing("The site could not be saved. Refresh the list.");
  }
  return { ok: true, value: mapEmployerSite(row) };
}

export async function deleteEmployerSiteRecord(
  supabase: SupabaseClient,
  siteId: string,
): Promise<EmployerMutationResult<{ siteId: string }>> {
  if (!isRecordId(siteId)) return missing("That site could not be found. Refresh the list.");
  const { data, error } = await supabase
    .from("employer_sites")
    .delete()
    .eq("id", siteId)
    .select("id");

  if (error) return readBackOrExplain(error, "site");
  const removed = (data ?? []) as { id: string }[];
  if (removed.length === 0) return missing("That site could not be removed. Refresh the list.");
  return { ok: true, value: { siteId } };
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
