import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Company,
  CompanySite,
  DirectorySnapshot,
  DirectoryWrite,
  Manager,
  ManagerRole,
  ReviewLearner,
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

export function snapshotFromRows(input: {
  companies: Row[];
  sites: Row[];
  companySites: Row[];
  managers: Row[];
  roles: Row[];
  learners: Row[];
}): DirectorySnapshot {
  const companies: Company[] = input.companies.map((row) => ({
    id: text(row, "id"),
    name: text(row, "name"),
    legalName: text(row, "legal_name"),
    companyNumber: text(row, "company_number"),
    notes: text(row, "notes"),
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
  const companySites: CompanySite[] = input.companySites.map((row) => ({
    companyId: text(row, "company_id"),
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
    companyId: text(row, "company_id"),
    siteId: nullableText(row, "site_id"),
    responsibility: text(row, "responsibility"),
  }));
  const learners: ReviewLearner[] = input.learners.map((row) => ({
    id: text(row, "id"),
    portalReference: text(row, "portal_reference"),
    fullName: text(row, "full_name"),
    sourceCompanyName: text(row, "source_company_name"),
    sourcePostcode: text(row, "source_postcode"),
    releaseDay: text(row, "release_day") as ReviewLearner["releaseDay"],
    tutorName: text(row, "tutor_name"),
    apprenticeshipLabel: text(row, "apprenticeship_label"),
    apprenticeshipStartDate: nullableText(row, "apprenticeship_start_date"),
    apprenticeshipEndDate: nullableText(row, "apprenticeship_end_date"),
    reviewerName: text(row, "reviewer_name"),
    sourceContactName: text(row, "source_contact_name"),
    sourceContactEmail: text(row, "source_contact_email"),
    sourceContactPhone: text(row, "source_contact_phone"),
    plannedReviewDate: nullableText(row, "planned_review_date"),
    companyId: nullableText(row, "company_id"),
    siteId: nullableText(row, "site_id"),
    managerRoleId: nullableText(row, "manager_role_id"),
  }));
  return { companies, sites, companySites, managers, roles, learners };
}

export async function loadDirectorySnapshot(
  supabase: SupabaseClient,
): Promise<DirectorySnapshot> {
  const [companies, sites, companySites, managers, roles, learners] = await Promise.all([
    supabase.from("employer_companies").select("*"),
    supabase.from("employer_sites").select("*"),
    supabase.from("employer_company_sites").select("*"),
    supabase.from("employer_managers").select("*"),
    supabase.from("employer_manager_roles").select("*"),
    supabase.from("review_learners").select("*"),
  ]);
  const error =
    companies.error ||
    sites.error ||
    companySites.error ||
    managers.error ||
    roles.error ||
    learners.error;
  if (error) throw new Error(error.message);
  return snapshotFromRows({
    companies: (companies.data ?? []) as Row[],
    sites: (sites.data ?? []) as Row[],
    companySites: (companySites.data ?? []) as Row[],
    managers: (managers.data ?? []) as Row[],
    roles: (roles.data ?? []) as Row[],
    learners: (learners.data ?? []) as Row[],
  });
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
    if (write.table === "employer_company_sites") {
      const { error } = await supabase
        .from("employer_company_sites")
        .delete()
        .eq("company_id", write.companyId)
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
  return code === "23505" && /portal_reference/i.test(message);
}
