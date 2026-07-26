export type EnrolmentKind = "new_starter" | "currently_studying";

export type EnrolmentStatus =
  | "draft"
  | "pending_start"
  | "active"
  | "completed"
  | "withdrawn";

/**
 * A person on the learner intake funnel. Personal details are captured once
 * here; enrolments link to this record instead of re-keying the data.
 */
export type AdminLearnerRecord = {
  id: string;
  displayName: string;
  /** GTA learner reference, e.g. GTA-2026-01021. Generated if left blank. */
  learnerReference: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  uln: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  /** Learning support / access arrangements to know about. */
  supportNotes: string;
  /**
   * Draft vs finished personal intake.
   * Admins can save mid-way and come back — evidence pack amendments
   * still happen on the Learners page after they're on the system.
   */
  intakeStatus: "in_progress" | "ready";
  /**
   * Evidence pack state, keyed by ADM14 reference (e.g. "1.2").
   * Items not present default to missing (or future for end-of-programme
   * items) — the pack fills in over the learner's lifecycle.
   */
  pack: Record<string, AdminPackItemStatus>;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminPackItemStatus =
  | "missing"
  | "requested"
  | "received"
  | "checked"
  | "not_applicable";

export type AdminLearnerEnrolment = {
  id: string;
  kind: EnrolmentKind;
  status: EnrolmentStatus;
  /** Link to the intake learner record this enrolment belongs to. */
  learnerId: string | null;
  displayName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  uln: string;
  programmeName: string;
  standardCode: string;
  /** Cohort this learner belongs to — pins programme version for their journey. */
  cohortId: string | null;
  employerId: string;
  employerName: string;
  workplaceContact: string;
  mentorName: string;
  tutorName: string;
  /** Planned / actual start — required for both kinds. */
  startDate: string;
  /** For currently studying — where they are now. */
  programmeYear: 1 | 2 | 3 | null;
  programmeWeek: number | null;
  attendancePercent: number | null;
  actualProgressPercent: number | null;
  collegeDays: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminEmployerRecord = {
  id: string;
  /** Trading / garage name shown in the portal. */
  name: string;
  /** Optional legal company name if different from trading name. */
  legalName: string;
  companyNumber: string;
  mainContact: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  website: string;
  status: "active" | "inactive";
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminProgrammeRecord = {
  id: string;
  /** Portal display name, e.g. Autocare Level 2 */
  name: string;
  /** Skills England / IfATE standard reference, e.g. ST0499 */
  standardCode: string;
  level: 2 | 3 | 4 | 5 | 6 | 7;
  /** Route from the occupational standard, e.g. Engineering and manufacturing */
  route: string;
  /** Typical delivery length in months */
  durationMonths: number;
  /** Awarding body / EPA organisation hint for ops */
  awardingBody: string;
  status: "active" | "inactive" | "retired";
  summary: string;
  skillsEnglandUrl: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * An intake / teaching group delivering one version of a programme.
 * Multiple cohorts of the same standard can run at once (e.g. v1.2 and v1.3)
 * while older starts finish what they started.
 */
export type AdminCohortRecord = {
  id: string;
  /** e.g. Autocare L2 · Sept 2024 */
  name: string;
  programmeId: string;
  programmeName: string;
  standardCode: string;
  /** Skills England version this cohort delivers, e.g. 1.2 */
  standardVersion: string;
  /**
   * Date the intake opens for enrolment (ISO date). New pupils auto-flow into a
   * planned cohort from this date until it goes active.
   */
  enrolmentOpensDate: string;
  /** Intake start date — when teaching/delivery begins (ISO date). */
  startDate: string;
  /** Expected end / gateway date (ISO date), optional. */
  expectedEndDate: string;
  /** Teaching group label, e.g. Mon–Tue Group A */
  teachingGroup: string;
  collegeDays: string;
  tutorName: string;
  /** Intake lifecycle — not a pause control. */
  status: "planned" | "active" | "completed";
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminPortalRole =
  | "Learner"
  | "Employer"
  | "Tutor"
  | "Learning and Progress Mentor"
  | "Administrator"
  | "Quality"
  | "Management"
  | "Owner";

export type AdminPortalUser = {
  id: string;
  displayName: string;
  email: string;
  role: AdminPortalRole;
  workspace: string;
  linkedEnrolmentId: string | null;
  linkedLearnerId: string | null;
  linkedEmployerId: string | null;
  /** When the linked learner's programme start began — drives new-starter badge. */
  programmeStartDate: string | null;
  status: "active" | "invited" | "disabled";
  /** Name of the staff member who last enabled the portal environment. */
  enabledBy: string | null;
  enabledAt: string | null;
  /** Name of the staff member who last disabled the portal environment. */
  disabledBy: string | null;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminStoreSnapshot = {
  version: 13;
  learners: AdminLearnerRecord[];
  enrolments: AdminLearnerEnrolment[];
  employers: AdminEmployerRecord[];
  programmes: AdminProgrammeRecord[];
  cohorts: AdminCohortRecord[];
  users: AdminPortalUser[];
};
