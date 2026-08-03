/**
 * Linked Progress Mentor caseload mock data.
 * Same apprentice/employer/programme IDs are reused across all mentor workspace pages.
 */

export const MENTOR_ID = "reiss-chambers";
export const MENTOR_NAME = "Reiss Chambers";

export type MentorApprenticeRow = {
  apprenticeId: string;
  displayName: string;
  initials: string;
  employerId: string;
  employerName: string;
  programmeId: string;
  programmeName: string;
  tutorName: string;
  programmeYear: 1 | 2 | 3;
  programmeWeek: number | null;
  plannedProgressPercent: number;
  actualProgressPercent: number;
  attendancePercent: number | null;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  openActionCount: number;
  interventionId: string | null;
  interventionType: string | null;
  employerConcernStatus: "none" | "open" | "urgent" | "monitoring";
  riskStatus: "on_track" | "slightly_behind" | "significantly_behind" | "priority" | "overdue" | "pre_start";
  lastContactDate: string | null;
  missingMandatoryEvidence: number;
  epaApproaching: boolean;
  programmeOverdue: boolean;
  status: "active" | "pre_start" | "completed";
};

export type MentorReviewRow = {
  reviewId: string;
  apprenticeId: string;
  apprenticeName: string;
  employerName: string;
  programmeName: string;
  reviewDate: string;
  reviewType: string;
  preparationStatus: string;
  apprenticeReflection: string;
  employerFeedback: string;
  previousActionsChecked: boolean;
  evidenceReadiness: string;
  reviewStatus: string;
  signOffStatus: string;
  view:
    | "upcoming"
    | "preparation"
    | "ready"
    | "in_progress"
    | "awaiting_apprentice"
    | "awaiting_employer"
    | "awaiting_provider"
    | "completed"
    | "overdue"
    | "rearranged";
};

export type MentorActionRow = {
  actionId: string;
  title: string;
  apprenticeId: string;
  apprenticeName: string;
  employerId: string;
  employerName: string;
  owner: string;
  ownerType: "apprentice" | "employer" | "tutor" | "provider" | "mentor";
  sourceType: string;
  sourceId: string;
  createdAt: string;
  dueDate: string;
  checkpointDate: string;
  successMeasure: string;
  evidenceRequirement: string;
  status: "open" | "overdue" | "awaiting_evidence" | "escalated" | "completed";
  escalationStatus: string | null;
  lastUpdate: string;
  assignedToMe: boolean;
  assignedByMe: boolean;
};

export type MentorEmployerRow = {
  employerId: string;
  name: string;
  mainContact: string;
  activeApprentices: number;
  programmes: string[];
  lastContact: string | null;
  nextContact: string | null;
  reviewAttendanceRate: number;
  openCommitments: number;
  overdueCommitments: number;
  openConcerns: number;
  engagementStatus: "strong" | "steady" | "low" | "at_risk";
  lastFeedback: string | null;
};

export type MentorConcernRow = {
  caseId: string;
  caseReference: string;
  employerId: string;
  employerName: string;
  apprenticeId: string;
  apprenticeName: string;
  programmeName: string;
  concernType: string;
  priority: "normal" | "urgent";
  dateRaised: string;
  employmentRisk: boolean;
  welfareImpact: boolean;
  assignedStaff: string;
  status:
    | "new"
    | "urgent"
    | "awaiting_triage"
    | "investigating"
    | "awaiting_employer"
    | "awaiting_internal"
    | "action_agreed"
    | "monitoring"
    | "resolved"
    | "closed";
  lastUpdate: string;
  nextAction: string;
};

export type MentorInterventionRow = {
  interventionId: string;
  apprenticeId: string;
  apprenticeName: string;
  type: string;
  reason: string;
  desiredOutcome: string;
  owner: string;
  startDate: string;
  nextCheckpoint: string;
  reviewDate: string;
  currentImpact: string;
  status:
    | "proposed"
    | "active"
    | "due_checkpoint"
    | "improving"
    | "no_improvement"
    | "escalated"
    | "completed"
    | "closed";
  priority: "normal" | "high";
};

export type MentorMessageRow = {
  messageId: string;
  conversationType: string;
  subject: string;
  linkedType: string | null;
  linkedId: string | null;
  linkedLabel: string | null;
  lastMessageAt: string;
  unread: boolean;
  participants: string;
};

export const MENTOR_EMPLOYERS: MentorEmployerRow[] = [
  {
    employerId: "emp-northline",
    name: "Northline Services Ltd",
    mainContact: "James Wilson",
    activeApprentices: 4,
    programmes: ["Plumbing Eng. L3", "Electrical Install L3"],
    lastContact: "2026-07-10",
    nextContact: "2026-07-24",
    reviewAttendanceRate: 92,
    openCommitments: 3,
    overdueCommitments: 1,
    openConcerns: 1,
    engagementStatus: "steady",
    lastFeedback: "Needs clearer OTJ scheduling",
  },
  {
    employerId: "emp-riverside",
    name: "Riverside Autocare",
    mainContact: "Priya Shah",
    activeApprentices: 3,
    programmes: ["Motor Vehicle L3", "Accident Repair Technician"],
    lastContact: "2026-07-08",
    nextContact: "2026-07-22",
    reviewAttendanceRate: 88,
    openCommitments: 2,
    overdueCommitments: 2,
    openConcerns: 1,
    engagementStatus: "at_risk",
    lastFeedback: "Concerned about attendance",
  },
  {
    employerId: "emp-donvalley",
    name: "Don Valley Bodyworks",
    mainContact: "Mark Holton",
    activeApprentices: 4,
    programmes: ["Panel Technician L3", "Accident Repair Technician"],
    lastContact: "2026-07-14",
    nextContact: "2026-07-28",
    reviewAttendanceRate: 95,
    openCommitments: 1,
    overdueCommitments: 0,
    openConcerns: 0,
    engagementStatus: "strong",
    lastFeedback: "Happy with progress reviews",
  },
  {
    employerId: "emp-ashfield",
    name: "Ashfield Logistics",
    mainContact: "Claire Dunn",
    activeApprentices: 3,
    programmes: ["Business Admin L3"],
    lastContact: "2026-06-20",
    nextContact: "2026-07-18",
    reviewAttendanceRate: 70,
    openCommitments: 4,
    overdueCommitments: 2,
    openConcerns: 1,
    engagementStatus: "low",
    lastFeedback: "Missed last two commitments",
  },
  {
    employerId: "emp-peak",
    name: "Peak Power Solutions",
    mainContact: "Tom Greaves",
    activeApprentices: 3,
    programmes: ["Electrical Install L3"],
    lastContact: "2026-07-12",
    nextContact: "2026-07-26",
    reviewAttendanceRate: 90,
    openCommitments: 2,
    overdueCommitments: 0,
    openConcerns: 0,
    engagementStatus: "steady",
    lastFeedback: null,
  },
  {
    employerId: "emp-hexthorpe",
    name: "Hexthorpe Motors",
    mainContact: "Sam Ridley",
    activeApprentices: 3,
    programmes: ["Motor Vehicle L3"],
    lastContact: "2026-07-05",
    nextContact: "2026-07-19",
    reviewAttendanceRate: 85,
    openCommitments: 2,
    overdueCommitments: 0,
    openConcerns: 0,
    engagementStatus: "steady",
    lastFeedback: "Gateway evidence still outstanding",
  },
];

export const MENTOR_APPRENTICES: MentorApprenticeRow[] = [
  {
    apprenticeId: "lrn-james-wilson",
    displayName: "James Wilson",
    initials: "JW",
    employerId: "emp-northline",
    employerName: "Northline Services Ltd",
    programmeId: "prog-plumbing",
    programmeName: "Plumbing Eng. L3",
    tutorName: "Sarah Patel",
    programmeYear: 1,
    programmeWeek: 3,
    plannedProgressPercent: 6,
    actualProgressPercent: 7,
    attendancePercent: 96,
    lastReviewDate: "2026-06-20",
    nextReviewDate: "2026-07-25",
    openActionCount: 1,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "none",
    riskStatus: "on_track",
    lastContactDate: "2026-07-10",
    missingMandatoryEvidence: 0,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-ava-brooks",
    displayName: "Ava Brooks",
    initials: "AB",
    employerId: "emp-riverside",
    employerName: "Riverside Autocare",
    programmeId: "prog-motor",
    programmeName: "Motor Vehicle L3",
    tutorName: "Daniel Turner",
    programmeYear: 1,
    programmeWeek: 14,
    plannedProgressPercent: 27,
    actualProgressPercent: 22,
    attendancePercent: 91,
    lastReviewDate: "2026-06-01",
    nextReviewDate: "2026-07-12",
    openActionCount: 2,
    interventionId: "int-ava-progress",
    interventionType: "Progress recovery",
    employerConcernStatus: "open",
    riskStatus: "slightly_behind",
    lastContactDate: "2026-07-08",
    missingMandatoryEvidence: 1,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-liam-anderson",
    displayName: "Liam Anderson",
    initials: "LA",
    employerId: "emp-donvalley",
    employerName: "Don Valley Bodyworks",
    programmeId: "prog-panel",
    programmeName: "Panel Technician L3",
    tutorName: "Sarah Patel",
    programmeYear: 1,
    programmeWeek: 18,
    plannedProgressPercent: 35,
    actualProgressPercent: 28,
    attendancePercent: 89,
    lastReviewDate: "2026-06-15",
    nextReviewDate: "2026-07-20",
    openActionCount: 3,
    interventionId: "int-liam-evidence",
    interventionType: "Evidence recovery",
    employerConcernStatus: "none",
    riskStatus: "slightly_behind",
    lastContactDate: "2026-07-14",
    missingMandatoryEvidence: 2,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-mia-chen",
    displayName: "Mia Chen",
    initials: "MC",
    employerId: "emp-ashfield",
    employerName: "Ashfield Logistics",
    programmeId: "prog-admin",
    programmeName: "Business Admin L3",
    tutorName: "Priya Shah",
    programmeYear: 1,
    programmeWeek: 30,
    plannedProgressPercent: 58,
    actualProgressPercent: 41,
    attendancePercent: 84,
    lastReviewDate: "2026-05-20",
    nextReviewDate: "2026-07-17",
    openActionCount: 5,
    interventionId: "int-mia-employer",
    interventionType: "Employer support",
    employerConcernStatus: "urgent",
    riskStatus: "priority",
    lastContactDate: "2026-07-11",
    missingMandatoryEvidence: 0,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-noah-reid",
    displayName: "Noah Reid",
    initials: "NR",
    employerId: "emp-peak",
    employerName: "Peak Power Solutions",
    programmeId: "prog-electrical",
    programmeName: "Electrical Install L3",
    tutorName: "Sarah Patel",
    programmeYear: 1,
    programmeWeek: 22,
    plannedProgressPercent: 42,
    actualProgressPercent: 30,
    attendancePercent: 72,
    lastReviewDate: "2026-06-10",
    nextReviewDate: "2026-07-19",
    openActionCount: 2,
    interventionId: "int-noah-attendance",
    interventionType: "Attendance improvement",
    employerConcernStatus: "none",
    riskStatus: "significantly_behind",
    lastContactDate: "2026-07-12",
    missingMandatoryEvidence: 0,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-sofia-martinez",
    displayName: "Sofia Martinez",
    initials: "SM",
    employerId: "emp-northline",
    employerName: "Northline Services Ltd",
    programmeId: "prog-plumbing",
    programmeName: "Plumbing Eng. L3",
    tutorName: "Not assigned",
    programmeYear: 1,
    programmeWeek: null,
    plannedProgressPercent: 0,
    actualProgressPercent: 0,
    attendancePercent: null,
    lastReviewDate: null,
    nextReviewDate: null,
    openActionCount: 1,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "none",
    riskStatus: "pre_start",
    lastContactDate: "2026-07-01",
    missingMandatoryEvidence: 4,
    epaApproaching: false,
    programmeOverdue: false,
    status: "pre_start",
  },
  {
    apprenticeId: "lrn-ethan-clarke",
    displayName: "Ethan Clarke",
    initials: "EC",
    employerId: "emp-hexthorpe",
    employerName: "Hexthorpe Motors",
    programmeId: "prog-motor",
    programmeName: "Motor Vehicle L3",
    tutorName: "Daniel Turner",
    programmeYear: 3,
    programmeWeek: 110,
    plannedProgressPercent: 100,
    actualProgressPercent: 88,
    attendancePercent: 88,
    lastReviewDate: "2026-06-01",
    nextReviewDate: "2026-07-16",
    openActionCount: 4,
    interventionId: "int-ethan-overdue",
    interventionType: "Programme-overdue recovery",
    employerConcernStatus: "none",
    riskStatus: "overdue",
    lastContactDate: "2026-07-05",
    missingMandatoryEvidence: 3,
    epaApproaching: true,
    programmeOverdue: true,
    status: "active",
  },
  {
    apprenticeId: "lrn-isla-bennett",
    displayName: "Isla Bennett",
    initials: "IB",
    employerId: "emp-donvalley",
    employerName: "Don Valley Bodyworks",
    programmeId: "prog-panel",
    programmeName: "Panel Technician L3",
    tutorName: "Sarah Patel",
    programmeYear: 1,
    programmeWeek: 8,
    plannedProgressPercent: 15,
    actualProgressPercent: 16,
    attendancePercent: 98,
    lastReviewDate: "2026-06-28",
    nextReviewDate: "2026-08-01",
    openActionCount: 2,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "none",
    riskStatus: "on_track",
    lastContactDate: "2026-07-14",
    missingMandatoryEvidence: 0,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-oscar-hayes",
    displayName: "Oscar Hayes",
    initials: "OH",
    employerId: "emp-peak",
    employerName: "Peak Power Solutions",
    programmeId: "prog-electrical",
    programmeName: "Electrical Install L3",
    tutorName: "Daniel Turner",
    programmeYear: 2,
    programmeWeek: 60,
    plannedProgressPercent: 55,
    actualProgressPercent: 52,
    attendancePercent: 94,
    lastReviewDate: "2026-06-18",
    nextReviewDate: "2026-07-21",
    openActionCount: 1,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "none",
    riskStatus: "on_track",
    lastContactDate: "2026-07-09",
    missingMandatoryEvidence: 0,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-amelia-frost",
    displayName: "Amelia Frost",
    initials: "AF",
    employerId: "emp-ashfield",
    employerName: "Ashfield Logistics",
    programmeId: "prog-admin",
    programmeName: "Business Admin L3",
    tutorName: "Priya Shah",
    programmeYear: 2,
    programmeWeek: 70,
    plannedProgressPercent: 65,
    actualProgressPercent: 58,
    attendancePercent: 86,
    lastReviewDate: "2026-05-30",
    nextReviewDate: "2026-07-18",
    openActionCount: 2,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "monitoring",
    riskStatus: "slightly_behind",
    lastContactDate: "2026-06-20",
    missingMandatoryEvidence: 1,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-harvey-cole",
    displayName: "Harvey Cole",
    initials: "HC",
    employerId: "emp-riverside",
    employerName: "Riverside Autocare",
    programmeId: "prog-art",
    programmeName: "Accident Repair Technician",
    tutorName: "Sarah Patel",
    programmeYear: 2,
    programmeWeek: 78,
    plannedProgressPercent: 72,
    actualProgressPercent: 60,
    attendancePercent: 80,
    lastReviewDate: "2026-06-05",
    nextReviewDate: "2026-07-15",
    openActionCount: 3,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "open",
    riskStatus: "significantly_behind",
    lastContactDate: "2026-07-08",
    missingMandatoryEvidence: 2,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-freya-ward",
    displayName: "Freya Ward",
    initials: "FW",
    employerId: "emp-donvalley",
    employerName: "Don Valley Bodyworks",
    programmeId: "prog-art",
    programmeName: "Accident Repair Technician",
    tutorName: "Daniel Turner",
    programmeYear: 3,
    programmeWeek: 140,
    plannedProgressPercent: 95,
    actualProgressPercent: 93,
    attendancePercent: 97,
    lastReviewDate: "2026-07-01",
    nextReviewDate: "2026-08-05",
    openActionCount: 1,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "none",
    riskStatus: "on_track",
    lastContactDate: "2026-07-14",
    missingMandatoryEvidence: 0,
    epaApproaching: true,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-leo-griffin",
    displayName: "Leo Griffin",
    initials: "LG",
    employerId: "emp-northline",
    employerName: "Northline Services Ltd",
    programmeId: "prog-plumbing",
    programmeName: "Plumbing Eng. L3",
    tutorName: "Sarah Patel",
    programmeYear: 2,
    programmeWeek: 55,
    plannedProgressPercent: 50,
    actualProgressPercent: 48,
    attendancePercent: 93,
    lastReviewDate: "2026-06-22",
    nextReviewDate: "2026-07-29",
    openActionCount: 0,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "none",
    riskStatus: "on_track",
    lastContactDate: "2026-07-10",
    missingMandatoryEvidence: 0,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-chloe-nash",
    displayName: "Chloe Nash",
    initials: "CN",
    employerId: "emp-hexthorpe",
    employerName: "Hexthorpe Motors",
    programmeId: "prog-motor",
    programmeName: "Motor Vehicle L3",
    tutorName: "Daniel Turner",
    programmeYear: 1,
    programmeWeek: 12,
    plannedProgressPercent: 23,
    actualProgressPercent: 20,
    attendancePercent: 90,
    lastReviewDate: "2026-06-12",
    nextReviewDate: "2026-07-22",
    openActionCount: 1,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "none",
    riskStatus: "slightly_behind",
    lastContactDate: "2026-07-05",
    missingMandatoryEvidence: 1,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-dylan-moore",
    displayName: "Dylan Moore",
    initials: "DM",
    employerId: "emp-peak",
    employerName: "Peak Power Solutions",
    programmeId: "prog-electrical",
    programmeName: "Electrical Install L3",
    tutorName: "Sarah Patel",
    programmeYear: 3,
    programmeWeek: 145,
    plannedProgressPercent: 98,
    actualProgressPercent: 90,
    attendancePercent: 91,
    lastReviewDate: "2026-06-28",
    nextReviewDate: "2026-07-14",
    openActionCount: 2,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "none",
    riskStatus: "slightly_behind",
    lastContactDate: "2026-07-12",
    missingMandatoryEvidence: 1,
    epaApproaching: true,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-ellie-scott",
    displayName: "Ellie Scott",
    initials: "ES",
    employerId: "emp-ashfield",
    employerName: "Ashfield Logistics",
    programmeId: "prog-admin",
    programmeName: "Business Admin L3",
    tutorName: "Priya Shah",
    programmeYear: 1,
    programmeWeek: 5,
    plannedProgressPercent: 10,
    actualProgressPercent: 11,
    attendancePercent: 99,
    lastReviewDate: null,
    nextReviewDate: "2026-07-30",
    openActionCount: 0,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "none",
    riskStatus: "on_track",
    lastContactDate: "2026-07-02",
    missingMandatoryEvidence: 0,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-finley-brooks",
    displayName: "Finley Brooks",
    initials: "FB",
    employerId: "emp-riverside",
    employerName: "Riverside Autocare",
    programmeId: "prog-motor",
    programmeName: "Motor Vehicle L3",
    tutorName: "Daniel Turner",
    programmeYear: 2,
    programmeWeek: 66,
    plannedProgressPercent: 60,
    actualProgressPercent: 45,
    attendancePercent: 78,
    lastReviewDate: "2026-05-15",
    nextReviewDate: "2026-07-13",
    openActionCount: 4,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "none",
    riskStatus: "priority",
    lastContactDate: "2026-07-08",
    missingMandatoryEvidence: 2,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-grace-powell",
    displayName: "Grace Powell",
    initials: "GP",
    employerId: "emp-donvalley",
    employerName: "Don Valley Bodyworks",
    programmeId: "prog-panel",
    programmeName: "Panel Technician L3",
    tutorName: "Sarah Patel",
    programmeYear: 1,
    programmeWeek: 20,
    plannedProgressPercent: 38,
    actualProgressPercent: 37,
    attendancePercent: 95,
    lastReviewDate: "2026-06-25",
    nextReviewDate: "2026-07-28",
    openActionCount: 1,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "none",
    riskStatus: "on_track",
    lastContactDate: "2026-07-14",
    missingMandatoryEvidence: 0,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-harry-kent",
    displayName: "Harry Kent",
    initials: "HK",
    employerId: "emp-northline",
    employerName: "Northline Services Ltd",
    programmeId: "prog-electrical",
    programmeName: "Electrical Install L3",
    tutorName: "Daniel Turner",
    programmeYear: 1,
    programmeWeek: 9,
    plannedProgressPercent: 17,
    actualProgressPercent: 12,
    attendancePercent: 82,
    lastReviewDate: "2026-06-08",
    nextReviewDate: "2026-07-23",
    openActionCount: 2,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "none",
    riskStatus: "slightly_behind",
    lastContactDate: "2026-07-10",
    missingMandatoryEvidence: 1,
    epaApproaching: false,
    programmeOverdue: false,
    status: "active",
  },
  {
    apprenticeId: "lrn-ivy-marshall",
    displayName: "Ivy Marshall",
    initials: "IM",
    employerId: "emp-hexthorpe",
    employerName: "Hexthorpe Motors",
    programmeId: "prog-motor",
    programmeName: "Motor Vehicle L3",
    tutorName: "Sarah Patel",
    programmeYear: 3,
    programmeWeek: 150,
    plannedProgressPercent: 100,
    actualProgressPercent: 96,
    attendancePercent: 92,
    lastReviewDate: "2026-07-02",
    nextReviewDate: "2026-07-20",
    openActionCount: 1,
    interventionId: null,
    interventionType: null,
    employerConcernStatus: "none",
    riskStatus: "on_track",
    lastContactDate: "2026-07-05",
    missingMandatoryEvidence: 0,
    epaApproaching: true,
    programmeOverdue: false,
    status: "active",
  },
];
