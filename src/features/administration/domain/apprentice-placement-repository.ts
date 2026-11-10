import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { isAssignedGtaId } from "./apprentice-record";
import { normaliseGtaId } from "./apprentice-tutor";
import {
  EMPLOYER_MANAGER_COLUMNS,
  EMPLOYER_SITE_COLUMNS,
  formatManagerName,
  mapEmployerManager,
  mapEmployerSite,
  sortManagers,
  sortSites,
  type EmployerManager,
  type EmployerManagerRow,
  type EmployerSite,
  type EmployerSiteRow,
} from "./employer-record";
import {
  explainPlacementError,
  validatePlacementChange,
  validatePlacementEnd,
  validatePlacementStart,
  type ApprenticePlacementPage,
  type PlacementActionResult,
  type PlacementDetail,
  type PlacementEmployerOption,
  type ValidatedPlacementEnd,
  type ValidatedPlacementStart,
} from "./apprentice-placement";

const EMPLOYMENT_COLUMNS =
  "id, gta_id, employer_id, site_id, manager_id, start_date, end_date, end_reason";

type EmploymentRow = {
  id: string;
  gta_id: string;
  employer_id: string;
  site_id: string;
  manager_id: string;
  start_date: string;
  end_date: string | null;
  end_reason: string | null;
};

type EmployerNameRow = {
  employer_id: string;
  company_name: string;
};

type OpenRow = {
  id: string;
  gta_id: string;
  start_date: string;
  end_date: string | null;
};

type QueryError = { message: string; code?: string; details?: string };

function emptyPage(loadError: string | null): ApprenticePlacementPage {
  return { current: [], history: [], employers: [], loadError };
}

async function rowsIn<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  column: string,
  ids: readonly string[],
): Promise<{ data: T[]; error: QueryError | null }> {
  if (ids.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.from(table).select(columns).in(column, [...ids]);
  return { data: (data ?? []) as T[], error };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function detailFrom(
  row: EmploymentRow,
  employers: Map<string, EmployerNameRow>,
  sites: Map<string, EmployerSite>,
  managers: Map<string, EmployerManager>,
): PlacementDetail {
  const employer = employers.get(row.employer_id);
  const site = sites.get(row.site_id);
  const manager = managers.get(row.manager_id);
  const managerSite = manager?.siteId ? sites.get(manager.siteId) : undefined;
  return {
    id: row.id,
    employerId: row.employer_id,
    companyName: employer?.company_name?.trim() ?? "",
    employerFound: Boolean(employer),
    siteId: row.site_id,
    siteName: site?.siteName ?? null,
    siteFound: Boolean(site),
    postcode: site?.postcode ?? null,
    areaName: site?.areaName ?? null,
    managerId: row.manager_id,
    managerName: manager ? formatManagerName(manager) : "",
    managerFound: Boolean(manager),
    managerSiteId: manager ? manager.siteId : null,
    managerSiteFound: Boolean(manager?.siteId && managerSite),
    managerSiteName: managerSite?.siteName ?? null,
    managerSitePostcode: managerSite?.postcode ?? null,
    email: manager?.email?.trim() || null,
    phone: manager?.phone?.trim() || null,
    startDate: row.start_date,
    endDate: row.end_date,
    endReason: row.end_reason?.trim() || null,
  };
}

function employerOptions(
  employers: readonly EmployerNameRow[],
  sites: readonly EmployerSiteRow[],
  managers: readonly EmployerManagerRow[],
): PlacementEmployerOption[] {
  return [...employers]
    .sort((a, b) => a.company_name.localeCompare(b.company_name, "en", { sensitivity: "base" }))
    .map((employer) => ({
      employerId: employer.employer_id,
      companyName: employer.company_name,
      sites: sortSites(
        sites.filter((site) => site.employer_id === employer.employer_id).map(mapEmployerSite),
      ),
      managers: sortManagers(
        managers
          .filter((manager) => manager.employer_id === employer.employer_id)
          .map(mapEmployerManager),
      ),
    }));
}

function splitDetails(rows: readonly PlacementDetail[]): Pick<ApprenticePlacementPage, "current" | "history"> {
  const current = rows
    .filter((row) => row.endDate === null)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id.localeCompare(a.id));
  const history = rows
    .filter((row) => row.endDate !== null)
    .sort(
      (a, b) =>
        (b.endDate ?? "").localeCompare(a.endDate ?? "") ||
        b.startDate.localeCompare(a.startDate) ||
        b.id.localeCompare(a.id),
    );
  return { current, history };
}

/**
 * Reads one learner's placements. Administrator and Management also receive
 * every employer, site, and manager so they can start or change a placement.
 * Tutors receive only the rows for this learner.
 */
export async function readApprenticePlacements(
  supabase: SupabaseClient,
  rawGtaId: string,
  options: { canManage: boolean },
): Promise<ApprenticePlacementPage> {
  const requestedId = normaliseGtaId(rawGtaId);
  if (!isAssignedGtaId(requestedId)) {
    return emptyPage("GTA IDs look like GTA-000002.");
  }

  const employmentPromise = supabase
    .from("apprentice_employments")
    .select(EMPLOYMENT_COLUMNS)
    .eq("gta_id", requestedId);
  const cataloguePromise = options.canManage
    ? Promise.all([
        supabase.from("employers").select("employer_id, company_name"),
        supabase.from("employer_sites").select(EMPLOYER_SITE_COLUMNS),
        supabase.from("employer_managers").select(EMPLOYER_MANAGER_COLUMNS),
      ])
    : Promise.resolve(null);

  const [employmentResult, catalogue] = await Promise.all([employmentPromise, cataloguePromise]);
  if (employmentResult.error) {
    return emptyPage(`Placements could not be loaded. ${employmentResult.error.message}`);
  }
  const employmentRows = (employmentResult.data ?? []) as EmploymentRow[];

  let employerRows: EmployerNameRow[] = [];
  let siteRows: EmployerSiteRow[] = [];
  let managerRows: EmployerManagerRow[] = [];
  const problems: string[] = [];

  if (catalogue) {
    const [employersResult, sitesResult, managersResult] = catalogue;
    if (employersResult.error) problems.push(`Employers could not be loaded. ${employersResult.error.message}`);
    if (sitesResult.error) problems.push(`Sites could not be loaded. ${sitesResult.error.message}`);
    if (managersResult.error) problems.push(`Managers could not be loaded. ${managersResult.error.message}`);
    employerRows = (employersResult.data ?? []) as EmployerNameRow[];
    siteRows = (sitesResult.data ?? []) as EmployerSiteRow[];
    managerRows = (managersResult.data ?? []) as EmployerManagerRow[];
  } else {
    const [employersResult, sitesResult, managersResult] = await Promise.all([
      rowsIn<EmployerNameRow>(
        supabase,
        "employers",
        "employer_id, company_name",
        "employer_id",
        unique(employmentRows.map((row) => row.employer_id)),
      ),
      rowsIn<EmployerSiteRow>(
        supabase,
        "employer_sites",
        EMPLOYER_SITE_COLUMNS,
        "employer_id",
        unique(employmentRows.map((row) => row.employer_id)),
      ),
      rowsIn<EmployerManagerRow>(
        supabase,
        "employer_managers",
        EMPLOYER_MANAGER_COLUMNS,
        "id",
        unique(employmentRows.map((row) => row.manager_id)),
      ),
    ]);
    if (employersResult.error) problems.push(`Employers could not be loaded. ${employersResult.error.message}`);
    if (sitesResult.error) problems.push(`Sites could not be loaded. ${sitesResult.error.message}`);
    if (managersResult.error) problems.push(`Managers could not be loaded. ${managersResult.error.message}`);
    employerRows = employersResult.data;
    siteRows = sitesResult.data;
    managerRows = managersResult.data;
  }

  const employers = new Map(employerRows.map((row) => [row.employer_id, row]));
  const sites = new Map(siteRows.map((row) => [row.id, mapEmployerSite(row)]));
  const managers = new Map(managerRows.map((row) => [row.id, mapEmployerManager(row)]));
  const details = employmentRows.map((row) => detailFrom(row, employers, sites, managers));

  return {
    ...splitDetails(details),
    employers: options.canManage ? employerOptions(employerRows, siteRows, managerRows) : [],
    loadError: problems.length > 0 ? problems.join(" ") : null,
  };
}

export async function loadApprenticePlacements(
  rawGtaId: string,
  options: { canManage: boolean },
): Promise<ApprenticePlacementPage> {
  const requestedId = normaliseGtaId(rawGtaId);
  if (!isAssignedGtaId(requestedId)) return emptyPage("GTA IDs look like GTA-000002.");
  const supabase = await createSupabaseServerClient();
  return readApprenticePlacements(supabase, requestedId, options);
}

async function loadOpenPlacement(
  supabase: SupabaseClient,
  employmentId: string,
): Promise<{ ok: true; row: OpenRow } | { ok: false; formError: string }> {
  const { data, error } = await supabase
    .from("apprentice_employments")
    .select("id, gta_id, start_date, end_date")
    .eq("id", employmentId)
    .maybeSingle();
  if (error) return { ok: false, formError: explainPlacementError(error) };
  if (!data) return { ok: false, formError: "This placement could not be found. Refresh the page." };
  const row = data as OpenRow;
  if (row.end_date) {
    return { ok: false, formError: "This placement has already ended. Refresh the page." };
  }
  return { ok: true, row };
}

async function insertPlacement(
  supabase: SupabaseClient,
  value: ValidatedPlacementStart,
): Promise<PlacementActionResult> {
  const { error } = await supabase.from("apprentice_employments").insert({
    gta_id: value.gtaId,
    employer_id: value.employerId,
    site_id: value.siteId,
    manager_id: value.managerId,
    start_date: value.startDate,
  });
  if (error) return { ok: false, formError: explainPlacementError(error) };
  return { ok: true };
}

export async function endApprenticePlacement(
  supabase: SupabaseClient,
  input: { employmentId: string; endDate: string; endReason: string },
): Promise<PlacementActionResult> {
  const open = await loadOpenPlacement(supabase, input.employmentId.trim());
  if (!open.ok) return open;
  const parsed = validatePlacementEnd({ ...input, currentStart: open.row.start_date });
  if (!parsed.ok) return parsed;
  return closePlacement(supabase, parsed.value);
}

export async function startApprenticePlacement(
  supabase: SupabaseClient,
  input: {
    gtaId: string;
    employerId: string;
    siteId: string;
    managerId: string;
    startDate: string;
  },
): Promise<PlacementActionResult> {
  const parsed = validatePlacementStart(input);
  if (!parsed.ok) return parsed;
  const existing = await supabase
    .from("apprentice_employments")
    .select("id")
    .eq("gta_id", parsed.value.gtaId)
    .is("end_date", null);
  if (existing.error) return { ok: false, formError: explainPlacementError(existing.error) };
  if ((existing.data ?? []).length > 0) {
    return {
      ok: false,
      formError: "This apprentice already has a current placement. Refresh the page and try again.",
    };
  }
  return insertPlacement(supabase, parsed.value);
}

/**
 * Ends the current row, then inserts the next one. If the insert fails, the
 * closed row is reopened so the learner is not left without the placement
 * they still have.
 */
export async function changeApprenticePlacement(
  supabase: SupabaseClient,
  input: {
    employmentId: string;
    endDate: string;
    endReason: string;
    employerId: string;
    siteId: string;
    managerId: string;
    startDate: string;
  },
): Promise<PlacementActionResult> {
  const open = await loadOpenPlacement(supabase, input.employmentId.trim());
  if (!open.ok) return open;
  const parsed = validatePlacementChange({
    ...input,
    gtaId: open.row.gta_id,
    currentStart: open.row.start_date,
  });
  if (!parsed.ok) return parsed;

  const closed = await closePlacement(supabase, parsed.value);
  if (!closed.ok) return closed;

  const inserted = await insertPlacement(supabase, {
    gtaId: open.row.gta_id,
    employerId: parsed.value.employerId,
    siteId: parsed.value.siteId,
    managerId: parsed.value.managerId,
    startDate: parsed.value.startDate,
  });
  if (inserted.ok) return inserted;

  const { error: restoreError } = await supabase
    .from("apprentice_employments")
    .update({ end_date: null, end_reason: null })
    .eq("id", parsed.value.employmentId)
    .eq("end_date", parsed.value.endDate);
  if (restoreError) {
    return {
      ok: false,
      formError: `${inserted.formError} The previous placement could not be restored. ${explainPlacementError(restoreError)}`,
    };
  }
  return inserted;
}

async function closePlacement(
  supabase: SupabaseClient,
  value: ValidatedPlacementEnd,
): Promise<PlacementActionResult> {
  const { data, error } = await supabase
    .from("apprentice_employments")
    .update({ end_date: value.endDate, end_reason: value.endReason })
    .eq("id", value.employmentId)
    .is("end_date", null)
    .select("id");
  if (error) return { ok: false, formError: explainPlacementError(error) };
  if (!data || data.length === 0) {
    return {
      ok: false,
      formError: "This placement changed while it was saving. Refresh the page and try again.",
    };
  }
  return { ok: true };
}
