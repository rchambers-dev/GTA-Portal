export type EnrolmentKind = "new_starter" | "currently_studying";

export type EnrolmentStatus =
  | "draft"
  | "pending_start"
  | "active"
  | "completed"
  | "withdrawn";

/**
 * A person on the Apprentice Intake funnel. Personal details are captured once
 * here; enrolments link to this record instead of re-keying the data.
 */
export type AdminApprenticeRecord = {
  id: string;
  displayName: string;
  /** GTAn apprentice reference, e.g. GTA-2026-01021. Generated if left blank. */
  apprenticeReference: string;
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
   * still happen on the Apprentices page after they're on the system.
   */
  intakeStatus: "in_progress" | "ready";
  /**
   * Evidence pack state, keyed by ADM14 reference (e.g. "1.2").
   * Items not present default to missing (or future for end-of-programme
   * items) — the pack fills in over the apprentice's lifecycle.
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

export type AdminApprenticeEnrolment = {
  id: string;
  kind: EnrolmentKind;
  status: EnrolmentStatus;
  /** Link to the intake apprentice record this enrolment belongs to. */
  apprenticeId: string | null;
  displayName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  uln: string;
  programmeName: string;
  standardCode: string;
  /** Cohort this apprentice belongs to — pins programme version for their journey. */
  cohortId: string | null;
  /** Teaching group within the cohort — inherits tutor + college days. */
  teachingGroupId: string | null;
  employerId: string;
  employerName: string;
  workplaceContact: string;
  mentorName: string;
  tutorName: string;
  /** Planned / actual start — required for both kinds. */
  startDate: string;
  /** Original planned finish date used for slippage framing. */
  originalPlannedEndDate: string;
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
 * An intake delivering one version of a programme (not day-specific).
 * Teaching groups under tutors sit on the cohort.
 */
export type AdminCohortRecord = {
  id: string;
  /** e.g. Autocare L2 (ST0499) · v1.0 · Jan 2026–Jul 2028 */
  name: string;
  programmeId: string;
  programmeName: string;
  standardCode: string;
  /** Skills England version this cohort delivers, e.g. 1.2 */
  standardVersion: string;
  /**
   * Delivery UI spine for this intake: groups (CEA / Temp) or blocks (Main).
   * Same standardVersion can run on either spine for different cohorts.
   */
  deliverySpine: "groups" | "blocks";
  /**
   * Date the intake opens for enrolment (ISO date). New apprentices auto-flow into a
   * planned cohort from this date until it goes active.
   */
  enrolmentOpensDate: string;
  /** Intake start date — when teaching/delivery begins (ISO date). */
  startDate: string;
  /** Expected end / gateway date (ISO date), optional. */
  expectedEndDate: string;
  /**
   * @deprecated Prefer teaching groups. Kept for legacy rows / migration.
   */
  teachingGroup: string;
  /**
   * @deprecated Prefer teaching groups. Kept for legacy rows / migration.
   */
  collegeDays: string;
  /**
   * Teachers who may own groups on this intake.
   */
  teacherNames: string[];
  /**
   * Joined teacher list for storage (`Name | Name`). Prefer teacherNames.
   */
  tutorName: string;
  /** Intake lifecycle — not a pause control. */
  status: "planned" | "active" | "completed";
  notes: string;
  /**
   * When true, cohort details, teachers, groups, and placements cannot change.
   * Unlock only to make corrections, then Save & lock (or leave to auto-lock).
   */
  locked: boolean;
  createdAt: string;
  updatedAt: string;
};

/** One Save & lock / leave-lock session summary for a cohort. */
export type AdminCohortChangeLogEntry = {
  id: string;
  cohortId: string;
  createdAt: string;
  summary: string;
  /** Human-readable bullets from the editing session. */
  details: string[];
  actorName: string;
};

/** One tutor's class within a cohort (college days + capacity). */
export type AdminTeachingGroupRecord = {
  id: string;
  cohortId: string;
  /** Group owner — all apprentices in this group share this tutor. */
  tutorName: string;
  name: string;
  collegeDays: string;
  /** Soft max apprentices; admins may override when assigning. */
  capacity: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminPortalRole =
  | "Apprentice"
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
  /** Org-chart job titles — separate from portal role (Tutor / Admin / Management). */
  jobTitles: string[];
  linkedEnrolmentId: string | null;
  linkedApprenticeId: string | null;
  linkedEmployerId: string | null;
  /** When the linked apprentice's programme start began — drives new-starter badge. */
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
  version: 19;
  apprentices: AdminApprenticeRecord[];
  enrolments: AdminApprenticeEnrolment[];
  employers: AdminEmployerRecord[];
  programmes: AdminProgrammeRecord[];
  cohorts: AdminCohortRecord[];
  teachingGroups: AdminTeachingGroupRecord[];
  cohortChangeLogs: AdminCohortChangeLogEntry[];
  users: AdminPortalUser[];
};
