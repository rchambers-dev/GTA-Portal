export type EnrolmentKind = "new_starter" | "currently_studying";

export type EnrolmentStatus =
  | "draft"
  | "pending_start"
  | "active"
  | "completed"
  | "withdrawn";

export type AdminLearnerEnrolment = {
  id: string;
  kind: EnrolmentKind;
  status: EnrolmentStatus;
  displayName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  uln: string;
  programmeName: string;
  standardCode: string;
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

export type AdminPortalRole =
  | "Learner"
  | "Employer"
  | "Tutor"
  | "Learning and Progress Mentor"
  | "Administrator"
  | "Quality"
  | "Management";

export type AdminPortalUser = {
  id: string;
  displayName: string;
  email: string;
  role: AdminPortalRole;
  workspace: string;
  linkedEnrolmentId: string | null;
  linkedEmployerId: string | null;
  status: "active" | "invited" | "disabled";
  createdAt: string;
  updatedAt: string;
};

export type AdminStoreSnapshot = {
  version: 4;
  enrolments: AdminLearnerEnrolment[];
  employers: AdminEmployerRecord[];
  programmes: AdminProgrammeRecord[];
  users: AdminPortalUser[];
};
