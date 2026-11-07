import {
  normalizeMatchKey,
  optionalDate,
  optionalEmail,
  optionalPostcode,
  optionalReleaseDay,
  trimToEmpty,
} from "./fields";
import type {
  Company,
  CompanyInput,
  DirectoryAction,
  DirectoryFailure,
  DirectorySnapshot,
  DirectorySuccess,
  DirectoryWrite,
  LearnerLink,
  Manager,
  ManagerInput,
  ManagerRole,
  ManagerRoleInput,
  ReviewLearner,
  ReviewLearnerInput,
  ReviewLearnerPatch,
  Site,
  SiteInput,
} from "./model";
import { allocatePortalReference } from "./reference";

type IdFactory = () => string;

function fail(
  status: number,
  error: string,
  extra: Partial<DirectoryFailure> = {},
): DirectoryFailure {
  return { ok: false, status, error, ...extra };
}

function succeed(
  snapshot: DirectorySnapshot,
  writes: DirectoryWrite[],
): DirectorySuccess {
  return { ok: true, snapshot, writes };
}

function companyCandidates(companies: Company[], name: string) {
  const key = normalizeMatchKey(name);
  return companies
    .filter((company) => normalizeMatchKey(company.name) === key)
    .map((company) => ({
      id: company.id,
      label: company.name,
      detail: company.legalName || "Legal name not recorded",
    }));
}

function siteAddressKey(site: Pick<Site, "addressLine1" | "postcode">): string {
  const line = normalizeMatchKey(site.addressLine1);
  const postcode = normalizeMatchKey(site.postcode);
  if (!line && !postcode) return "";
  return `${line}|${postcode}`;
}

function siteCandidates(sites: Site[], input: Site) {
  const labelKey = normalizeMatchKey(input.label);
  const addressKey = siteAddressKey(input);
  return sites
    .filter((site) => {
      if (normalizeMatchKey(site.label) === labelKey) return true;
      return Boolean(addressKey) && siteAddressKey(site) === addressKey;
    })
    .map((site) => ({
      id: site.id,
      label: site.label,
      detail: [site.addressLine1, site.postcode].filter(Boolean).join(", ") || "Address not recorded",
    }));
}

function managerCandidates(managers: Manager[], name: string) {
  const key = normalizeMatchKey(name);
  return managers
    .filter((manager) => normalizeMatchKey(manager.fullName) === key)
    .map((manager) => ({
      id: manager.id,
      label: manager.fullName,
      detail:
        [manager.email, manager.phone].filter(Boolean).join(" · ") ||
        "Email and phone not recorded",
    }));
}

function companyPairLinked(
  snapshot: DirectorySnapshot,
  companyId: string,
  siteId: string,
): boolean {
  return snapshot.companySites.some(
    (link) => link.companyId === companyId && link.siteId === siteId,
  );
}

export function reduceDirectory(
  snapshot: DirectorySnapshot,
  action: DirectoryAction,
  createId: IdFactory = () => crypto.randomUUID(),
  random: () => number = Math.random,
): DirectorySuccess | DirectoryFailure {
  switch (action.action) {
    case "createCompany":
      return createCompany(snapshot, action.input, createId);
    case "createSite":
      return createSite(snapshot, action.input, createId);
    case "linkCompanySite":
      return linkCompanySite(snapshot, action.companyId, action.siteId);
    case "unlinkCompanySite":
      return unlinkCompanySite(snapshot, action.companyId, action.siteId);
    case "createManager":
      return createManager(snapshot, action.input, createId);
    case "assignManagerRole":
      return assignManagerRole(snapshot, action.input, createId);
    case "removeManagerRole":
      return removeManagerRole(snapshot, action.roleId);
    case "createReviewLearner":
      return createReviewLearner(snapshot, action.input, createId, random);
    case "updateReviewLearner":
      return updateReviewLearner(snapshot, action.id, action.patch);
    case "linkReviewLearner":
      return linkReviewLearner(snapshot, action.id, action.link);
    default:
      return fail(400, "Unknown action.", { code: "invalid" });
  }
}

function createCompany(
  snapshot: DirectorySnapshot,
  input: CompanyInput,
  createId: IdFactory,
): DirectorySuccess | DirectoryFailure {
  const name = trimToEmpty(input?.name);
  if (!name) return fail(400, "Company name is required.", { code: "invalid" });
  const matches = companyCandidates(snapshot.companies, name);
  if (matches.length > 0 && !input.confirmDistinct) {
    return fail(
      409,
      "A company with this name already exists. Nothing was merged. Confirm only if this is a different business.",
      { code: "possible_duplicate", candidates: matches },
    );
  }
  const company: Company = {
    id: createId(),
    name,
    legalName: trimToEmpty(input.legalName),
    companyNumber: trimToEmpty(input.companyNumber),
    notes: trimToEmpty(input.notes),
    status: input.status === "inactive" ? "inactive" : "active",
  };
  return succeed(
    { ...snapshot, companies: [...snapshot.companies, company] },
    [{ op: "insert", table: "employer_companies", row: companyToDb(company) }],
  );
}

function createSite(
  snapshot: DirectorySnapshot,
  input: SiteInput,
  createId: IdFactory,
): DirectorySuccess | DirectoryFailure {
  const label = trimToEmpty(input?.label);
  if (!label) return fail(400, "Site label is required.", { code: "invalid" });
  const postcode = optionalPostcode(input.postcode);
  if (!postcode.ok) return fail(400, postcode.error, { code: "invalid" });
  const site: Site = {
    id: createId(),
    label,
    addressLine1: trimToEmpty(input.addressLine1),
    addressLine2: trimToEmpty(input.addressLine2),
    town: trimToEmpty(input.town),
    postcode: postcode.value,
    notes: trimToEmpty(input.notes),
  };
  const matches = siteCandidates(snapshot.sites, site);
  if (matches.length > 0 && !input.confirmDistinct) {
    return fail(
      409,
      "A site with this label or address already exists. Nothing was merged. Link the company to the existing site, or confirm this is a different place.",
      { code: "possible_duplicate", candidates: matches },
    );
  }
  return succeed(
    { ...snapshot, sites: [...snapshot.sites, site] },
    [{ op: "insert", table: "employer_sites", row: siteToDb(site) }],
  );
}

function linkCompanySite(
  snapshot: DirectorySnapshot,
  companyId: string,
  siteId: string,
): DirectorySuccess | DirectoryFailure {
  if (!snapshot.companies.some((company) => company.id === companyId)) {
    return fail(404, "Company not found.", { code: "not_found" });
  }
  if (!snapshot.sites.some((site) => site.id === siteId)) {
    return fail(404, "Site not found.", { code: "not_found" });
  }
  if (companyPairLinked(snapshot, companyId, siteId)) {
    return succeed(snapshot, []);
  }
  return succeed(
    {
      ...snapshot,
      companySites: [...snapshot.companySites, { companyId, siteId }],
    },
    [
      {
        op: "insert",
        table: "employer_company_sites",
        row: { company_id: companyId, site_id: siteId },
      },
    ],
  );
}

function unlinkCompanySite(
  snapshot: DirectorySnapshot,
  companyId: string,
  siteId: string,
): DirectorySuccess | DirectoryFailure {
  const usedByRole = snapshot.roles.some(
    (role) => role.companyId === companyId && role.siteId === siteId,
  );
  const usedByLearner = snapshot.learners.some(
    (learner) => learner.companyId === companyId && learner.siteId === siteId,
  );
  if (usedByRole || usedByLearner) {
    return fail(
      409,
      "Clear manager responsibilities and learner links for this company at this site before removing the association.",
      { code: "invalid" },
    );
  }
  return succeed(
    {
      ...snapshot,
      companySites: snapshot.companySites.filter(
        (link) => !(link.companyId === companyId && link.siteId === siteId),
      ),
    },
    [{ op: "delete", table: "employer_company_sites", companyId, siteId }],
  );
}

function createManager(
  snapshot: DirectorySnapshot,
  input: ManagerInput,
  createId: IdFactory,
): DirectorySuccess | DirectoryFailure {
  const fullName = trimToEmpty(input?.fullName);
  if (!fullName) return fail(400, "Manager name is required.", { code: "invalid" });
  const email = optionalEmail(input.email);
  if (!email.ok) return fail(400, email.error, { code: "invalid" });
  const matches = managerCandidates(snapshot.managers, fullName);
  if (matches.length > 0 && !input.confirmDistinct) {
    return fail(
      409,
      "A manager with this name already exists. People are not merged by name. Confirm only if this is a different person.",
      { code: "possible_duplicate", candidates: matches },
    );
  }
  const manager: Manager = {
    id: createId(),
    fullName,
    email: email.value,
    phone: trimToEmpty(input.phone),
    notes: trimToEmpty(input.notes),
  };
  return succeed(
    { ...snapshot, managers: [...snapshot.managers, manager] },
    [{ op: "insert", table: "employer_managers", row: managerToDb(manager) }],
  );
}

function assignManagerRole(
  snapshot: DirectorySnapshot,
  input: ManagerRoleInput,
  createId: IdFactory,
): DirectorySuccess | DirectoryFailure {
  const manager = snapshot.managers.find((row) => row.id === input?.managerId);
  if (!manager) return fail(404, "Manager not found.", { code: "not_found" });
  const company = snapshot.companies.find((row) => row.id === input?.companyId);
  if (!company) return fail(404, "Company not found.", { code: "not_found" });
  const siteId = trimToEmpty(input?.siteId ?? "") || null;
  if (siteId && !companyPairLinked(snapshot, company.id, siteId)) {
    return fail(
      400,
      "That site is not linked to the company. A manager cannot be given a site for a different business.",
      { code: "invalid" },
    );
  }
  const responsibility = trimToEmpty(input?.responsibility);
  const exists = snapshot.roles.some(
    (role) =>
      role.managerId === manager.id &&
      role.companyId === company.id &&
      role.siteId === siteId,
  );
  if (exists) {
    return fail(409, "That manager responsibility already exists.", {
      code: "possible_duplicate",
    });
  }
  const role: ManagerRole = {
    id: createId(),
    managerId: manager.id,
    companyId: company.id,
    siteId,
    responsibility,
  };
  return succeed(
    { ...snapshot, roles: [...snapshot.roles, role] },
    [{ op: "insert", table: "employer_manager_roles", row: roleToDb(role) }],
  );
}

function removeManagerRole(
  snapshot: DirectorySnapshot,
  roleId: string,
): DirectorySuccess | DirectoryFailure {
  if (!snapshot.roles.some((role) => role.id === roleId)) {
    return fail(404, "Manager responsibility not found.", { code: "not_found" });
  }
  if (snapshot.learners.some((learner) => learner.managerRoleId === roleId)) {
    return fail(
      409,
      "Learners still use this responsibility. Clear those links before removing it.",
      { code: "invalid" },
    );
  }
  return succeed(
    { ...snapshot, roles: snapshot.roles.filter((role) => role.id !== roleId) },
    [{ op: "delete", table: "employer_manager_roles", id: roleId }],
  );
}

function createReviewLearner(
  snapshot: DirectorySnapshot,
  input: ReviewLearnerInput,
  createId: IdFactory,
  random: () => number,
): DirectorySuccess | DirectoryFailure {
  const built = buildLearnerFields(input);
  if (!built.ok) return built;
  let portalReference: string;
  try {
    portalReference = allocatePortalReference(
      snapshot.learners.map((learner) => learner.portalReference),
      random,
    );
  } catch (error) {
    return fail(
      409,
      error instanceof Error ? error.message : "Could not allocate a portal reference.",
      { code: "possible_duplicate" },
    );
  }
  const learner: ReviewLearner = {
    id: createId(),
    portalReference,
    ...built.fields,
    companyId: null,
    siteId: null,
    managerRoleId: null,
  };
  return succeed(
    { ...snapshot, learners: [...snapshot.learners, learner] },
    [{ op: "insert", table: "review_learners", row: learnerToDb(learner) }],
  );
}

function updateReviewLearner(
  snapshot: DirectorySnapshot,
  id: string,
  patch: ReviewLearnerPatch,
): DirectorySuccess | DirectoryFailure {
  const current = snapshot.learners.find((learner) => learner.id === id);
  if (!current) return fail(404, "Learner not found.", { code: "not_found" });
  const built = buildLearnerFields({
    fullName: patch.fullName ?? current.fullName,
    sourceCompanyName: patch.sourceCompanyName ?? current.sourceCompanyName,
    sourcePostcode: patch.sourcePostcode ?? current.sourcePostcode,
    releaseDay: patch.releaseDay ?? current.releaseDay,
    tutorName: patch.tutorName ?? current.tutorName,
    apprenticeshipLabel: patch.apprenticeshipLabel ?? current.apprenticeshipLabel,
    apprenticeshipStartDate:
      patch.apprenticeshipStartDate ?? current.apprenticeshipStartDate ?? "",
    apprenticeshipEndDate:
      patch.apprenticeshipEndDate ?? current.apprenticeshipEndDate ?? "",
    reviewerName: patch.reviewerName ?? current.reviewerName,
    sourceContactName: patch.sourceContactName ?? current.sourceContactName,
    sourceContactEmail: patch.sourceContactEmail ?? current.sourceContactEmail,
    sourceContactPhone: patch.sourceContactPhone ?? current.sourceContactPhone,
    plannedReviewDate: patch.plannedReviewDate ?? current.plannedReviewDate ?? "",
  });
  if (!built.ok) return built;
  const next: ReviewLearner = {
    ...current,
    ...built.fields,
  };
  return succeed(
    {
      ...snapshot,
      learners: snapshot.learners.map((learner) => (learner.id === id ? next : learner)),
    },
    [{ op: "update", table: "review_learners", id, row: learnerToDb(next) }],
  );
}

function linkReviewLearner(
  snapshot: DirectorySnapshot,
  id: string,
  link: LearnerLink,
): DirectorySuccess | DirectoryFailure {
  const current = snapshot.learners.find((learner) => learner.id === id);
  if (!current) return fail(404, "Learner not found.", { code: "not_found" });
  const companyId = trimToEmpty(link.companyId ?? "") || null;
  const siteId = trimToEmpty(link.siteId ?? "") || null;
  const managerRoleId = trimToEmpty(link.managerRoleId ?? "") || null;
  if (!companyId && (siteId || managerRoleId)) {
    return fail(400, "Choose a company before a site or manager.", { code: "invalid" });
  }
  if (companyId && !snapshot.companies.some((company) => company.id === companyId)) {
    return fail(404, "Company not found.", { code: "not_found" });
  }
  if (siteId && companyId && !companyPairLinked(snapshot, companyId, siteId)) {
    return fail(400, "That site is not linked to the selected company.", {
      code: "invalid",
    });
  }
  if (managerRoleId) {
    const role = snapshot.roles.find((row) => row.id === managerRoleId);
    if (!role) return fail(404, "Manager responsibility not found.", { code: "not_found" });
    if (role.companyId !== companyId) {
      return fail(400, "That manager is not responsible for the selected company.", {
        code: "invalid",
      });
    }
    if (role.siteId && role.siteId !== siteId) {
      return fail(
        400,
        "That manager is responsible for a different site. Choose their site, or pick a company-wide responsibility.",
        { code: "invalid" },
      );
    }
  }
  const next: ReviewLearner = {
    ...current,
    companyId,
    siteId,
    managerRoleId,
  };
  return succeed(
    {
      ...snapshot,
      learners: snapshot.learners.map((learner) => (learner.id === id ? next : learner)),
    },
    [{ op: "update", table: "review_learners", id, row: learnerLinkToDb(next) }],
  );
}

function buildLearnerFields(
  input: ReviewLearnerInput,
):
  | { ok: true; fields: Omit<ReviewLearner, "id" | "portalReference" | "companyId" | "siteId" | "managerRoleId"> }
  | DirectoryFailure {
  const fullName = trimToEmpty(input?.fullName);
  if (!fullName) return fail(400, "Full name is required.", { code: "invalid" });
  const postcode = optionalPostcode(input.sourcePostcode);
  if (!postcode.ok) return fail(400, postcode.error, { code: "invalid" });
  const releaseDay = optionalReleaseDay(input.releaseDay);
  if (!releaseDay.ok) return fail(400, releaseDay.error, { code: "invalid" });
  const email = optionalEmail(input.sourceContactEmail);
  if (!email.ok) return fail(400, email.error, { code: "invalid" });
  const start = optionalDate(input.apprenticeshipStartDate, "Apprenticeship start date");
  if (!start.ok) return fail(400, start.error, { code: "invalid" });
  const end = optionalDate(input.apprenticeshipEndDate, "Apprenticeship planned end date");
  if (!end.ok) return fail(400, end.error, { code: "invalid" });
  const planned = optionalDate(input.plannedReviewDate, "Planned review date");
  if (!planned.ok) return fail(400, planned.error, { code: "invalid" });
  if (start.value && end.value && end.value < start.value) {
    return fail(400, "Planned end date cannot be before the start date.", {
      code: "invalid",
    });
  }
  return {
    ok: true,
    fields: {
      fullName,
      sourceCompanyName: trimToEmpty(input.sourceCompanyName),
      sourcePostcode: postcode.value,
      releaseDay: releaseDay.value,
      tutorName: trimToEmpty(input.tutorName),
      apprenticeshipLabel: trimToEmpty(input.apprenticeshipLabel),
      apprenticeshipStartDate: start.value,
      apprenticeshipEndDate: end.value,
      reviewerName: trimToEmpty(input.reviewerName),
      sourceContactName: trimToEmpty(input.sourceContactName),
      sourceContactEmail: email.value,
      sourceContactPhone: trimToEmpty(input.sourceContactPhone),
      plannedReviewDate: planned.value,
    },
  };
}

export function companyToDb(company: Company): Record<string, unknown> {
  return {
    id: company.id,
    name: company.name,
    legal_name: company.legalName,
    company_number: company.companyNumber,
    notes: company.notes,
    status: company.status,
  };
}

export function siteToDb(site: Site): Record<string, unknown> {
  return {
    id: site.id,
    label: site.label,
    address_line1: site.addressLine1,
    address_line2: site.addressLine2,
    town: site.town,
    postcode: site.postcode,
    notes: site.notes,
  };
}

export function managerToDb(manager: Manager): Record<string, unknown> {
  return {
    id: manager.id,
    full_name: manager.fullName,
    email: manager.email,
    phone: manager.phone,
    notes: manager.notes,
  };
}

export function roleToDb(role: ManagerRole): Record<string, unknown> {
  return {
    id: role.id,
    manager_id: role.managerId,
    company_id: role.companyId,
    site_id: role.siteId,
    responsibility: role.responsibility,
  };
}

export function learnerToDb(learner: ReviewLearner): Record<string, unknown> {
  return {
    id: learner.id,
    portal_reference: learner.portalReference,
    full_name: learner.fullName,
    source_company_name: learner.sourceCompanyName,
    source_postcode: learner.sourcePostcode,
    release_day: learner.releaseDay,
    tutor_name: learner.tutorName,
    apprenticeship_label: learner.apprenticeshipLabel,
    apprenticeship_start_date: learner.apprenticeshipStartDate,
    apprenticeship_end_date: learner.apprenticeshipEndDate,
    reviewer_name: learner.reviewerName,
    source_contact_name: learner.sourceContactName,
    source_contact_email: learner.sourceContactEmail,
    source_contact_phone: learner.sourceContactPhone,
    planned_review_date: learner.plannedReviewDate,
    company_id: learner.companyId,
    site_id: learner.siteId,
    manager_role_id: learner.managerRoleId,
  };
}

function learnerLinkToDb(learner: ReviewLearner): Record<string, unknown> {
  return {
    company_id: learner.companyId,
    site_id: learner.siteId,
    manager_role_id: learner.managerRoleId,
  };
}

export function learnersForCompany(snapshot: DirectorySnapshot, companyId: string): ReviewLearner[] {
  return snapshot.learners.filter((learner) => learner.companyId === companyId);
}

export function companiesForSite(snapshot: DirectorySnapshot, siteId: string): Company[] {
  const ids = new Set(
    snapshot.companySites.filter((link) => link.siteId === siteId).map((link) => link.companyId),
  );
  return snapshot.companies.filter((company) => ids.has(company.id));
}

export function sitesForCompany(snapshot: DirectorySnapshot, companyId: string): Site[] {
  const ids = new Set(
    snapshot.companySites
      .filter((link) => link.companyId === companyId)
      .map((link) => link.siteId),
  );
  return snapshot.sites.filter((site) => ids.has(site.id));
}

export function rolesForCompany(snapshot: DirectorySnapshot, companyId: string): ManagerRole[] {
  return snapshot.roles.filter((role) => role.companyId === companyId);
}
