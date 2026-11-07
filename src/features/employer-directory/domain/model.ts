/**
 * Reviews-first employer directory.
 * Company, physical site, and manager are separate identities.
 * A company can use many sites, and one site can host many companies.
 * A manager responsibility belongs to one company and, optionally, one of that company's sites.
 * Nothing here writes the legacy `employers` catalogue or the reviews app JSON.
 */

export const RELEASE_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

export type ReleaseDay = (typeof RELEASE_DAYS)[number];

export type Company = {
  id: string;
  name: string;
  legalName: string;
  companyNumber: string;
  notes: string;
  status: "active" | "inactive";
};

export type Site = {
  id: string;
  label: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  notes: string;
};

export type CompanySite = {
  companyId: string;
  siteId: string;
};

export type Manager = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  notes: string;
};

export type ManagerRole = {
  id: string;
  managerId: string;
  companyId: string;
  siteId: string | null;
  responsibility: string;
};

export type ReviewLearner = {
  id: string;
  portalReference: string;
  fullName: string;
  sourceCompanyName: string;
  sourcePostcode: string;
  releaseDay: "" | ReleaseDay;
  tutorName: string;
  apprenticeshipLabel: string;
  apprenticeshipStartDate: string | null;
  apprenticeshipEndDate: string | null;
  reviewerName: string;
  sourceContactName: string;
  sourceContactEmail: string;
  sourceContactPhone: string;
  plannedReviewDate: string | null;
  companyId: string | null;
  siteId: string | null;
  managerRoleId: string | null;
};

export type DirectorySnapshot = {
  companies: Company[];
  sites: Site[];
  companySites: CompanySite[];
  managers: Manager[];
  roles: ManagerRole[];
  learners: ReviewLearner[];
};

export type Candidate = {
  id: string;
  label: string;
  detail: string;
};

export type DirectoryFailure = {
  ok: false;
  status: number;
  error: string;
  code?: "possible_duplicate" | "not_found" | "invalid";
  candidates?: Candidate[];
};

export type DirectorySuccess = {
  ok: true;
  snapshot: DirectorySnapshot;
  writes: DirectoryWrite[];
};

export type DirectoryWrite =
  | { op: "insert"; table: DirectoryTable; row: Record<string, unknown> }
  | {
      op: "update";
      table: DirectoryTable;
      id: string;
      row: Record<string, unknown>;
    }
  | {
      op: "delete";
      table: "employer_company_sites";
      companyId: string;
      siteId: string;
    }
  | { op: "delete"; table: "employer_manager_roles"; id: string };

export type DirectoryTable =
  | "employer_companies"
  | "employer_sites"
  | "employer_company_sites"
  | "employer_managers"
  | "employer_manager_roles"
  | "review_learners";

export type DirectoryAction =
  | { action: "createCompany"; input: CompanyInput }
  | { action: "createSite"; input: SiteInput }
  | { action: "linkCompanySite"; companyId: string; siteId: string }
  | { action: "unlinkCompanySite"; companyId: string; siteId: string }
  | { action: "createManager"; input: ManagerInput }
  | { action: "assignManagerRole"; input: ManagerRoleInput }
  | { action: "removeManagerRole"; roleId: string }
  | { action: "createReviewLearner"; input: ReviewLearnerInput }
  | { action: "updateReviewLearner"; id: string; patch: ReviewLearnerPatch }
  | { action: "linkReviewLearner"; id: string; link: LearnerLink };

export type CompanyInput = {
  name: string;
  legalName?: string;
  companyNumber?: string;
  notes?: string;
  status?: "active" | "inactive";
  confirmDistinct?: boolean;
};

export type SiteInput = {
  label: string;
  addressLine1?: string;
  addressLine2?: string;
  town?: string;
  postcode?: string;
  notes?: string;
  confirmDistinct?: boolean;
};

export type ManagerInput = {
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
  confirmDistinct?: boolean;
};

export type ManagerRoleInput = {
  managerId: string;
  companyId: string;
  siteId?: string | null;
  responsibility?: string;
};

export type ReviewLearnerInput = {
  fullName: string;
  sourceCompanyName?: string;
  sourcePostcode?: string;
  releaseDay?: string;
  tutorName?: string;
  apprenticeshipLabel?: string;
  apprenticeshipStartDate?: string;
  apprenticeshipEndDate?: string;
  reviewerName?: string;
  sourceContactName?: string;
  sourceContactEmail?: string;
  sourceContactPhone?: string;
  plannedReviewDate?: string;
};

export type ReviewLearnerPatch = Partial<ReviewLearnerInput>;

export type LearnerLink = {
  companyId: string | null;
  siteId: string | null;
  managerRoleId: string | null;
};

export function emptyDirectory(): DirectorySnapshot {
  return {
    companies: [],
    sites: [],
    companySites: [],
    managers: [],
    roles: [],
    learners: [],
  };
}
