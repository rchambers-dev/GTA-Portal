/**
 * DfE Learning Records Service (LRS) — Personal Learning Record port.
 *
 * Production uses LRS LRB web services (SOAP/XML + client certificate),
 * not a public REST API. GTA must be approved for Get Learner Learning Events.
 */

export type LrsGender = "M" | "F" | "U" | "";

export type LrsLearnerIdentity = {
  uln: string;
  givenName: string;
  familyName: string;
  dateOfBirth?: string;
  gender?: LrsGender;
};

export type PlrQualificationSource =
  | "awarding_organisation"
  | "ilr"
  | "national_pupil_database"
  | "other"
  | "unknown";

export type PlrQualification = {
  id: string;
  title: string;
  qualificationCode: string;
  level: string;
  grade: string;
  credits: string | null;
  awardingOrganisation: string;
  previousProvider: string | null;
  startDate: string | null;
  endDate: string | null;
  awardDate: string | null;
  source: PlrQualificationSource;
  sensitiveHidden?: boolean;
};

export type PlrParticipation = {
  id: string;
  title: string;
  provider: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
};

export type PlrLearningRecord = {
  uln: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string | null;
  verified: boolean;
  privacyAllowsSharing: boolean;
  retrievedAt: string;
  qualifications: PlrQualification[];
  participations: PlrParticipation[];
  /** LRS vendor / organisation echo for audit */
  vendorId: string | null;
  notes: string[];
};

export type LrsFindUlnResult =
  | { status: "found"; uln: string }
  | { status: "not_found"; message: string }
  | { status: "ambiguous"; message: string };

export type LrsGetPlrResult =
  | { status: "ok"; record: PlrLearningRecord }
  | { status: "not_verified"; message: string }
  | { status: "privacy_blocked"; message: string }
  | { status: "not_configured"; message: string }
  | { status: "error"; message: string };

/**
 * Port for LRS operations used by the portal.
 * Mock adapter for local demo; SOAP adapter later once GTA holds LRB credentials.
 */
export interface LrsPlrPort {
  readonly mode: "mock" | "soap";
  findUln(identity: Omit<LrsLearnerIdentity, "uln"> & { uln?: string }): Promise<LrsFindUlnResult>;
  getLearnerLearningEvents(identity: LrsLearnerIdentity): Promise<LrsGetPlrResult>;
}
