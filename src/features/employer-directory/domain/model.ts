/**
 * Reviews-first data uses the existing portal identities.
 * A person is public.apprentices. A company is public.employers.
 * Review-only facts live on review_apprentice_details, one row per apprentice.
 * Sites and managers hang off employers. They are not a second company list.
 */

export const RELEASE_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

export type ReleaseDay = (typeof RELEASE_DAYS)[number];

export type EmployerRecord = {
  id: string;
  name: string;
  legalName: string;
  companyNumber: string;
  mainContact: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  town: string;
  postcode: string;
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

export type EmployerSite = {
  employerId: string;
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
  employerId: string;
  siteId: string | null;
  responsibility: string;
};

export type ApprenticePerson = {
  id: string;
  displayName: string;
  apprenticeReference: string;
  portalEntry: "onboarding" | "reviews";
};

export type ReviewDetails = {
  apprenticeId: string;
  version: number;
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
  employerId: string | null;
  siteId: string | null;
  managerRoleId: string | null;
};

export type DirectorySnapshot = {
  employers: EmployerRecord[];
  sites: Site[];
  employerSites: EmployerSite[];
  managers: Manager[];
  roles: ManagerRole[];
  apprentices: ApprenticePerson[];
  reviewDetails: ReviewDetails[];
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
  code?: "possible_duplicate" | "version_conflict" | "not_found" | "invalid";
  candidates?: Candidate[];
};

export type DirectoryWrite =
  | { op: "insert"; table: DirectoryTable; row: Record<string, unknown> }
  | {
      op: "rpc";
      fn: "create_review_apprentice" | "apply_review_apprentice_change";
      args: Record<string, unknown>;
    }
  | {
      op: "delete";
      table: "employer_site_memberships";
      employerId: string;
      siteId: string;
    }
  | { op: "delete"; table: "employer_manager_roles"; id: string };

export type DirectoryTable =
  | "employers"
  | "employer_sites"
  | "employer_site_memberships"
  | "employer_managers"
  | "employer_manager_roles"
  | "apprentices"
  | "review_apprentice_details";

export type DirectorySuccess = {
  ok: true;
  snapshot: DirectorySnapshot;
  writes: DirectoryWrite[];
};

export type EmployerInput = {
  name: string;
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
  employerId: string;
  siteId?: string | null;
  responsibility?: string;
};

export type ReviewApprenticeInput = {
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
  confirmDistinct?: boolean;
};

export type ReviewDetailPatch = Partial<
  Omit<ReviewApprenticeInput, "confirmDistinct" | "fullName">
> & { fullName?: string };

export type ReviewLink = {
  employerId: string | null;
  siteId: string | null;
  managerRoleId: string | null;
};

export type DirectoryAction =
  | { action: "createEmployer"; input: EmployerInput }
  | { action: "createSite"; input: SiteInput }
  | { action: "linkEmployerSite"; employerId: string; siteId: string }
  | { action: "unlinkEmployerSite"; employerId: string; siteId: string }
  | { action: "createManager"; input: ManagerInput }
  | { action: "assignManagerRole"; input: ManagerRoleInput }
  | { action: "removeManagerRole"; roleId: string }
  | { action: "createReviewApprentice"; input: ReviewApprenticeInput }
  | {
      action: "updateReviewDetails";
      apprenticeId: string;
      expectedVersion: number;
      patch: ReviewDetailPatch;
    }
  | {
      action: "linkReviewApprentice";
      apprenticeId: string;
      expectedVersion: number;
      link: ReviewLink;
    };

export function emptyDirectory(): DirectorySnapshot {
  return {
    employers: [],
    sites: [],
    employerSites: [],
    managers: [],
    roles: [],
    apprentices: [],
    reviewDetails: [],
  };
}
