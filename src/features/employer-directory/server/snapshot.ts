import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApprenticePerson,
  DirectorySnapshot,
  DirectoryWrite,
  EmployerRecord,
  EmployerSite,
  Manager,
  ManagerRole,
  ReviewDetails,
  Site,
} from "../domain/model";

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value ? value : null;
}

function numberValue(row: Row, key: string): number {
  const value = row[key];
  return typeof value === "number" ? value : Number(value) || 1;
}

export function snapshotFromRows(input: {
  employers: Row[];
  sites: Row[];
  employerSites: Row[];
  managers: Row[];
  roles: Row[];
  apprentices: Row[];
  reviewDetails: Row[];
}): DirectorySnapshot {
  const employers: EmployerRecord[] = input.employers.map((row) => ({
    id: text(row, "id"),
    name: text(row, "name"),
    legalName: text(row, "legal_name"),
    companyNumber: text(row, "company_number"),
    mainContact: text(row, "main_contact"),
    contactEmail: text(row, "contact_email"),
    contactPhone: text(row, "contact_phone"),
    addressLine1: text(row, "address_line1"),
    town: text(row, "town"),
    postcode: text(row, "postcode"),
    status: text(row, "status") === "inactive" ? "inactive" : "active",
  }));
  const sites: Site[] = input.sites.map((row) => ({
    id: text(row, "id"),
    label: text(row, "label"),
    addressLine1: text(row, "address_line1"),
    addressLine2: text(row, "address_line2"),
    town: text(row, "town"),
    postcode: text(row, "postcode"),
    notes: text(row, "notes"),
  }));
  const employerSites: EmployerSite[] = input.employerSites.map((row) => ({
    employerId: text(row, "employer_id"),
    siteId: text(row, "site_id"),
  }));
  const managers: Manager[] = input.managers.map((row) => ({
    id: text(row, "id"),
    fullName: text(row, "full_name"),
    email: text(row, "email"),
    phone: text(row, "phone"),
    notes: text(row, "notes"),
  }));
  const roles: ManagerRole[] = input.roles.map((row) => ({
    id: text(row, "id"),
    managerId: text(row, "manager_id"),
    employerId: text(row, "employer_id"),
    siteId: nullableText(row, "site_id"),
    responsibility: text(row, "responsibility"),
  }));
  const apprentices: ApprenticePerson[] = input.apprentices.map((row) => ({
    id: text(row, "id"),
    displayName: text(row, "display_name"),
    apprenticeReference: text(row, "apprentice_reference"),
    portalEntry: text(row, "portal_entry") === "reviews" ? "reviews" : "onboarding",
  }));
  const reviewDetails: ReviewDetails[] = input.reviewDetails.map((row) => ({
    apprenticeId: text(row, "apprentice_id"),
    version: numberValue(row, "version"),
    sourceCompanyName: text(row, "source_company_name"),
    sourcePostcode: text(row, "source_postcode"),
    releaseDay: text(row, "release_day") as ReviewDetails["releaseDay"],
    tutorName: text(row, "tutor_name"),
    apprenticeshipLabel: text(row, "apprenticeship_label"),
    apprenticeshipStartDate: nullableText(row, "apprenticeship_start_date"),
    apprenticeshipEndDate: nullableText(row, "apprenticeship_end_date"),
    reviewerName: text(row, "reviewer_name"),
    sourceContactName: text(row, "source_contact_name"),
    sourceContactEmail: text(row, "source_contact_email"),
    sourceContactPhone: text(row, "source_contact_phone"),
    plannedReviewDate: nullableText(row, "planned_review_date"),
    employerId: nullableText(row, "employer_id"),
    siteId: nullableText(row, "site_id"),
    managerRoleId: nullableText(row, "manager_role_id"),
  }));
  return {
    employers,
    sites,
    employerSites,
    managers,
    roles,
    apprentices,
    reviewDetails,
  };
}

export async function loadDirectorySnapshot(
  supabase: SupabaseClient,
): Promise<DirectorySnapshot> {
  const [employers, sites, employerSites, managers, roles, apprentices, reviewDetails] =
    await Promise.all([
      supabase.from("employers").select("*"),
      supabase.from("employer_sites").select("*"),
      supabase.from("employer_site_memberships").select("*"),
      supabase.from("employer_managers").select("*"),
      supabase.from("employer_manager_roles").select("*"),
      supabase
        .from("apprentices")
        .select("id, display_name, apprentice_reference, portal_entry"),
      supabase.from("review_apprentice_details").select("*"),
    ]);
  const error =
    employers.error ||
    sites.error ||
    employerSites.error ||
    managers.error ||
    roles.error ||
    apprentices.error ||
    reviewDetails.error;
  if (error) throw new Error(error.message);
  return snapshotFromRows({
    employers: (employers.data ?? []) as Row[],
    sites: (sites.data ?? []) as Row[],
    employerSites: (employerSites.data ?? []) as Row[],
    managers: (managers.data ?? []) as Row[],
    roles: (roles.data ?? []) as Row[],
    apprentices: (apprentices.data ?? []) as Row[],
    reviewDetails: (reviewDetails.data ?? []) as Row[],
  });
}

export class VersionConflictError extends Error {
  constructor() {
    super("This apprentice was saved by someone else. Reload before changing it.");
    this.name = "VersionConflictError";
  }
}

export async function applyDirectoryWrites(
  supabase: SupabaseClient,
  writes: DirectoryWrite[],
): Promise<void> {
  for (const write of writes) {
    if (write.op === "insert") {
      const { error } = await supabase.from(write.table).insert(write.row);
      if (error) throw error;
      continue;
    }
    if (write.op === "update") {
      const { error } = await supabase.from(write.table).update(write.row).eq("id", write.id);
      if (error) throw error;
      continue;
    }
    if (write.op === "versioned_update") {
      const { data, error } = await supabase
        .from(write.table)
        .update(write.row)
        .eq("apprentice_id", write.apprenticeId)
        .eq("version", write.expectedVersion)
        .select("apprentice_id");
      if (error) throw error;
      if (!data || data.length === 0) throw new VersionConflictError();
      continue;
    }
    if (write.table === "employer_site_memberships") {
      const { error } = await supabase
        .from("employer_site_memberships")
        .delete()
        .eq("employer_id", write.employerId)
        .eq("site_id", write.siteId);
      if (error) throw error;
      continue;
    }
    const { error } = await supabase.from("employer_manager_roles").delete().eq("id", write.id);
    if (error) throw error;
  }
}

export function isReferenceCollision(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return code === "23505" && /apprentice_reference|portal_reference/i.test(message);
}
