import {
  normalizeMatchKey,
  optionalDate,
  optionalEmail,
  optionalPostcode,
  optionalReleaseDay,
  trimToEmpty,
} from "./fields";
import type {
  ApprenticePerson,
  DirectoryAction,
  DirectoryFailure,
  DirectorySnapshot,
  DirectorySuccess,
  DirectoryWrite,
  EmployerRecord,
  Manager,
  ManagerInput,
  ManagerRole,
  ManagerRoleInput,
  ReviewApprenticeInput,
  ReviewDetailPatch,
  ReviewDetails,
  ReviewLink,
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

function employerCandidates(employers: EmployerRecord[], name: string) {
  const key = normalizeMatchKey(name);
  return employers
    .filter((employer) => normalizeMatchKey(employer.name) === key)
    .map((employer) => ({
      id: employer.id,
      label: employer.name,
      detail: employer.legalName || "Legal name not recorded",
    }));
}

function personCandidates(people: ApprenticePerson[], name: string) {
  const key = normalizeMatchKey(name);
  return people
    .filter((person) => normalizeMatchKey(person.displayName) === key)
    .map((person) => ({
      id: person.id,
      label: person.displayName,
      detail: person.apprenticeReference,
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
      detail:
        [site.addressLine1, site.postcode].filter(Boolean).join(", ") ||
        "Address not recorded",
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

function pairLinked(
  snapshot: DirectorySnapshot,
  employerId: string,
  siteId: string,
): boolean {
  return snapshot.employerSites.some(
    (link) => link.employerId === employerId && link.siteId === siteId,
  );
}

export function reduceDirectory(
  snapshot: DirectorySnapshot,
  action: DirectoryAction,
  createId: IdFactory = () => crypto.randomUUID(),
  random: () => number = Math.random,
): DirectorySuccess | DirectoryFailure {
  switch (action.action) {
    case "createEmployer":
      return createEmployer(snapshot, action.input, createId);
    case "createSite":
      return createSite(snapshot, action.input, createId);
    case "linkEmployerSite":
      return linkEmployerSite(snapshot, action.employerId, action.siteId);
    case "unlinkEmployerSite":
      return unlinkEmployerSite(snapshot, action.employerId, action.siteId);
    case "createManager":
      return createManager(snapshot, action.input, createId);
    case "assignManagerRole":
      return assignManagerRole(snapshot, action.input, createId);
    case "removeManagerRole":
      return removeManagerRole(snapshot, action.roleId);
    case "createReviewApprentice":
      return createReviewApprentice(snapshot, action.input, createId, random);
    case "updateReviewDetails":
      return updateReviewDetails(
        snapshot,
        action.apprenticeId,
        action.expectedVersion,
        action.patch,
      );
    case "linkReviewApprentice":
      return linkReviewApprentice(
        snapshot,
        action.apprenticeId,
        action.expectedVersion,
        action.link,
      );
    default:
      return fail(400, "Unknown action.", { code: "invalid" });
  }
}

function createEmployer(
  snapshot: DirectorySnapshot,
  input: { name?: string; confirmDistinct?: boolean } | undefined,
  createId: IdFactory,
): DirectorySuccess | DirectoryFailure {
  const name = trimToEmpty(input?.name);
  if (!name) return fail(400, "Employer name is required.", { code: "invalid" });
  const matches = employerCandidates(snapshot.employers, name);
  if (matches.length > 0 && !input?.confirmDistinct) {
    return fail(
      409,
      "An employer with this name already exists. Nothing was merged. Confirm only if this is a different business.",
      { code: "possible_duplicate", candidates: matches },
    );
  }
  const employer: EmployerRecord = {
    id: createId(),
    name,
    legalName: "",
    companyNumber: "",
    mainContact: "",
    contactEmail: "",
    contactPhone: "",
    addressLine1: "",
    town: "",
    postcode: "",
    status: "active",
  };
  return succeed(
    { ...snapshot, employers: [...snapshot.employers, employer] },
    [{ op: "insert", table: "employers", row: employerToDb(employer) }],
  );
}

function createSite(
  snapshot: DirectorySnapshot,
  input: SiteInput | undefined,
  createId: IdFactory,
): DirectorySuccess | DirectoryFailure {
  const label = trimToEmpty(input?.label);
  if (!label) return fail(400, "Site label is required.", { code: "invalid" });
  const postcode = optionalPostcode(input?.postcode);
  if (!postcode.ok) return fail(400, postcode.error, { code: "invalid" });
  const site: Site = {
    id: createId(),
    label,
    addressLine1: trimToEmpty(input?.addressLine1),
    addressLine2: trimToEmpty(input?.addressLine2),
    town: trimToEmpty(input?.town),
    postcode: postcode.value,
    notes: trimToEmpty(input?.notes),
  };
  const matches = siteCandidates(snapshot.sites, site);
  if (matches.length > 0 && !input?.confirmDistinct) {
    return fail(
      409,
      "A site with this label or address already exists. Nothing was merged. Link the employer to the existing site, or confirm this is a different place.",
      { code: "possible_duplicate", candidates: matches },
    );
  }
  return succeed({ ...snapshot, sites: [...snapshot.sites, site] }, [
    { op: "insert", table: "employer_sites", row: siteToDb(site) },
  ]);
}

function linkEmployerSite(
  snapshot: DirectorySnapshot,
  employerId: string,
  siteId: string,
): DirectorySuccess | DirectoryFailure {
  if (!snapshot.employers.some((employer) => employer.id === employerId)) {
    return fail(404, "Employer not found.", { code: "not_found" });
  }
  if (!snapshot.sites.some((site) => site.id === siteId)) {
    return fail(404, "Site not found.", { code: "not_found" });
  }
  if (pairLinked(snapshot, employerId, siteId)) return succeed(snapshot, []);
  return succeed(
    {
      ...snapshot,
      employerSites: [...snapshot.employerSites, { employerId, siteId }],
    },
    [
      {
        op: "insert",
        table: "employer_site_memberships",
        row: { employer_id: employerId, site_id: siteId },
      },
    ],
  );
}

function unlinkEmployerSite(
  snapshot: DirectorySnapshot,
  employerId: string,
  siteId: string,
): DirectorySuccess | DirectoryFailure {
  const usedByRole = snapshot.roles.some(
    (role) => role.employerId === employerId && role.siteId === siteId,
  );
  const usedByLearner = snapshot.reviewDetails.some(
    (detail) => detail.employerId === employerId && detail.siteId === siteId,
  );
  if (usedByRole || usedByLearner) {
    return fail(
      409,
      "Clear manager responsibilities and apprentice links for this employer at this site before removing the association.",
      { code: "invalid" },
    );
  }
  return succeed(
    {
      ...snapshot,
      employerSites: snapshot.employerSites.filter(
        (link) => !(link.employerId === employerId && link.siteId === siteId),
      ),
    },
    [{ op: "delete", table: "employer_site_memberships", employerId, siteId }],
  );
}

function createManager(
  snapshot: DirectorySnapshot,
  input: ManagerInput | undefined,
  createId: IdFactory,
): DirectorySuccess | DirectoryFailure {
  const fullName = trimToEmpty(input?.fullName);
  if (!fullName) return fail(400, "Manager name is required.", { code: "invalid" });
  const email = optionalEmail(input?.email);
  if (!email.ok) return fail(400, email.error, { code: "invalid" });
  const matches = managerCandidates(snapshot.managers, fullName);
  if (matches.length > 0 && !input?.confirmDistinct) {
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
    phone: trimToEmpty(input?.phone),
    notes: trimToEmpty(input?.notes),
  };
  return succeed(
    { ...snapshot, managers: [...snapshot.managers, manager] },
    [{ op: "insert", table: "employer_managers", row: managerToDb(manager) }],
  );
}

function assignManagerRole(
  snapshot: DirectorySnapshot,
  input: ManagerRoleInput | undefined,
  createId: IdFactory,
): DirectorySuccess | DirectoryFailure {
  const manager = snapshot.managers.find((row) => row.id === input?.managerId);
  if (!manager) return fail(404, "Manager not found.", { code: "not_found" });
  const employer = snapshot.employers.find((row) => row.id === input?.employerId);
  if (!employer) return fail(404, "Employer not found.", { code: "not_found" });
  const siteId = trimToEmpty(input?.siteId ?? "") || null;
  if (siteId && !pairLinked(snapshot, employer.id, siteId)) {
    return fail(
      400,
      "That site is not linked to the employer. A manager cannot be given a site for a different business.",
      { code: "invalid" },
    );
  }
  const exists = snapshot.roles.some(
    (role) =>
      role.managerId === manager.id &&
      role.employerId === employer.id &&
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
    employerId: employer.id,
    siteId,
    responsibility: trimToEmpty(input?.responsibility),
  };
  return succeed({ ...snapshot, roles: [...snapshot.roles, role] }, [
    { op: "insert", table: "employer_manager_roles", row: roleToDb(role) },
  ]);
}

function removeManagerRole(
  snapshot: DirectorySnapshot,
  roleId: string,
): DirectorySuccess | DirectoryFailure {
  if (!snapshot.roles.some((role) => role.id === roleId)) {
    return fail(404, "Manager responsibility not found.", { code: "not_found" });
  }
  if (snapshot.reviewDetails.some((detail) => detail.managerRoleId === roleId)) {
    return fail(
      409,
      "Apprentices still use this responsibility. Clear those links before removing it.",
      { code: "invalid" },
    );
  }
  return succeed(
    { ...snapshot, roles: snapshot.roles.filter((role) => role.id !== roleId) },
    [{ op: "delete", table: "employer_manager_roles", id: roleId }],
  );
}

function createReviewApprentice(
  snapshot: DirectorySnapshot,
  input: ReviewApprenticeInput | undefined,
  createId: IdFactory,
  random: () => number,
): DirectorySuccess | DirectoryFailure {
  const built = buildDetailFields(input);
  if (!built.ok) return built;
  const matches = personCandidates(snapshot.apprentices, built.fullName);
  if (matches.length > 0 && !input?.confirmDistinct) {
    return fail(
      409,
      "An apprentice with this name is already on the register. Nothing was merged. Open that person, or confirm this is someone else.",
      { code: "possible_duplicate", candidates: matches },
    );
  }
  let apprenticeReference: string;
  try {
    apprenticeReference = allocatePortalReference(
      snapshot.apprentices.map((person) => person.apprenticeReference),
      random,
    );
  } catch (error) {
    return fail(
      409,
      error instanceof Error ? error.message : "Could not allocate a portal reference.",
      { code: "possible_duplicate" },
    );
  }
  const apprenticeId = createId();
  const person: ApprenticePerson = {
    id: apprenticeId,
    displayName: built.fullName,
    apprenticeReference,
    portalEntry: "reviews",
  };
  const details: ReviewDetails = {
    apprenticeId,
    version: 1,
    ...built.fields,
    employerId: null,
    siteId: null,
    managerRoleId: null,
  };
  return succeed(
    {
      ...snapshot,
      apprentices: [...snapshot.apprentices, person],
      reviewDetails: [...snapshot.reviewDetails, details],
    },
    [
      {
        op: "rpc",
        fn: "create_review_apprentice",
        args: {
          p_row: {
            id: person.id,
            display_name: person.displayName,
            apprentice_reference: person.apprenticeReference,
            ...detailsToDb(details),
          },
        },
      },
    ],
  );
}

function updateReviewDetails(
  snapshot: DirectorySnapshot,
  apprenticeId: string,
  expectedVersion: number,
  patch: ReviewDetailPatch,
): DirectorySuccess | DirectoryFailure {
  const person = snapshot.apprentices.find((row) => row.id === apprenticeId);
  if (!person) return fail(404, "Apprentice not found.", { code: "not_found" });
  const stored = snapshot.reviewDetails.find(
    (detail) => detail.apprenticeId === apprenticeId,
  );
  if (!stored && expectedVersion !== 0) {
    return fail(
      409,
      "This apprentice was saved by someone else. Reload before changing these fields.",
      { code: "version_conflict" },
    );
  }
  const current = stored ?? emptyReviewDetails(apprenticeId);
  if (current.version !== expectedVersion) {
    return fail(
      409,
      "This apprentice was saved by someone else. Reload before changing these fields.",
      { code: "version_conflict" },
    );
  }
  const built = buildDetailFields({
    fullName: patch.fullName ?? person.displayName,
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
  const nextDetails: ReviewDetails = {
    ...current,
    ...built.fields,
    version: current.version + 1,
  };
  const nextPerson: ApprenticePerson = {
    ...person,
    displayName: built.fullName,
  };
  const detailRow = changedDetailColumns(current, nextDetails, patch);
  return succeed(
    {
      ...snapshot,
      apprentices: snapshot.apprentices.map((row) =>
        row.id === apprenticeId ? nextPerson : row,
      ),
      reviewDetails: stored
        ? snapshot.reviewDetails.map((row) =>
            row.apprenticeId === apprenticeId ? nextDetails : row,
          )
        : [...snapshot.reviewDetails, nextDetails],
    },
    [
      reviewChangeWrite(
        apprenticeId,
        expectedVersion,
        nextPerson.displayName !== person.displayName ? nextPerson.displayName : null,
        detailRow,
      ),
    ],
  );
}

function linkReviewApprentice(
  snapshot: DirectorySnapshot,
  apprenticeId: string,
  expectedVersion: number,
  link: ReviewLink,
): DirectorySuccess | DirectoryFailure {
  const person = snapshot.apprentices.find((row) => row.id === apprenticeId);
  if (!person) return fail(404, "Apprentice not found.", { code: "not_found" });
  const stored = snapshot.reviewDetails.find(
    (detail) => detail.apprenticeId === apprenticeId,
  );
  if (!stored && expectedVersion !== 0) {
    return fail(
      409,
      "This apprentice was saved by someone else. Reload before changing the employer link.",
      { code: "version_conflict" },
    );
  }
  const current = stored ?? emptyReviewDetails(apprenticeId);
  if (current.version !== expectedVersion) {
    return fail(
      409,
      "This apprentice was saved by someone else. Reload before changing the employer link.",
      { code: "version_conflict" },
    );
  }
  const employerId = trimToEmpty(link.employerId ?? "") || null;
  const siteId = trimToEmpty(link.siteId ?? "") || null;
  const managerRoleId = trimToEmpty(link.managerRoleId ?? "") || null;
  if (!employerId && (siteId || managerRoleId)) {
    return fail(400, "Choose an employer before a site or manager.", { code: "invalid" });
  }
  if (employerId && !snapshot.employers.some((employer) => employer.id === employerId)) {
    return fail(404, "Employer not found.", { code: "not_found" });
  }
  if (siteId && employerId && !pairLinked(snapshot, employerId, siteId)) {
    return fail(400, "That site is not linked to the selected employer.", {
      code: "invalid",
    });
  }
  if (managerRoleId) {
    const role = snapshot.roles.find((row) => row.id === managerRoleId);
    if (!role) return fail(404, "Manager responsibility not found.", { code: "not_found" });
    if (role.employerId !== employerId) {
      return fail(400, "That manager is not responsible for the selected employer.", {
        code: "invalid",
      });
    }
    if (role.siteId && role.siteId !== siteId) {
      return fail(
        400,
        "That manager is responsible for a different site. Choose their site, or pick an employer-wide responsibility.",
        { code: "invalid" },
      );
    }
  }
  const next: ReviewDetails = {
    ...current,
    employerId,
    siteId,
    managerRoleId,
    version: current.version + 1,
  };
  return succeed(
    {
      ...snapshot,
      reviewDetails: stored
        ? snapshot.reviewDetails.map((row) =>
            row.apprenticeId === apprenticeId ? next : row,
          )
        : [...snapshot.reviewDetails, next],
    },
    [
      reviewChangeWrite(apprenticeId, expectedVersion, null, {
        employer_id: employerId,
        site_id: siteId,
        manager_role_id: managerRoleId,
      }),
    ],
  );
}

function emptyReviewDetails(apprenticeId: string): ReviewDetails {
  return {
    apprenticeId,
    version: 0,
    sourceCompanyName: "",
    sourcePostcode: "",
    releaseDay: "",
    tutorName: "",
    apprenticeshipLabel: "",
    apprenticeshipStartDate: null,
    apprenticeshipEndDate: null,
    reviewerName: "",
    sourceContactName: "",
    sourceContactEmail: "",
    sourceContactPhone: "",
    plannedReviewDate: null,
    employerId: null,
    siteId: null,
    managerRoleId: null,
  };
}

function reviewChangeWrite(
  apprenticeId: string,
  expectedVersion: number,
  displayName: string | null,
  fields: Record<string, unknown>,
): DirectoryWrite {
  return {
    op: "rpc",
    fn: "apply_review_apprentice_change",
    args: {
      p_apprentice_id: apprenticeId,
      p_expected_version: expectedVersion,
      p_display_name: displayName,
      p_fields: fields,
    },
  };
}

function changedDetailColumns(
  current: ReviewDetails,
  next: ReviewDetails,
  patch: ReviewDetailPatch,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ("sourceCompanyName" in patch) row.source_company_name = next.sourceCompanyName;
  if ("sourcePostcode" in patch) row.source_postcode = next.sourcePostcode;
  if ("releaseDay" in patch) row.release_day = next.releaseDay;
  if ("tutorName" in patch) row.tutor_name = next.tutorName;
  if ("apprenticeshipLabel" in patch) row.apprenticeship_label = next.apprenticeshipLabel;
  if ("apprenticeshipStartDate" in patch) {
    row.apprenticeship_start_date = next.apprenticeshipStartDate;
  }
  if ("apprenticeshipEndDate" in patch) {
    row.apprenticeship_end_date = next.apprenticeshipEndDate;
  }
  if ("reviewerName" in patch) row.reviewer_name = next.reviewerName;
  if ("sourceContactName" in patch) row.source_contact_name = next.sourceContactName;
  if ("sourceContactEmail" in patch) row.source_contact_email = next.sourceContactEmail;
  if ("sourceContactPhone" in patch) row.source_contact_phone = next.sourceContactPhone;
  if ("plannedReviewDate" in patch) row.planned_review_date = next.plannedReviewDate;
  void current;
  return row;
}

function buildDetailFields(input: ReviewApprenticeInput | undefined):
  | {
      ok: true;
      fullName: string;
      fields: Omit<
        ReviewDetails,
        "apprenticeId" | "version" | "employerId" | "siteId" | "managerRoleId"
      >;
    }
  | DirectoryFailure {
  const fullName = trimToEmpty(input?.fullName);
  if (!fullName) return fail(400, "Full name is required.", { code: "invalid" });
  const postcode = optionalPostcode(input?.sourcePostcode);
  if (!postcode.ok) return fail(400, postcode.error, { code: "invalid" });
  const releaseDay = optionalReleaseDay(input?.releaseDay);
  if (!releaseDay.ok) return fail(400, releaseDay.error, { code: "invalid" });
  const email = optionalEmail(input?.sourceContactEmail);
  if (!email.ok) return fail(400, email.error, { code: "invalid" });
  const start = optionalDate(input?.apprenticeshipStartDate, "Apprenticeship start date");
  if (!start.ok) return fail(400, start.error, { code: "invalid" });
  const end = optionalDate(input?.apprenticeshipEndDate, "Apprenticeship planned end date");
  if (!end.ok) return fail(400, end.error, { code: "invalid" });
  const planned = optionalDate(input?.plannedReviewDate, "Planned review date");
  if (!planned.ok) return fail(400, planned.error, { code: "invalid" });
  if (start.value && end.value && end.value < start.value) {
    return fail(400, "Planned end date cannot be before the start date.", {
      code: "invalid",
    });
  }
  return {
    ok: true,
    fullName,
    fields: {
      sourceCompanyName: trimToEmpty(input?.sourceCompanyName),
      sourcePostcode: postcode.value,
      releaseDay: releaseDay.value,
      tutorName: trimToEmpty(input?.tutorName),
      apprenticeshipLabel: trimToEmpty(input?.apprenticeshipLabel),
      apprenticeshipStartDate: start.value,
      apprenticeshipEndDate: end.value,
      reviewerName: trimToEmpty(input?.reviewerName),
      sourceContactName: trimToEmpty(input?.sourceContactName),
      sourceContactEmail: email.value,
      sourceContactPhone: trimToEmpty(input?.sourceContactPhone),
      plannedReviewDate: planned.value,
    },
  };
}

export function employerToDb(employer: EmployerRecord): Record<string, unknown> {
  return {
    id: employer.id,
    name: employer.name,
    legal_name: employer.legalName,
    company_number: employer.companyNumber,
    main_contact: employer.mainContact,
    contact_role: "",
    contact_email: employer.contactEmail,
    contact_phone: employer.contactPhone,
    address_line1: employer.addressLine1,
    address_line2: "",
    town: employer.town,
    postcode: employer.postcode,
    website: "",
    status: employer.status,
    notes: "",
  };
}

function siteToDb(site: Site): Record<string, unknown> {
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

function managerToDb(manager: Manager): Record<string, unknown> {
  return {
    id: manager.id,
    full_name: manager.fullName,
    email: manager.email,
    phone: manager.phone,
    notes: manager.notes,
  };
}

function roleToDb(role: ManagerRole): Record<string, unknown> {
  return {
    id: role.id,
    manager_id: role.managerId,
    employer_id: role.employerId,
    site_id: role.siteId,
    responsibility: role.responsibility,
  };
}

function detailsToDb(details: ReviewDetails): Record<string, unknown> {
  return {
    apprentice_id: details.apprenticeId,
    version: details.version,
    source_company_name: details.sourceCompanyName,
    source_postcode: details.sourcePostcode,
    release_day: details.releaseDay,
    tutor_name: details.tutorName,
    apprenticeship_label: details.apprenticeshipLabel,
    apprenticeship_start_date: details.apprenticeshipStartDate,
    apprenticeship_end_date: details.apprenticeshipEndDate,
    reviewer_name: details.reviewerName,
    source_contact_name: details.sourceContactName,
    source_contact_email: details.sourceContactEmail,
    source_contact_phone: details.sourceContactPhone,
    planned_review_date: details.plannedReviewDate,
    employer_id: details.employerId,
    site_id: details.siteId,
    manager_role_id: details.managerRoleId,
  };
}

export function sitesForEmployer(snapshot: DirectorySnapshot, employerId: string): Site[] {
  const ids = new Set(
    snapshot.employerSites
      .filter((link) => link.employerId === employerId)
      .map((link) => link.siteId),
  );
  return snapshot.sites.filter((site) => ids.has(site.id));
}

export function employersForSite(snapshot: DirectorySnapshot, siteId: string): EmployerRecord[] {
  const ids = new Set(
    snapshot.employerSites
      .filter((link) => link.siteId === siteId)
      .map((link) => link.employerId),
  );
  return snapshot.employers.filter((employer) => ids.has(employer.id));
}

export function rolesForEmployer(
  snapshot: DirectorySnapshot,
  employerId: string,
): ManagerRole[] {
  return snapshot.roles.filter((role) => role.employerId === employerId);
}

export function apprenticesForEmployer(
  snapshot: DirectorySnapshot,
  employerId: string,
): ApprenticePerson[] {
  const ids = new Set(
    snapshot.reviewDetails
      .filter((detail) => detail.employerId === employerId)
      .map((detail) => detail.apprenticeId),
  );
  return snapshot.apprentices.filter((person) => ids.has(person.id));
}
