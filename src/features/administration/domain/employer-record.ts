/**
 * Shape of public.employers, employer_sites, and employer_managers.
 * The database assigns employer_id. This page never sends one.
 */

import { PERMISSIONS } from "@/lib/permissions/capabilities";

export const EMPLOYER_AREAS = ["Doncaster", "Hull", "Sheffield"] as const;

export type EmployerArea = (typeof EMPLOYER_AREAS)[number];

/** Columns this page reads. employer_id is returned, never written. */
export const EMPLOYER_COLUMNS = "employer_id, company_name, created_at, updated_at";

export const EMPLOYER_SITE_COLUMNS = "id, employer_id, area_name, created_at, updated_at";

export const EMPLOYER_MANAGER_COLUMNS =
  "id, employer_id, site_id, first_name, last_name, phone, email, created_at, updated_at";

const EMPLOYER_ID_PATTERN = /^GTA-EMP-[0-9]{6}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DUPLICATE_COMPANY_NAME =
  "An employer with this company name already exists.";

export const DUPLICATE_SITE = "This employer already has that site.";

export const EMPLOYER_WRITE_PERMISSION =
  "You do not have permission to change employers. Administrator and Management can change employers.";

/** Insert body for public.employers. employer_id is omitted so the column default runs. */
export type EmployerInsert = {
  company_name: string;
};

export type EmployerSite = {
  id: string;
  areaName: string;
};

export type EmployerManager = {
  id: string;
  siteId: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
};

export type EmployerListItem = {
  employerId: string;
  companyName: string;
  createdAt: string;
  updatedAt: string;
  sites: EmployerSite[];
  managers: EmployerManager[];
};

export type EmployerField = keyof EmployerFieldErrors;

export type EmployerFieldErrors = Partial<
  Record<"companyName" | "areaName" | "firstName" | "lastName" | "phone" | "email" | "siteId", string>
>;

export type EmployerMutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: EmployerFieldErrors; formError: string | null };

export type EmployerRow = {
  employer_id: string;
  company_name: string;
  created_at: string;
  updated_at: string;
};

export type EmployerSiteRow = {
  id: string;
  employer_id: string;
  area_name: string;
  created_at: string;
  updated_at: string;
};

export type EmployerManagerRow = {
  id: string;
  employer_id: string;
  site_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type ManagerInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  siteId: string;
};

export type ValidatedManager = {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  siteId: string | null;
};

type PortalActor = {
  account: { baseRole: string };
  permissions: readonly string[];
};

export function isEmployerArea(value: string): value is EmployerArea {
  return (EMPLOYER_AREAS as readonly string[]).includes(value);
}

export function isAssignedEmployerId(value: string): boolean {
  return EMPLOYER_ID_PATTERN.test(value);
}

export function isRecordId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Administrator and Management may change employers. Tutors, and anyone else, may not.
 * The nav uses the same records permission; RLS checks base_role.
 */
export function canManageEmployers(session: PortalActor | null): boolean {
  if (!session) return false;
  const role = session.account.baseRole.trim();
  const roleCanWrite = role === "Administrator" || role === "Management";
  return roleCanWrite && session.permissions.includes(PERMISSIONS.ADMIN_RECORDS_MANAGE);
}

export function validateCompanyName(
  companyName: string,
): { ok: true; companyName: string } | { ok: false; fieldErrors: EmployerFieldErrors } {
  const trimmed = companyName.trim();
  if (!trimmed) {
    return { ok: false, fieldErrors: { companyName: "Enter a company name." } };
  }
  return { ok: true, companyName: trimmed };
}

export function toEmployerInsert(companyName: string): EmployerInsert {
  return { company_name: companyName };
}

export function validateAreaName(
  areaName: string,
): { ok: true; areaName: EmployerArea } | { ok: false; fieldErrors: EmployerFieldErrors } {
  const trimmed = areaName.trim();
  if (!isEmployerArea(trimmed)) {
    return {
      ok: false,
      fieldErrors: { areaName: "Choose Doncaster, Hull, or Sheffield." },
    };
  }
  return { ok: true, areaName: trimmed };
}

export function validateManagerInput(
  input: ManagerInput,
  allowedSiteIds: readonly string[],
): { ok: true; value: ValidatedManager } | { ok: false; fieldErrors: EmployerFieldErrors } {
  const fieldErrors: EmployerFieldErrors = {};
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  const siteId = input.siteId.trim();

  if (!firstName) fieldErrors.firstName = "Enter a first name.";
  if (!lastName) fieldErrors.lastName = "Enter a last name.";
  if (email && !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (siteId && (!isRecordId(siteId) || !allowedSiteIds.includes(siteId))) {
    fieldErrors.siteId = "Choose one of this employer's sites.";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: {
      firstName,
      lastName,
      phone: phone || null,
      email: email || null,
      siteId: siteId || null,
    },
  };
}

export function toManagerInsert(employerId: string, value: ValidatedManager) {
  return {
    employer_id: employerId,
    site_id: value.siteId,
    first_name: value.firstName,
    last_name: value.lastName,
    phone: value.phone,
    email: value.email,
  };
}

export function explainEmployerWriteError(error: {
  code?: string;
  message?: string;
  details?: string;
}): { fieldErrors: EmployerFieldErrors; formError: string | null } {
  const message = `${error.message ?? ""} ${error.details ?? ""}`.trim();
  const fallback = error.message?.trim() || "The employer could not be saved.";

  if (message.includes("employers_company_name_unique")) {
    return { fieldErrors: { companyName: DUPLICATE_COMPANY_NAME }, formError: null };
  }
  if (message.includes("employers_company_name_not_blank")) {
    return { fieldErrors: { companyName: "Enter a company name." }, formError: null };
  }
  if (
    message.includes("employers_employer_id_format") ||
    message.includes("prevent_key_change")
  ) {
    return {
      fieldErrors: {},
      formError: "The employer ID is assigned by the database and cannot be changed.",
    };
  }
  if (message.includes("employer_sites_area_name_check")) {
    return { fieldErrors: { areaName: "Choose Doncaster, Hull, or Sheffield." }, formError: null };
  }
  if (message.includes("employer_sites_employer_area_unique")) {
    return { fieldErrors: { areaName: DUPLICATE_SITE }, formError: null };
  }
  if (
    message.includes("employer_managers_site_id_fkey") ||
    message.includes("employer_sites_pkey")
  ) {
    return {
      fieldErrors: { siteId: "That site is no longer on this employer. Choose another." },
      formError: null,
    };
  }
  if (message.includes("_employer_id_fkey") || error.code === "23503") {
    return {
      fieldErrors: {},
      formError: "That employer is no longer available. Refresh the list.",
    };
  }
  if (error.code === "42501" || /row-level security|permission denied/i.test(message)) {
    return { fieldErrors: {}, formError: EMPLOYER_WRITE_PERMISSION };
  }
  return { fieldErrors: {}, formError: fallback };
}

export function mapEmployerSite(row: EmployerSiteRow): EmployerSite {
  return { id: row.id, areaName: row.area_name };
}

export function mapEmployerManager(row: EmployerManagerRow): EmployerManager {
  return {
    id: row.id,
    siteId: row.site_id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
  };
}

export function sortSites(sites: readonly EmployerSite[]): EmployerSite[] {
  return [...sites].sort((a, b) => areaOrder(a.areaName) - areaOrder(b.areaName));
}

export function sortManagers(managers: readonly EmployerManager[]): EmployerManager[] {
  return [...managers].sort((a, b) => {
    const last = a.lastName.localeCompare(b.lastName, "en", { sensitivity: "base" });
    if (last !== 0) return last;
    return a.firstName.localeCompare(b.firstName, "en", { sensitivity: "base" });
  });
}

export function sortEmployers(rows: readonly EmployerListItem[]): EmployerListItem[] {
  return [...rows].sort((a, b) =>
    a.companyName.localeCompare(b.companyName, "en", { sensitivity: "base" }),
  );
}

export function assembleEmployers(
  employers: readonly EmployerRow[],
  sites: readonly EmployerSiteRow[],
  managers: readonly EmployerManagerRow[],
): EmployerListItem[] {
  return sortEmployers(
    employers.map((employer) => ({
      employerId: employer.employer_id,
      companyName: employer.company_name,
      createdAt: employer.created_at,
      updatedAt: employer.updated_at,
      sites: sortSites(
        sites.filter((site) => site.employer_id === employer.employer_id).map(mapEmployerSite),
      ),
      managers: sortManagers(
        managers
          .filter((manager) => manager.employer_id === employer.employer_id)
          .map(mapEmployerManager),
      ),
    })),
  );
}

export function employerFromRow(row: EmployerRow): EmployerListItem {
  return {
    employerId: row.employer_id,
    companyName: row.company_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sites: [],
    managers: [],
  };
}

export function withSite(employer: EmployerListItem, site: EmployerSite): EmployerListItem {
  return {
    ...employer,
    sites: sortSites([...employer.sites.filter((item) => item.id !== site.id), site]),
  };
}

/** Matches employer_sites delete: managers keep their row and lose the site. */
export function withoutSite(employer: EmployerListItem, siteId: string): EmployerListItem {
  return {
    ...employer,
    sites: employer.sites.filter((site) => site.id !== siteId),
    managers: employer.managers.map((manager) =>
      manager.siteId === siteId ? { ...manager, siteId: null } : manager,
    ),
  };
}

export function withManager(employer: EmployerListItem, manager: EmployerManager): EmployerListItem {
  return {
    ...employer,
    managers: sortManagers([
      ...employer.managers.filter((item) => item.id !== manager.id),
      manager,
    ]),
  };
}

export function withoutManager(employer: EmployerListItem, managerId: string): EmployerListItem {
  return {
    ...employer,
    managers: employer.managers.filter((manager) => manager.id !== managerId),
  };
}

export function formatManagerName(manager: Pick<EmployerManager, "firstName" | "lastName">): string {
  return [manager.firstName, manager.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

export function managerSiteLabel(
  manager: Pick<EmployerManager, "siteId">,
  sites: readonly EmployerSite[],
): string {
  if (!manager.siteId) return "No site";
  return sites.find((site) => site.id === manager.siteId)?.areaName ?? "No site";
}

export function employerMatchesQuery(employer: EmployerListItem, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const haystack = [
    employer.employerId,
    employer.companyName,
    ...employer.sites.map((site) => site.areaName),
    ...employer.managers.flatMap((manager) => [
      formatManagerName(manager),
      manager.phone,
      manager.email,
      managerSiteLabel(manager, employer.sites),
    ]),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

export function employerSummary(employer: EmployerListItem): string {
  const sites = employer.sites.map((site) => site.areaName).join(", ") || "No sites";
  const managers =
    employer.managers.length === 1 ? "1 manager" : `${employer.managers.length} managers`;
  return `${sites} · ${managers}`;
}

function areaOrder(areaName: string): number {
  const index = EMPLOYER_AREAS.indexOf(areaName as EmployerArea);
  return index === -1 ? EMPLOYER_AREAS.length : index;
}
