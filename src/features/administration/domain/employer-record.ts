/**
 * Shape of public.employers, employer_sites, employer_managers,
 * and the current rows of apprentice_employments.
 * The database assigns employer_id. This page never sends one.
 */

import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { formatApprenticeName } from "./apprentice-record";
import { isUkPostcode, normaliseUkPostcode } from "./postcode-area";

/** Columns this page reads. employer_id is returned, never written. */
export const EMPLOYER_COLUMNS = "employer_id, company_name, created_at, updated_at";

export const EMPLOYER_SITE_COLUMNS =
  "id, employer_id, postcode, area_name, site_name, is_active, created_at, updated_at";

export const EMPLOYER_MANAGER_COLUMNS =
  "id, employer_id, site_id, first_name, middle_names, last_name, phone, email, created_at, updated_at";

export const APPRENTICE_PLACEMENT_COLUMNS =
  "gta_id, employer_id, site_id, manager_id, start_date";

const EMPLOYER_ID_PATTERN = /^GTA-EMP-[0-9]{6}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DUPLICATE_COMPANY_NAME =
  "An employer with this company name already exists.";

export const DUPLICATE_POSTCODE =
  "This employer already has a site with that postcode.";

export const LAST_SITE_MESSAGE = "An employer must keep at least one site.";

export const POSTCODE_FORMAT_MESSAGE = "Enter a UK postcode, such as S1 1AA.";

export const EMPLOYER_WRITE_PERMISSION =
  "You do not have permission to change employers. Administrator and Management can change employers.";

export type EmployerSite = {
  id: string;
  postcode: string;
  areaName: string;
  siteName: string | null;
  isActive: boolean;
};

export type EmployerManager = {
  id: string;
  siteId: string | null;
  firstName: string;
  middleNames: string | null;
  lastName: string;
  phone: string | null;
  email: string | null;
};

export type ApprenticePlacement = {
  gtaId: string;
  name: string;
  siteId: string;
  managerId: string;
  startDate: string;
};

export type EmployerListItem = {
  employerId: string;
  companyName: string;
  createdAt: string;
  updatedAt: string;
  sites: EmployerSite[];
  managers: EmployerManager[];
  placements: ApprenticePlacement[];
};

export type CurrentApprenticeEmployment = {
  companyName: string;
  postcode: string;
  areaName: string;
  siteName: string | null;
  managerName: string;
  startDate: string;
};

export type EmployerField = keyof EmployerFieldErrors;

export type EmployerFieldErrors = Partial<
  Record<
    | "companyName"
    | "postcode"
    | "areaName"
    | "siteName"
    | "firstName"
    | "middleNames"
    | "lastName"
    | "phone"
    | "email"
    | "siteId",
    string
  >
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
  postcode: string;
  area_name: string;
  site_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EmployerManagerRow = {
  id: string;
  employer_id: string;
  site_id: string | null;
  first_name: string;
  middle_names: string | null;
  last_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type ApprenticePlacementRow = {
  gta_id: string;
  employer_id: string;
  site_id: string;
  manager_id: string;
  start_date: string;
};

export type ApprenticeNameRow = {
  gta_id: string;
  first_name: string;
  middle_names: string | null;
  last_name: string;
};

export type SiteInput = {
  postcode: string;
  areaName: string;
  siteName: string;
};

export type ValidatedSite = {
  postcode: string;
  areaName: string;
  siteName: string | null;
};

export type ManagerInput = {
  firstName: string;
  middleNames: string;
  lastName: string;
  phone: string;
  email: string;
  siteId: string;
};

export type ValidatedManager = {
  firstName: string;
  middleNames: string | null;
  lastName: string;
  phone: string | null;
  email: string | null;
  siteId: string | null;
};

type PortalActor = {
  account: { baseRole: string };
  permissions: readonly string[];
};

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

export function validateSiteInput(
  input: SiteInput,
  existingPostcodes: readonly string[],
): { ok: true; value: ValidatedSite } | { ok: false; fieldErrors: EmployerFieldErrors } {
  const fieldErrors: EmployerFieldErrors = {};
  const postcode = normaliseUkPostcode(input.postcode);
  const areaName = input.areaName.trim();
  const siteName = input.siteName.trim();

  if (!postcode) {
    fieldErrors.postcode = "Enter a postcode.";
  } else if (!isUkPostcode(postcode)) {
    fieldErrors.postcode = POSTCODE_FORMAT_MESSAGE;
  } else if (
    existingPostcodes.some((existing) => normaliseUkPostcode(existing) === postcode)
  ) {
    fieldErrors.postcode = DUPLICATE_POSTCODE;
  }

  if (!areaName) fieldErrors.areaName = "Enter an area.";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: { postcode, areaName, siteName: siteName || null },
  };
}

export function validateManagerInput(
  input: ManagerInput,
  allowedSiteIds: readonly string[],
): { ok: true; value: ValidatedManager } | { ok: false; fieldErrors: EmployerFieldErrors } {
  const fieldErrors: EmployerFieldErrors = {};
  const firstName = input.firstName.trim();
  const middleNames = input.middleNames.trim();
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
      middleNames: middleNames || null,
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
    middle_names: value.middleNames,
    last_name: value.lastName,
    phone: value.phone,
    email: value.email,
  };
}

export function toSiteInsert(employerId: string, value: ValidatedSite) {
  return {
    employer_id: employerId,
    postcode: value.postcode,
    area_name: value.areaName,
    site_name: value.siteName,
  };
}

/** An employer always keeps one active site. Deactivating the last one is refused. */
export function canDeactivateSite(
  sites: readonly Pick<EmployerSite, "id" | "isActive">[],
  siteId: string,
): boolean {
  const active = sites.filter((site) => site.isActive);
  return active.length > 1 && active.some((site) => site.id === siteId);
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
  if (message.includes("employer_sites_postcode_format")) {
    return { fieldErrors: { postcode: POSTCODE_FORMAT_MESSAGE }, formError: null };
  }
  if (
    message.includes("employer_sites_area_name_not_blank") ||
    message.includes("employer_sites_area_name_check")
  ) {
    return { fieldErrors: { areaName: "Enter an area." }, formError: null };
  }
  if (
    message.includes("employer_sites_employer_postcode_unique") ||
    message.includes("employer_sites_employer_area_unique")
  ) {
    return { fieldErrors: { postcode: DUPLICATE_POSTCODE }, formError: null };
  }
  if (message.includes("must have at least one site")) {
    return { fieldErrors: {}, formError: LAST_SITE_MESSAGE };
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
  if (
    error.code === "42501" ||
    /row-level security|permission denied|not allowed/i.test(message)
  ) {
    return { fieldErrors: {}, formError: EMPLOYER_WRITE_PERMISSION };
  }
  return { fieldErrors: {}, formError: fallback };
}

export function mapEmployerSite(row: EmployerSiteRow): EmployerSite {
  return {
    id: row.id,
    postcode: row.postcode,
    areaName: row.area_name,
    siteName: row.site_name?.trim() || null,
    isActive: row.is_active,
  };
}

export function mapEmployerManager(row: EmployerManagerRow): EmployerManager {
  return {
    id: row.id,
    siteId: row.site_id,
    firstName: row.first_name,
    middleNames: row.middle_names?.trim() || null,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
  };
}

export function sortSites(sites: readonly EmployerSite[]): EmployerSite[] {
  return [...sites].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.postcode.localeCompare(b.postcode, "en", { sensitivity: "base" });
  });
}

export function sortManagers(managers: readonly EmployerManager[]): EmployerManager[] {
  return [...managers].sort((a, b) => {
    const last = a.lastName.localeCompare(b.lastName, "en", { sensitivity: "base" });
    if (last !== 0) return last;
    const first = a.firstName.localeCompare(b.firstName, "en", { sensitivity: "base" });
    if (first !== 0) return first;
    return (a.middleNames ?? "").localeCompare(b.middleNames ?? "", "en", { sensitivity: "base" });
  });
}

export function sortPlacements(
  placements: readonly ApprenticePlacement[],
): ApprenticePlacement[] {
  return [...placements].sort((a, b) => {
    const name = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    if (name !== 0) return name;
    return a.gtaId.localeCompare(b.gtaId, "en");
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
  placements: readonly ApprenticePlacementRow[] = [],
  apprentices: readonly ApprenticeNameRow[] = [],
): EmployerListItem[] {
  const names = new Map(apprentices.map((row) => [row.gta_id, row]));
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
      placements: sortPlacements(
        placements
          .filter((placement) => placement.employer_id === employer.employer_id)
          .map((placement) => {
            const person = names.get(placement.gta_id);
            return {
              gtaId: placement.gta_id,
              name: person
                ? formatApprenticeName({
                    firstName: person.first_name,
                    middleNames: person.middle_names,
                    lastName: person.last_name,
                  })
                : placement.gta_id,
              siteId: placement.site_id,
              managerId: placement.manager_id,
              startDate: placement.start_date,
            };
          }),
      ),
    })),
  );
}

export function employerFromRow(
  row: EmployerRow,
  sites: readonly EmployerSite[] = [],
): EmployerListItem {
  return {
    employerId: row.employer_id,
    companyName: row.company_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sites: sortSites(sites),
    managers: [],
    placements: [],
  };
}

export function withSite(employer: EmployerListItem, site: EmployerSite): EmployerListItem {
  return {
    ...employer,
    sites: sortSites([...employer.sites.filter((item) => item.id !== site.id), site]),
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

export function formatManagerName(
  manager: Pick<EmployerManager, "firstName" | "middleNames" | "lastName">,
): string {
  return [manager.firstName, manager.middleNames, manager.lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

export function siteLabel(
  site: Pick<EmployerSite, "postcode" | "areaName" | "siteName" | "isActive">,
  options?: { markInactive?: boolean },
): string {
  const parts = [site.siteName?.trim(), site.postcode, site.areaName].filter(
    (part): part is string => Boolean(part),
  );
  const label = parts.join(" · ");
  if (options?.markInactive && !site.isActive) return `${label} (inactive)`;
  return label;
}

export function managerSiteLabel(
  manager: Pick<EmployerManager, "siteId">,
  sites: readonly EmployerSite[],
): string {
  if (!manager.siteId) return "No site";
  const site = sites.find((item) => item.id === manager.siteId);
  return site ? siteLabel(site, { markInactive: true }) : "No site";
}

export function placementSiteLabel(
  placement: Pick<ApprenticePlacement, "siteId">,
  sites: readonly EmployerSite[],
): string {
  const site = sites.find((item) => item.id === placement.siteId);
  return site ? siteLabel(site) : "Site unavailable";
}

export function placementManagerLabel(
  placement: Pick<ApprenticePlacement, "managerId">,
  managers: readonly EmployerManager[],
): string {
  const manager = managers.find((item) => item.id === placement.managerId);
  return manager ? formatManagerName(manager) : "Manager unavailable";
}

export function employerMatchesQuery(employer: EmployerListItem, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const haystack = [
    employer.employerId,
    employer.companyName,
    ...employer.sites.flatMap((site) => [site.postcode, site.areaName, site.siteName]),
    ...employer.managers.flatMap((manager) => [
      formatManagerName(manager),
      manager.phone,
      manager.email,
      managerSiteLabel(manager, employer.sites),
    ]),
    ...employer.placements.flatMap((placement) => [
      placement.name,
      placement.gtaId,
      placementSiteLabel(placement, employer.sites),
      placementManagerLabel(placement, employer.managers),
    ]),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

export function employerSummary(employer: EmployerListItem): string {
  const sites =
    employer.sites.map((site) => siteLabel(site, { markInactive: true })).join(", ") || "No sites";
  const managers =
    employer.managers.length === 1 ? "1 manager" : `${employer.managers.length} managers`;
  const apprentices =
    employer.placements.length === 1
      ? "1 apprentice"
      : `${employer.placements.length} apprentices`;
  return `${sites} · ${managers} · ${apprentices}`;
}

export function employmentSiteLabel(
  employment: Pick<CurrentApprenticeEmployment, "siteName" | "postcode" | "areaName">,
): string {
  return [employment.siteName?.trim(), employment.postcode, employment.areaName]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
