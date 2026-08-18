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
  /**
   * Exact GTA programme version used for curriculum valuation, RPL and TNP.
   * Null until explicitly bound — never auto-bind to "newest" on publish.
   */
  gtaProgrammeVersionId: string | null;
  /** Cohort / intake this apprentice entered under. Independent of Teaching Group. */
  cohortId: string | null;
  /**
   * Transitional current Teaching Group pointer.
   * Durable history lives on teaching_group_memberships; keep this in sync
   * with the active membership. Do not treat this as the full history.
   */
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
 * An administrative intake grouping (programme + Skills England version).
 * Does not own Teaching Groups, live tutor, or college days.
 * Individual apprenticeship dates live on the enrolment, not here.
 */
export type AdminCohortRecord = {
  id: string;
  /** e.g. Autocare L2 (ST0499) · v1.3 · Blocks · Sept 2026 Intake */
  name: string;
  programmeId: string;
  programmeName: string;
  standardCode: string;
  /** Skills England version this intake delivers, e.g. 1.3. Locked after start. */
  standardVersion: string;
  /**
   * Stored cohort column. Groups/CEA is retired; runtime always normalizes to blocks.
   */
  deliverySpine: "groups" | "blocks";
  /**
   * Enrolment Opens — one calendar month before Intake Start (ISO date).
   */
  enrolmentOpensDate: string;
  /** Intake Start — when this intake begins (ISO date). Not each learner's start. */
  startDate: string;
  /**
   * @deprecated Not part of the intake business model. Kept on the row so we
   * do not need a destructive migration. Do not copy onto enrolments.
   */
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
   * @deprecated Cohort teacher pool. Not used to create Teaching Groups or
   * grant delivery permissions. Kept as legacy storage.
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

export type AdminTeachingGroupStatus = "active" | "inactive";

export type AdminGtaProgrammeVersionStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "published"
  | "superseded"
  | "archived";

/** Selectable GTA curriculum version for pinning and Teaching Groups. */
export type AdminGtaProgrammeVersionOption = {
  id: string;
  programmeId: string;
  programmeTitle: string;
  standardCode: string;
  /** Skills England external version, e.g. 1.3 */
  skillsEnglandVersion: string;
  internalVersion: string;
  status: AdminGtaProgrammeVersionStatus;
  /** Spine title(s) when loaded; empty if unknown. */
  deliverySpine: string;
};

/** Independent tutor-led class. Not owned by a Cohort. */
export type AdminTeachingGroupRecord = {
  id: string;
  /**
   * Legacy/optional intake link. New groups are null.
   * Not the primary relationship after Phase 2.
   */
  cohortId: string | null;
  /** Pinned GTA curriculum version this class delivers. Null until proven or assigned. */
  gtaProgrammeVersionId: string | null;
  /** True when existing data could not safely prove a GTA programme version. */
  versionReviewRequired: boolean;
  status: AdminTeachingGroupStatus;
  /** Group owner — operational source of truth for the tutor. */
  tutorName: string;
  name: string;
  collegeDays: string;
  /** Soft max apprentices; admins may override when assigning. */
  capacity: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminTeachingGroupMembershipSource = "staff" | "legacy_backfill";

/**
 * Durable Teaching Group membership history.
 * joinedAt is null when the true join date is unknown (legacy backfill).
 */
export type AdminTeachingGroupMembership = {
  id: string;
  enrolmentId: string;
  teachingGroupId: string;
  joinedAt: string | null;
  leftAt: string | null;
  isCurrent: boolean;
  source: AdminTeachingGroupMembershipSource;
  recordedAt: string;
  actorName: string;
  notes: string;
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
  version: 20;
  apprentices: AdminApprenticeRecord[];
  enrolments: AdminApprenticeEnrolment[];
  employers: AdminEmployerRecord[];
  programmes: AdminProgrammeRecord[];
  cohorts: AdminCohortRecord[];
  teachingGroups: AdminTeachingGroupRecord[];
  teachingGroupMemberships: AdminTeachingGroupMembership[];
  gtaProgrammeVersions: AdminGtaProgrammeVersionOption[];
  cohortChangeLogs: AdminCohortChangeLogEntry[];
  users: AdminPortalUser[];
};
