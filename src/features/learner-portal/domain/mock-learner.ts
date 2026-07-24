export type LearnerPortalProfile = {
  accountId: string;
  learnerId: string;
  displayName: string;
  initials: string;
  programmeName: string;
  programmeYear: 1 | 2 | 3;
  programmeWeek: number;
  employerName: string;
  employerContact: string;
  mentorName: string;
  mentorId: string;
  tutorName: string;
  tutorId: string;
  plannedProgressPercent: number;
  actualProgressPercent: number;
  attendancePercent: number;
  nextReviewDate: string;
  lastReviewDate: string | null;
  openActionCount: number;
  collegeDays: string;
};

/** Signed-in demo apprentice (Alex Morgan). */
export const ALEX_PROFILE: LearnerPortalProfile = {
  accountId: "alex-morgan",
  learnerId: "lrn-alex-morgan",
  displayName: "Alex Morgan",
  initials: "AM",
  programmeName: "Autocare Technician L2 · ST0499",
  programmeYear: 1,
  programmeWeek: 14,
  employerName: "Riverside Autocare",
  employerContact: "Priya Shah",
  mentorName: "Reiss Chambers",
  mentorId: "contact-mentor-reiss",
  tutorName: "Daniel Turner",
  tutorId: "contact-tutor-daniel",
  plannedProgressPercent: 28,
  actualProgressPercent: 24,
  attendancePercent: 94,
  nextReviewDate: "2026-08-08",
  lastReviewDate: "2026-05-30",
  openActionCount: 3,
  collegeDays: "Monday & Tuesday",
};

export type LearnerModuleRow = {
  id: string;
  code: string;
  title: string;
  year: 1 | 2 | 3;
  status: "completed" | "in_progress" | "remaining";
  /** Tutor has released this module for the learner to open. */
  released: boolean;
  releasedAt: string | null;
  releasedBy: string | null;
};

export type ModuleTopicStatus = "covered" | "in_progress" | "upcoming";

export type ModuleSignOffRole =
  | "Tutor"
  | "Learning & Progress Mentor"
  | "Employer mentor"
  | "Workplace supervisor";

export type ModuleTopic = {
  id: string;
  title: string;
  status: ModuleTopicStatus;
  coveredAt: string | null;
  note?: string;
  /** Who delivered / signed off this outcome for the learner. */
  signedOffBy: string | null;
  signedOffRole: ModuleSignOffRole | null;
  method?: string;
  evidenceSummary?: string;
};

export type LearnerModuleDetail = LearnerModuleRow & {
  summary: string;
  tutorFocus: string;
  /** Outcomes signed off in this module (current / recent). */
  covered: ModuleTopic[];
  /** Outcomes already done earlier in the module or carried from prior modules. */
  previouslyCovered: ModuleTopic[];
  /** Not yet taught or assessed. */
  upcoming: ModuleTopic[];
};

export type LearnerAssignment = {
  id: string;
  title: string;
  moduleCode: string;
  dueDate: string;
  status: "outstanding" | "submitted" | "returned";
  feedback?: string;
};

export type LearnerEvidenceItem = {
  id: string;
  title: string;
  type: string;
  uploadedAt: string;
  status: "awaiting_feedback" | "accepted" | "more_required";
  feedback?: string;
};

export type LearnerReviewSummary = {
  id: string;
  reviewDate: string;
  type: string;
  status: "upcoming" | "completed" | "awaiting_sign_off";
  judgement?: string;
  href?: string;
};

/** College-session outcomes that can appear on a learner attendance record. */
export type LearnerAttendanceStatus =
  | "attended"
  | "late"
  | "authorised"
  | "unauthorised"
  | "absent"
  | "college_closed";

export type LearnerAttendanceDay = {
  date: string;
  dayName: string;
  session: string;
  status: LearnerAttendanceStatus;
  /** Optional short note (e.g. reason for absence or closure). */
  note?: string;
  /** Module topics / tasks / workshop slots missed when the learner was away. */
  missedItems?: LearnerMissedLearningItem[];
};

export type LearnerMissedLearningKind = "module" | "task" | "workshop";

export type LearnerMissedLearningItem = {
  id: string;
  kind: LearnerMissedLearningKind;
  title: string;
  detail: string;
  moduleCode?: string;
  href: string;
  catchUpStatus: "needed" | "in_progress" | "done";
};

export type LearnerMissedLearningSlice = {
  kind: LearnerMissedLearningKind;
  label: string;
  count: number;
  color: string;
};

const MISSED_KIND_META: Record<
  LearnerMissedLearningKind,
  { label: string; color: string }
> = {
  module: {
    label: "Module topics",
    color: "var(--color-navy-600)",
  },
  task: {
    label: "CEA / assignments",
    color: "var(--color-amber-500)",
  },
  workshop: {
    label: "Workshop practicals",
    color: "var(--color-red-500)",
  },
};

export function collectMissedLearningItems(
  days: LearnerAttendanceDay[] = ALEX_ATTENDANCE_DAYS,
): LearnerMissedLearningItem[] {
  return days.flatMap((day) => day.missedItems ?? []);
}

export function summariseMissedLearning(
  days: LearnerAttendanceDay[] = ALEX_ATTENDANCE_DAYS,
): {
  items: LearnerMissedLearningItem[];
  slices: LearnerMissedLearningSlice[];
  total: number;
  stillNeeded: number;
} {
  const items = collectMissedLearningItems(days);
  const counts: Record<LearnerMissedLearningKind, number> = {
    module: 0,
    task: 0,
    workshop: 0,
  };
  for (const item of items) {
    counts[item.kind] += 1;
  }
  const slices: LearnerMissedLearningSlice[] = (
    Object.keys(MISSED_KIND_META) as LearnerMissedLearningKind[]
  )
    .map((kind) => ({
      kind,
      label: MISSED_KIND_META[kind].label,
      color: MISSED_KIND_META[kind].color,
      count: counts[kind],
    }))
    .filter((slice) => slice.count > 0);

  return {
    items,
    slices,
    total: items.length,
    stillNeeded: items.filter((item) => item.catchUpStatus !== "done").length,
  };
}

export type LearnerAttendanceBreakdownItem = {
  status: LearnerAttendanceStatus;
  label: string;
  count: number;
  /** CSS colour token used by the pie chart / legend. */
  color: string;
  /** Whether this status counts toward the attendance % denominator. */
  countsTowardPercent: boolean;
};

/**
 * Year-to-date session mix for Alex.
 * Attendance % = (attended + late) / sessions that count toward percent.
 * College-closed days are shown on the chart but excluded from the %.
 */
export const ALEX_ATTENDANCE_BREAKDOWN: LearnerAttendanceBreakdownItem[] = [
  {
    status: "attended",
    label: "Attended",
    count: 28,
    color: "var(--color-green-600)",
    countsTowardPercent: true,
  },
  {
    status: "late",
    label: "Late",
    count: 2,
    color: "var(--color-amber-500)",
    countsTowardPercent: true,
  },
  {
    status: "authorised",
    label: "Authorised absence",
    count: 1,
    color: "var(--color-navy-600)",
    countsTowardPercent: true,
  },
  {
    status: "unauthorised",
    label: "Unauthorised absence",
    count: 1,
    color: "var(--color-red-600)",
    countsTowardPercent: true,
  },
  {
    status: "absent",
    label: "Absent",
    count: 0,
    color: "var(--color-red-400)",
    countsTowardPercent: true,
  },
  {
    status: "college_closed",
    label: "College closed",
    count: 4,
    color: "var(--color-grey-600)",
    countsTowardPercent: false,
  },
];

export function summariseAlexAttendance(
  breakdown: LearnerAttendanceBreakdownItem[] = ALEX_ATTENDANCE_BREAKDOWN,
) {
  const expected = breakdown
    .filter((b) => b.countsTowardPercent)
    .reduce((sum, b) => sum + b.count, 0);
  const present = breakdown
    .filter((b) => b.status === "attended" || b.status === "late")
    .reduce((sum, b) => sum + b.count, 0);
  const catalogued = breakdown.reduce((sum, b) => sum + b.count, 0);
  const percent =
    expected === 0 ? 0 : Math.round((present / expected) * 100);
  return { expected, present, catalogued, percent };
}

export type LearningPlanItemKind =
  | "college"
  | "workplace"
  | "assignment"
  | "otj"
  | "evidence"
  | "review";

export type LearningPlanItem = {
  id: string;
  title: string;
  detail: string;
  kind: LearningPlanItemKind;
  /** Where to go to finish this item in the portal. */
  href: string;
  hrefLabel: string;
};

export type LearningFocus = {
  /** One-line purpose of the plan for this week. */
  purpose: string;
  /** Mentor/tutor narrative for the current focus period. */
  notes: string;
  /** Programme week this plan applies to. */
  weekLabel: string;
  /** Modules the learner should be working in right now. */
  activeModuleIds: string[];
  thisWeek: LearningPlanItem[];
  lookingAhead: LearningPlanItem[];
};

/** Full Motor Vehicle L3 catalogue — tutors release modules as the cohort reaches them. */
export const ALEX_MODULES: LearnerModuleRow[] = [
  {
    id: "m1",
    code: "MV-101",
    title: "Health & safety in the workshop",
    year: 1,
    status: "completed",
    released: true,
    releasedAt: "2026-03-08",
    releasedBy: "Daniel Turner",
  },
  {
    id: "m2",
    code: "MV-102",
    title: "Hand tools and workshop practice",
    year: 1,
    status: "completed",
    released: true,
    releasedAt: "2026-04-28",
    releasedBy: "Daniel Turner",
  },
  {
    id: "m3",
    code: "MV-103",
    title: "Vehicle systems overview",
    year: 1,
    status: "in_progress",
    released: true,
    releasedAt: "2026-06-12",
    releasedBy: "Daniel Turner",
  },
  {
    id: "m4",
    code: "MV-104",
    title: "Routine maintenance",
    year: 1,
    status: "in_progress",
    released: true,
    releasedAt: "2026-06-28",
    releasedBy: "Daniel Turner",
  },
  {
    id: "m5",
    code: "MV-105",
    title: "Customer communication",
    year: 1,
    status: "remaining",
    released: false,
    releasedAt: null,
    releasedBy: null,
  },
  {
    id: "m6",
    code: "MV-106",
    title: "Inspection and reporting",
    year: 1,
    status: "remaining",
    released: false,
    releasedAt: null,
    releasedBy: null,
  },
  {
    id: "m7",
    code: "MV-201",
    title: "Diagnostic routines and scanners",
    year: 2,
    status: "remaining",
    released: false,
    releasedAt: null,
    releasedBy: null,
  },
  {
    id: "m8",
    code: "MV-202",
    title: "Suspension and steering",
    year: 2,
    status: "remaining",
    released: false,
    releasedAt: null,
    releasedBy: null,
  },
  {
    id: "m9",
    code: "MV-203",
    title: "Transmission and driveline",
    year: 2,
    status: "remaining",
    released: false,
    releasedAt: null,
    releasedBy: null,
  },
  {
    id: "m10",
    code: "MV-204",
    title: "Advanced vehicle electrics",
    year: 2,
    status: "remaining",
    released: false,
    releasedAt: null,
    releasedBy: null,
  },
  {
    id: "m11",
    code: "MV-205",
    title: "Customer handover and job cards",
    year: 2,
    status: "remaining",
    released: false,
    releasedAt: null,
    releasedBy: null,
  },
  {
    id: "m12",
    code: "MV-301",
    title: "Advanced fault diagnosis",
    year: 3,
    status: "remaining",
    released: false,
    releasedAt: null,
    releasedBy: null,
  },
  {
    id: "m13",
    code: "MV-302",
    title: "Hybrid and EV awareness",
    year: 3,
    status: "remaining",
    released: false,
    releasedAt: null,
    releasedBy: null,
  },
  {
    id: "m14",
    code: "MV-303",
    title: "EPA readiness and end-point assessment",
    year: 3,
    status: "remaining",
    released: false,
    releasedAt: null,
    releasedBy: null,
  },
];

export function getAlexModulesByYear(): Array<{
  year: 1 | 2 | 3;
  label: string;
  modules: LearnerModuleRow[];
}> {
  const years: Array<1 | 2 | 3> = [1, 2, 3];
  return years.map((year) => ({
    year,
    label:
      year === ALEX_PROFILE.programmeYear
        ? `Year ${year} · current`
        : year < ALEX_PROFILE.programmeYear
          ? `Year ${year} · completed year`
          : `Year ${year} · later`,
    modules: ALEX_MODULES.filter((m) => m.year === year),
  }));
}

const MODULE_DETAILS: Record<string, Omit<LearnerModuleDetail, keyof LearnerModuleRow>> = {
  m1: {
    summary:
      "Workshop health and safety foundations — PPE, risk assessment, and safe working around vehicles.",
    tutorFocus: "Signed off after practical observation and reflective account.",
    covered: [
      {
        id: "m1-c1",
        title: "PPE selection for workshop tasks",
        status: "covered",
        coveredAt: "2026-04-18T10:30:00",
        signedOffBy: "Daniel Turner",
        signedOffRole: "Tutor",
        method: "Practical observation",
        evidenceSummary: "Observed correct PPE for grinding and under-vehicle work.",
      },
      {
        id: "m1-c2",
        title: "Reporting hazards and near misses",
        status: "covered",
        coveredAt: "2026-04-22T14:15:00",
        signedOffBy: "Daniel Turner",
        signedOffRole: "Tutor",
        method: "Reflective account + discussion",
        evidenceSummary: "Logged a near-miss example and explained reporting route.",
      },
    ],
    previouslyCovered: [
      {
        id: "m1-p1",
        title: "Induction walkthrough and fire exits",
        status: "covered",
        coveredAt: "2026-03-10T09:45:00",
        note: "Covered at programme induction",
        signedOffBy: "Reiss Chambers",
        signedOffRole: "Learning & Progress Mentor",
        method: "Induction checklist",
        evidenceSummary: "Walked exits, assembly point, and alarm procedure.",
      },
      {
        id: "m1-p2",
        title: "Manual handling basics",
        status: "covered",
        coveredAt: "2026-03-12T11:20:00",
        note: "Employer site induction",
        signedOffBy: "Priya Shah",
        signedOffRole: "Employer mentor",
        method: "Workplace induction",
        evidenceSummary: "Demonstrated safe lift of wheels and parts bins on site.",
      },
    ],
    upcoming: [],
  },
  m2: {
    summary: "Correct use, care, and identification of hand tools used in routine workshop jobs.",
    tutorFocus: "Tool ID quiz returned with feedback — module complete.",
    covered: [
      {
        id: "m2-c1",
        title: "Spanners, sockets and torque awareness",
        status: "covered",
        coveredAt: "2026-05-08T13:40:00",
        signedOffBy: "Daniel Turner",
        signedOffRole: "Tutor",
        method: "Workshop practical",
        evidenceSummary: "Selected correct tools and used torque wrench under supervision.",
      },
      {
        id: "m2-c2",
        title: "Measuring tools (vernier, feeler gauges)",
        status: "covered",
        coveredAt: "2026-05-15T15:05:00",
        signedOffBy: "Daniel Turner",
        signedOffRole: "Tutor",
        method: "Skills check",
        evidenceSummary: "Took three accurate readings within tolerance.",
      },
    ],
    previouslyCovered: [
      {
        id: "m2-p1",
        title: "Tool board layout and shadow boards",
        status: "covered",
        coveredAt: "2026-05-02T10:10:00",
        signedOffBy: "Daniel Turner",
        signedOffRole: "Tutor",
        method: "Workshop walkthrough",
        evidenceSummary: "Returned tools to correct shadow-board positions.",
      },
    ],
    upcoming: [],
  },
  m3: {
    summary: "How major vehicle systems interact — engine, braking, electrical overview.",
    tutorFocus: "Engine mechanical systems in progress; electrics still to cover.",
    covered: [
      {
        id: "m3-c1",
        title: "Engine mechanical layout (demo bay)",
        status: "covered",
        coveredAt: "2026-06-20T11:55:00",
        signedOffBy: "Daniel Turner",
        signedOffRole: "Tutor",
        method: "Demo bay teaching + Q&A",
        evidenceSummary: "Identified major engine components on the cutaway.",
      },
      {
        id: "m3-c2",
        title: "Cooling and lubrication overview",
        status: "in_progress",
        coveredAt: null,
        note: "Part-complete — observation booked",
        signedOffBy: null,
        signedOffRole: null,
        method: "Observation booked with tutor",
        evidenceSummary: "Cooling circuit discussed; practical sign-off still outstanding.",
      },
    ],
    previouslyCovered: [
      {
        id: "m3-p1",
        title: "Safe isolation before system work",
        status: "covered",
        coveredAt: "2026-04-22T14:15:00",
        note: "Carried from MV-101",
        signedOffBy: "Daniel Turner",
        signedOffRole: "Tutor",
        method: "Practical observation",
        evidenceSummary: "Demonstrated isolation steps before opening systems.",
      },
    ],
    upcoming: [
      {
        id: "m3-u1",
        title: "Braking system overview",
        status: "upcoming",
        coveredAt: null,
        signedOffBy: null,
        signedOffRole: null,
        method: "Planned classroom + bay session",
      },
      {
        id: "m3-u2",
        title: "Basic vehicle electrics map",
        status: "upcoming",
        coveredAt: null,
        signedOffBy: null,
        signedOffRole: null,
        method: "Planned classroom session",
      },
    ],
  },
  m4: {
    summary: "Routine service tasks — inspection sheets, fluids, filters, and job cards.",
    tutorFocus: "Brake inspection worksheet submitted; awaiting tutor feedback.",
    covered: [
      {
        id: "m4-c1",
        title: "Service schedule reading",
        status: "covered",
        coveredAt: "2026-07-02T09:25:00",
        signedOffBy: "Daniel Turner",
        signedOffRole: "Tutor",
        method: "Worksheet check",
        evidenceSummary: "Correctly pulled intervals from manufacturer schedule.",
      },
      {
        id: "m4-c2",
        title: "Oil and filter change observation",
        status: "covered",
        coveredAt: "2026-07-10T16:30:00",
        signedOffBy: "Priya Shah",
        signedOffRole: "Employer mentor",
        method: "Workplace observation",
        evidenceSummary: "Completed oil/filter change with photos and mentor countersign.",
      },
    ],
    previouslyCovered: [
      {
        id: "m4-p1",
        title: "Hand tools for service tasks",
        status: "covered",
        coveredAt: "2026-05-15T15:05:00",
        note: "Carried from MV-102",
        signedOffBy: "Daniel Turner",
        signedOffRole: "Tutor",
        method: "Skills check",
        evidenceSummary: "Tool selection verified during measuring tools session.",
      },
    ],
    upcoming: [
      {
        id: "m4-u1",
        title: "Full routine service under supervision",
        status: "upcoming",
        coveredAt: null,
        signedOffBy: null,
        signedOffRole: null,
        method: "Planned workplace + college session",
      },
      {
        id: "m4-u2",
        title: "Job card completion and handover notes",
        status: "upcoming",
        coveredAt: null,
        signedOffBy: null,
        signedOffRole: null,
        method: "Planned paperwork workshop",
      },
    ],
  },
  m5: {
    summary: "Speaking with customers, explaining work, and professional workshop communication.",
    tutorFocus: "Not started — scheduled after systems overview.",
    covered: [],
    previouslyCovered: [
      {
        id: "m5-p1",
        title: "Workshop conduct and professionalism",
        status: "covered",
        coveredAt: "2026-03-10T09:45:00",
        note: "From induction",
        signedOffBy: "Reiss Chambers",
        signedOffRole: "Learning & Progress Mentor",
        method: "Induction discussion",
        evidenceSummary: "Expectations for conduct agreed at start of programme.",
      },
    ],
    upcoming: [
      {
        id: "m5-u1",
        title: "Greeting and confirming customer needs",
        status: "upcoming",
        coveredAt: null,
        signedOffBy: null,
        signedOffRole: null,
        method: "Planned role-play",
      },
      {
        id: "m5-u2",
        title: "Explaining findings in plain language",
        status: "upcoming",
        coveredAt: null,
        signedOffBy: null,
        signedOffRole: null,
        method: "Planned role-play",
      },
      {
        id: "m5-u3",
        title: "Handover conversation practice",
        status: "upcoming",
        coveredAt: null,
        signedOffBy: null,
        signedOffRole: null,
        method: "Planned workplace practice",
      },
    ],
  },
  m6: {
    summary: "Inspection routines, defect reporting, and written workshop reports.",
    tutorFocus: "Locked until routine maintenance is further along.",
    covered: [],
    previouslyCovered: [],
    upcoming: [
      {
        id: "m6-u1",
        title: "Pre-inspection walkaround",
        status: "upcoming",
        coveredAt: null,
        signedOffBy: null,
        signedOffRole: null,
        method: "Planned bay session",
      },
      {
        id: "m6-u2",
        title: "Recording defects clearly",
        status: "upcoming",
        coveredAt: null,
        signedOffBy: null,
        signedOffRole: null,
        method: "Planned paperwork workshop",
      },
      {
        id: "m6-u3",
        title: "Writing a short inspection report",
        status: "upcoming",
        coveredAt: null,
        signedOffBy: null,
        signedOffRole: null,
        method: "Planned written task",
      },
    ],
  },
};

export function getAlexModuleDetail(moduleId: string): LearnerModuleDetail | null {
  const row = ALEX_MODULES.find((m) => m.id === moduleId);
  const detail = MODULE_DETAILS[moduleId];
  if (!row || !detail) return null;
  return { ...row, ...detail };
}

export function getAlexModuleTopic(
  moduleId: string,
  topicId: string,
): { module: LearnerModuleDetail; topic: ModuleTopic; section: "covered" | "previouslyCovered" | "upcoming" } | null {
  const module = getAlexModuleDetail(moduleId);
  if (!module) return null;

  const covered = module.covered.find((t) => t.id === topicId);
  if (covered) return { module, topic: covered, section: "covered" };

  const previouslyCovered = module.previouslyCovered.find((t) => t.id === topicId);
  if (previouslyCovered) {
    return { module, topic: previouslyCovered, section: "previouslyCovered" };
  }

  const upcoming = module.upcoming.find((t) => t.id === topicId);
  if (upcoming) return { module, topic: upcoming, section: "upcoming" };

  return null;
}

export function formatModuleDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T09:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export type TutorSignOffQueueStatus =
  | "needs_doing"
  | "awaiting_sign_off"
  | "signed_off";

export type TutorSignOffItem = {
  id: string;
  learnerId: string;
  learnerName: string;
  programmeName: string;
  moduleId: string;
  moduleCode: string;
  moduleTitle: string;
  topicId: string;
  topicTitle: string;
  section: "covered" | "previouslyCovered" | "upcoming";
  queueStatus: TutorSignOffQueueStatus;
  signedOffBy: string | null;
  signedOffRole: ModuleSignOffRole | null;
  coveredAt: string | null;
  note: string | null;
  method: string | null;
  evidenceSummary: string | null;
};

/**
 * Flatten learner module outcomes into a tutor sign-off queue.
 * Demo uses Alex Morgan; later this becomes caseload-wide.
 */
export function getTutorSignOffQueue(): TutorSignOffItem[] {
  const items: TutorSignOffItem[] = [];

  for (const row of ALEX_MODULES) {
    const detail = getAlexModuleDetail(row.id);
    if (!detail) continue;

    const push = (
      topic: ModuleTopic,
      section: TutorSignOffItem["section"],
    ) => {
      let queueStatus: TutorSignOffQueueStatus = "needs_doing";
      if (topic.status === "covered" && topic.signedOffBy) {
        queueStatus = "signed_off";
      } else if (topic.status === "in_progress" || (topic.status === "covered" && !topic.signedOffBy)) {
        queueStatus = "awaiting_sign_off";
      } else if (topic.status === "upcoming") {
        queueStatus = "needs_doing";
      }

      items.push({
        id: `${row.id}:${topic.id}`,
        learnerId: ALEX_PROFILE.learnerId,
        learnerName: ALEX_PROFILE.displayName,
        programmeName: ALEX_PROFILE.programmeName,
        moduleId: row.id,
        moduleCode: row.code,
        moduleTitle: row.title,
        topicId: topic.id,
        topicTitle: topic.title,
        section,
        queueStatus,
        signedOffBy: topic.signedOffBy,
        signedOffRole: topic.signedOffRole,
        coveredAt: topic.coveredAt,
        note: topic.note ?? null,
        method: topic.method ?? null,
        evidenceSummary: topic.evidenceSummary ?? null,
      });
    };

    for (const t of detail.covered) push(t, "covered");
    for (const t of detail.previouslyCovered) push(t, "previouslyCovered");
    for (const t of detail.upcoming) push(t, "upcoming");
  }

  return items;
}

export const ALEX_ASSIGNMENTS: LearnerAssignment[] = [
  {
    id: "asg-1",
    title: "Reflective account — safe working",
    moduleCode: "MV-101",
    dueDate: "2026-07-25",
    status: "outstanding",
  },
  {
    id: "asg-2",
    title: "Brake inspection worksheet",
    moduleCode: "MV-104",
    dueDate: "2026-07-20",
    status: "submitted",
  },
  {
    id: "asg-3",
    title: "Tool identification quiz",
    moduleCode: "MV-102",
    dueDate: "2026-06-28",
    status: "returned",
    feedback: "Strong — add one workplace example next time.",
  },
];

export const ALEX_EVIDENCE: LearnerEvidenceItem[] = [
  {
    id: "ev-1",
    title: "Observation — oil filter change",
    type: "Workplace observation",
    uploadedAt: "2026-07-10",
    status: "accepted",
    feedback: "Clear photos and mentor sign-off. Accepted.",
  },
  {
    id: "ev-2",
    title: "Reflective log — week 12",
    type: "Reflective account",
    uploadedAt: "2026-07-14",
    status: "awaiting_feedback",
  },
];

export type OtjPartyStatus = "not_ready" | "pending" | "agreed" | "returned";

/**
 * Approval order is fixed:
 * 1. Learner submits
 * 2. Employer agrees the entry is true
 * 3. Tutor / teacher confirms last (cannot act before employer)
 */
export type OtjApprovalStep = "learner" | "employer" | "tutor" | "complete";

export function otjCurrentStep(entry: LearnerOtjEntry): OtjApprovalStep {
  if (entry.employerStatus === "returned" || entry.tutorStatus === "returned") {
    return "learner";
  }
  if (entry.employerStatus !== "agreed") return "employer";
  if (entry.tutorStatus !== "agreed") return "tutor";
  return "complete";
}

export function canEmployerActOnOtj(entry: LearnerOtjEntry): boolean {
  return entry.employerStatus === "pending";
}

export function canTutorActOnOtj(entry: LearnerOtjEntry): boolean {
  return entry.employerStatus === "agreed" && entry.tutorStatus === "pending";
}

/** After employer agrees, unlock tutor for final confirmation. */
export function unlockTutorAfterEmployerAgree(
  entry: LearnerOtjEntry,
  employerName: string,
): LearnerOtjEntry {
  return {
    ...entry,
    employerStatus: "agreed",
    employerName,
    employerDecidedAt: new Date().toISOString(),
    employerNote: entry.employerNote,
    tutorStatus: "pending",
  };
}

export function returnOtjByEmployer(
  entry: LearnerOtjEntry,
  employerName: string,
  note: string,
): LearnerOtjEntry {
  return {
    ...entry,
    employerStatus: "returned",
    employerName,
    employerDecidedAt: new Date().toISOString(),
    employerNote: note,
    tutorStatus: "not_ready",
    tutorName: null,
    tutorDecidedAt: null,
    tutorNote: null,
  };
}

/** Digital OTJ training-type codes (modernised from the paper Generic Log). */
export type OtjTrainingTypeCode =
  | "RP"
  | "SE"
  | "OL"
  | "MT"
  | "PS"
  | "PM"
  | "IV"
  | "CC"
  | "LS"
  | "OTHER";

export const OTJ_TRAINING_TYPES: Array<{
  code: OtjTrainingTypeCode;
  label: string;
  group: "theory" | "practical" | "support" | "other";
}> = [
  { code: "RP", label: "Role playing", group: "theory" },
  { code: "SE", label: "Simulation exercise", group: "theory" },
  { code: "OL", label: "Online learning", group: "theory" },
  { code: "MT", label: "Manufacturer / equipment training", group: "theory" },
  { code: "PS", label: "Practical — shadowing", group: "practical" },
  { code: "PM", label: "Practical — mentoring", group: "practical" },
  { code: "IV", label: "Industry visit", group: "practical" },
  { code: "CC", label: "Competition", group: "practical" },
  { code: "LS", label: "Learning support / writing assessments", group: "support" },
  { code: "OTHER", label: "Other (describe below)", group: "other" },
];

export function otjTrainingTypeLabel(code: OtjTrainingTypeCode): string {
  const match = OTJ_TRAINING_TYPES.find((t) => t.code === code);
  return match ? `${code} · ${match.label}` : code;
}

export type LearnerOtjEntry = {
  id: string;
  /** Sequential task number on the learner's OTJ log. */
  taskNumber: number;
  /** Short name of the training activity. */
  taskName: string;
  /** Start (or single) date the training was completed (ISO date or datetime). */
  activityDate: string;
  /**
   * Optional end date when this is a catch-up / period claim (one entry covering
   * many weeks). Null for normal single-day logs.
   */
  activityDateEnd: string | null;
  /** Duration in minutes (paper form used 30 / 60 / other; catch-ups may be large). */
  durationMinutes: number;
  trainingType: OtjTrainingTypeCode;
  trainingTypeOther: string | null;
  comments: string;
  submittedAt: string;
  /**
   * Learner marked this as a catch-up / backfill block (culturally common:
   * one entry for a long period rather than weekly lines).
   */
  isCatchUp: boolean;
  /** Learner confirmed the OTJ definition / paid-time statement. */
  learnerConfirmed: boolean;
  employerStatus: OtjPartyStatus;
  employerName: string | null;
  employerDecidedAt: string | null;
  employerNote: string | null;
  tutorStatus: OtjPartyStatus;
  tutorName: string | null;
  tutorDecidedAt: string | null;
  tutorNote: string | null;
};

/** Hours to 2 decimal places from minutes. */
export function otjHours(entry: Pick<LearnerOtjEntry, "durationMinutes">): number {
  return Math.round((entry.durationMinutes / 60) * 100) / 100;
}

export function formatOtjDuration(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Date-only label (no time) for activity periods. */
export function formatOtjDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Single day or "12 May – 10 Jul 2026" for catch-up periods. */
export function formatOtjActivityPeriod(
  entry: Pick<LearnerOtjEntry, "activityDate" | "activityDateEnd">,
): string {
  const start = formatOtjDateShort(entry.activityDate);
  if (!entry.activityDateEnd) return start;
  const end = formatOtjDateShort(entry.activityDateEnd);
  if (start === end) return start;
  return `${start} – ${end}`;
}

/** Jon's threshold: alert after 1 empty week or 1 empty month without a submission. */
export const OTJ_LOGGING_GAP_THRESHOLD = 1;

/** Duration at/above this (hours) is treated as a catch-up block even if unchecked. */
export const OTJ_CATCH_UP_HOURS_HINT = 8;

export function isOtjCatchUpEntry(
  entry: Pick<
    LearnerOtjEntry,
    "isCatchUp" | "durationMinutes" | "activityDate" | "activityDateEnd"
  >,
): boolean {
  if (entry.isCatchUp) return true;
  if (entry.durationMinutes >= OTJ_CATCH_UP_HOURS_HINT * 60) return true;
  if (entry.activityDateEnd) {
    const start = new Date(
      entry.activityDate.includes("T")
        ? entry.activityDate
        : `${entry.activityDate}T12:00:00`,
    );
    const end = new Date(
      entry.activityDateEnd.includes("T")
        ? entry.activityDateEnd
        : `${entry.activityDateEnd}T12:00:00`,
    );
    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      end.getTime() > start.getTime()
    ) {
      return true;
    }
  }
  return false;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

export type OtjLoggingHealth = {
  lastSubmittedAt: string | null;
  daysSinceLastSubmit: number | null;
  emptyWeeks: number;
  emptyMonths: number;
  /** True when empty weeks or months ≥ OTJ_LOGGING_GAP_THRESHOLD. */
  alert: boolean;
  alertKind: "none" | "never" | "week" | "month";
  /** Staff-facing summary. */
  message: string | null;
  /** Softer learner-facing nudge. */
  learnerNudge: string | null;
};

/**
 * Logging cadence health from `submittedAt` (when they logged), not activity dates.
 * Catch-up dumps are allowed; we only flag rolling past empty weeks/months.
 */
export function buildOtjLoggingHealth(
  entries: LearnerOtjEntry[],
  asOf: Date = new Date(),
): OtjLoggingHealth {
  const threshold = OTJ_LOGGING_GAP_THRESHOLD;
  if (entries.length === 0) {
    return {
      lastSubmittedAt: null,
      daysSinceLastSubmit: null,
      emptyWeeks: threshold,
      emptyMonths: threshold,
      alert: true,
      alertKind: "never",
      message: "No OTJ hours submitted yet.",
      learnerNudge: "Log your first OTJ entry when you can — catch-up blocks are fine.",
    };
  }

  const lastSubmittedAt = entries.reduce((latest, e) => {
    return new Date(e.submittedAt).getTime() > new Date(latest).getTime()
      ? e.submittedAt
      : latest;
  }, entries[0].submittedAt);

  const last = startOfLocalDay(new Date(lastSubmittedAt));
  const today = startOfLocalDay(asOf);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceLastSubmit = Math.max(
    0,
    Math.floor((today.getTime() - last.getTime()) / msPerDay),
  );
  const emptyWeeks = Math.floor(daysSinceLastSubmit / 7);
  const emptyMonths = Math.max(0, monthsBetween(last, today));

  const monthAlert = emptyMonths >= threshold;
  const weekAlert = emptyWeeks >= threshold;
  const alert = weekAlert || monthAlert;

  let alertKind: OtjLoggingHealth["alertKind"] = "none";
  let message: string | null = null;
  let learnerNudge: string | null = null;

  if (monthAlert) {
    alertKind = "month";
    message = `No OTJ submitted for ${emptyMonths} calendar ${emptyMonths === 1 ? "month" : "months"} (threshold ${threshold}). Catch-up blocks are allowed — review when they arrive.`;
    learnerNudge = `You have not logged OTJ for ${emptyMonths} ${emptyMonths === 1 ? "month" : "months"}. A single catch-up entry covering the period is OK — please submit when you can.`;
  } else if (weekAlert) {
    alertKind = "week";
    message = `No OTJ submitted for ${emptyWeeks} ${emptyWeeks === 1 ? "week" : "weeks"} (threshold ${threshold}). Catch-up blocks are allowed — review when they arrive.`;
    learnerNudge = `You have not logged OTJ for ${emptyWeeks} ${emptyWeeks === 1 ? "week" : "weeks"}. A catch-up block is fine if you need to backfill.`;
  }

  return {
    lastSubmittedAt,
    daysSinceLastSubmit,
    emptyWeeks,
    emptyMonths,
    alert,
    alertKind,
    message,
    learnerNudge,
  };
}

export const ALEX_OTJ_ENTRIES: LearnerOtjEntry[] = [
  {
    id: "otj-1",
    taskNumber: 1,
    taskName: "Brake pad replacement — job card practice",
    activityDate: "2026-07-15T09:00:00",
    activityDateEnd: null,
    durationMinutes: 150,
    trainingType: "PS",
    trainingTypeOther: null,
    comments:
      "Shadowed Priya on a full brake pad job and completed the job card notes afterwards.",
    submittedAt: "2026-07-15T16:40:00",
    isCatchUp: false,
    learnerConfirmed: true,
    employerStatus: "agreed",
    employerName: "Priya Shah",
    employerDecidedAt: "2026-07-16T08:20:00",
    employerNote: "Accurate — Alex supported the full job.",
    tutorStatus: "agreed",
    tutorName: "Daniel Turner",
    tutorDecidedAt: "2026-07-16T11:05:00",
    tutorNote: null,
  },
  {
    id: "otj-2",
    taskNumber: 2,
    taskName: "Diagnostic scanner mentoring",
    activityDate: "2026-07-10T13:00:00",
    activityDateEnd: null,
    durationMinutes: 90,
    trainingType: "PM",
    trainingTypeOther: null,
    comments:
      "Mentoring discussion on diagnostic scanners; logged findings in the workplace diary.",
    submittedAt: "2026-07-10T17:10:00",
    isCatchUp: false,
    learnerConfirmed: true,
    employerStatus: "agreed",
    employerName: "Priya Shah",
    employerDecidedAt: "2026-07-11T09:00:00",
    employerNote: null,
    tutorStatus: "pending",
    tutorName: null,
    tutorDecidedAt: null,
    tutorNote: null,
  },
  {
    id: "otj-3",
    taskNumber: 3,
    taskName: "Cooling systems e-learning module",
    activityDate: "2026-07-09T10:30:00",
    activityDateEnd: null,
    durationMinutes: 180,
    trainingType: "OL",
    trainingTypeOther: null,
    comments: "Manufacturer online module on cooling systems (self-study during paid OTJ time).",
    submittedAt: "2026-07-09T14:00:00",
    isCatchUp: false,
    learnerConfirmed: true,
    employerStatus: "pending",
    employerName: null,
    employerDecidedAt: null,
    employerNote: null,
    tutorStatus: "not_ready",
    tutorName: null,
    tutorDecidedAt: null,
    tutorNote: null,
  },
  {
    id: "otj-4",
    taskNumber: 4,
    taskName: "COSHH toolbox talk",
    activityDate: "2026-07-08T15:00:00",
    activityDateEnd: null,
    durationMinutes: 60,
    trainingType: "OTHER",
    trainingTypeOther: "Toolbox talk",
    comments: "Claimed as OTJ — employer returned as this was normal working duties.",
    submittedAt: "2026-07-08T16:20:00",
    isCatchUp: false,
    learnerConfirmed: true,
    employerStatus: "returned",
    employerName: "Priya Shah",
    employerDecidedAt: "2026-07-09T08:45:00",
    employerNote: "That was paid work time, not off-the-job — please reclassify or remove.",
    tutorStatus: "not_ready",
    tutorName: null,
    tutorDecidedAt: null,
    tutorNote: null,
  },
  {
    id: "otj-5",
    taskNumber: 5,
    taskName: "Catch-up OTJ block — May to early July",
    activityDate: "2026-05-12T09:00:00",
    activityDateEnd: "2026-07-10T17:00:00",
    durationMinutes: 167 * 60,
    trainingType: "OTHER",
    trainingTypeOther: "Mixed workplace OTJ",
    comments:
      "Single catch-up entry covering mentoring, shadowing, manufacturer modules and job-card practice from mid-May to early July (not logged week-by-week).",
    submittedAt: "2026-07-16T18:00:00",
    isCatchUp: true,
    learnerConfirmed: true,
    employerStatus: "pending",
    employerName: null,
    employerDecidedAt: null,
    employerNote: null,
    tutorStatus: "not_ready",
    tutorName: null,
    tutorDecidedAt: null,
    tutorNote: null,
  },
];

export function summariseOtjHours(entries: LearnerOtjEntry[]) {
  const fullyAgreed = entries.filter(
    (e) => e.employerStatus === "agreed" && e.tutorStatus === "agreed",
  );
  const awaitingEmployer = entries.filter((e) => e.employerStatus === "pending");
  const awaitingTutor = entries.filter(
    (e) => e.employerStatus === "agreed" && e.tutorStatus === "pending",
  );
  const returned = entries.filter(
    (e) => e.employerStatus === "returned" || e.tutorStatus === "returned",
  );
  const sumHours = (list: LearnerOtjEntry[]) =>
    Math.round(list.reduce((total, e) => total + otjHours(e), 0) * 100) / 100;

  return {
    totalHours: sumHours(entries),
    agreedHours: sumHours(fullyAgreed),
    awaitingEmployerHours: sumHours(awaitingEmployer),
    awaitingTutorHours: sumHours(awaitingTutor),
    returnedCount: returned.length,
    fullyAgreedCount: fullyAgreed.length,
    awaitingEmployerCount: awaitingEmployer.length,
    awaitingTutorCount: awaitingTutor.length,
  };
}

/** Programme minimum OTJ hours (from Generic Log guidance). */
export const OTJ_MINIMUM_HOURS = 40;

/**
 * Demo baseline from the previous fortnight — used for simple ↑/↓ trend stats.
 * In production this would come from prior period totals.
 */
export const OTJ_PREVIOUS_FORTNIGHT = {
  agreedHours: 2.25,
  awaitingEmployerHours: 3.35,
  awaitingTutorHours: 1.7,
  returnedCount: 2,
};

export type OtjTrendDirection = "up" | "down" | "flat";

export type OtjStatCard = {
  id: "agreed" | "employer" | "teacher" | "returned";
  label: string;
  value: string;
  hint: string;
  tone: "green" | "amber" | "blue" | "red";
  trendDirection: OtjTrendDirection;
  /** e.g. "↑ 11% vs last fortnight" or "On track" */
  trendLabel: string;
  /** Whether up is good for this metric (waiting/returned: down is good). */
  trendIsGood: boolean;
};

export type OtjHealthStatus = "ahead" | "on_track" | "behind" | "attention";

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function trendFromChange(
  change: number | null,
): { direction: OtjTrendDirection; label: string } {
  if (change === null) {
    return { direction: "up", label: "New this period" };
  }
  if (change === 0) {
    return { direction: "flat", label: "No change vs last fortnight" };
  }
  const arrow = change > 0 ? "↑" : "↓";
  return {
    direction: change > 0 ? "up" : "down",
    label: `${arrow} ${Math.abs(change)}% vs last fortnight`,
  };
}

/**
 * Expected agreed hours by current programme week toward the 40h minimum
 * (linear plan across a typical 52-week year-1 window for demo purposes).
 */
export function expectedOtjHoursByWeek(programmeWeek: number): number {
  const plannedWeeks = 52;
  const expected =
    (Math.min(Math.max(programmeWeek, 0), plannedWeeks) / plannedWeeks) *
    OTJ_MINIMUM_HOURS;
  return Math.round(expected * 10) / 10;
}

export function buildOtjDashboardStats(
  entries: LearnerOtjEntry[],
  programmeWeek: number = ALEX_PROFILE.programmeWeek,
) {
  const summary = summariseOtjHours(entries);
  const previous = OTJ_PREVIOUS_FORTNIGHT;
  const expected = expectedOtjHoursByWeek(programmeWeek);
  const progressPercent = Math.min(
    100,
    Math.round((summary.agreedHours / OTJ_MINIMUM_HOURS) * 100),
  );

  let health: OtjHealthStatus = "on_track";
  if (summary.returnedCount > 0) health = "attention";
  else if (summary.agreedHours >= expected + 1) health = "ahead";
  else if (summary.agreedHours + 1 < expected) health = "behind";

  const healthLabel =
    health === "ahead"
      ? `Ahead of plan (+${Math.round((summary.agreedHours - expected) * 10) / 10}h)`
      : health === "behind"
        ? `Behind plan (−${Math.round((expected - summary.agreedHours) * 10) / 10}h)`
        : health === "attention"
          ? "Needs attention — returned entries"
          : "On track vs programme plan";

  const agreedChange = percentChange(summary.agreedHours, previous.agreedHours);
  const employerChange = percentChange(
    summary.awaitingEmployerHours,
    previous.awaitingEmployerHours,
  );
  const teacherChange = percentChange(
    summary.awaitingTutorHours,
    previous.awaitingTutorHours,
  );
  const returnedChange = percentChange(
    summary.returnedCount,
    previous.returnedCount,
  );

  const agreedTrend = trendFromChange(agreedChange);
  const employerTrend = trendFromChange(employerChange);
  const teacherTrend = trendFromChange(teacherChange);
  const returnedTrend = trendFromChange(returnedChange);

  const cards: OtjStatCard[] = [
    {
      id: "agreed",
      label: "Fully agreed",
      value: `${summary.agreedHours}h`,
      hint: `${summary.fullyAgreedCount} ${summary.fullyAgreedCount === 1 ? "entry" : "entries"} · employer + teacher`,
      tone: "green",
      trendDirection: agreedTrend.direction,
      trendLabel: agreedTrend.label,
      trendIsGood:
        agreedTrend.direction === "up" || agreedTrend.direction === "flat",
    },
    {
      id: "employer",
      label: "Awaiting employer",
      value: `${summary.awaitingEmployerHours}h`,
      hint: `${summary.awaitingEmployerCount} with ${ALEX_PROFILE.employerContact}`,
      tone: "amber",
      trendDirection: employerTrend.direction,
      trendLabel: employerTrend.label,
      trendIsGood:
        employerTrend.direction === "down" || employerTrend.direction === "flat",
    },
    {
      id: "teacher",
      label: "Awaiting teacher",
      value: `${summary.awaitingTutorHours}h`,
      hint: `${summary.awaitingTutorCount} with ${ALEX_PROFILE.tutorName} (final)`,
      tone: "blue",
      trendDirection: teacherTrend.direction,
      trendLabel: teacherTrend.label,
      trendIsGood:
        teacherTrend.direction === "down" || teacherTrend.direction === "flat",
    },
    {
      id: "returned",
      label: "Returned",
      value: String(summary.returnedCount),
      hint:
        summary.returnedCount === 0 ? "None need your update" : "Needs your update",
      tone: "red",
      trendDirection: returnedTrend.direction,
      trendLabel: returnedTrend.label,
      trendIsGood:
        returnedTrend.direction === "down" ||
        (returnedTrend.direction === "flat" && summary.returnedCount === 0),
    },
  ];

  return {
    summary,
    cards,
    minimumHours: OTJ_MINIMUM_HOURS,
    expectedHours: expected,
    progressPercent,
    health,
    healthLabel,
  };
}

export function nextOtjTaskNumber(entries: LearnerOtjEntry[]): number {
  if (entries.length === 0) return 1;
  return Math.max(...entries.map((e) => e.taskNumber)) + 1;
}

export function otjPipelineLabel(entry: LearnerOtjEntry): string {
  if (entry.employerStatus === "returned" || entry.tutorStatus === "returned") {
    return "Returned — needs update";
  }
  if (entry.employerStatus === "pending") return "1/3 Awaiting employer";
  if (entry.tutorStatus === "not_ready") return "1/3 Awaiting employer";
  if (entry.tutorStatus === "pending") return "2/3 Awaiting teacher";
  return "3/3 Fully agreed";
}

export const ALEX_REVIEWS: LearnerReviewSummary[] = [
  {
    id: "rev-alex-upcoming",
    reviewDate: "2026-08-08",
    type: "Progress review",
    status: "upcoming",
    href: "/learner/learning",
  },
  {
    id: "rev-alex-last",
    reviewDate: "2026-05-30",
    type: "Progress review",
    status: "completed",
    judgement: "On track with support",
  },
];

export const ALEX_ATTENDANCE_DAYS: LearnerAttendanceDay[] = [
  {
    date: "2026-07-14",
    dayName: "Tuesday",
    session: "Workshop AM",
    status: "attended",
  },
  {
    date: "2026-07-13",
    dayName: "Monday",
    session: "Theory AM",
    status: "attended",
  },
  {
    date: "2026-07-07",
    dayName: "Tuesday",
    session: "Workshop AM",
    status: "late",
    note: "Signed in at reception 20 minutes after start.",
  },
  {
    date: "2026-07-06",
    dayName: "Monday",
    session: "Theory AM",
    status: "attended",
  },
  {
    date: "2026-06-30",
    dayName: "Tuesday",
    session: "Workshop AM",
    status: "attended",
  },
  {
    date: "2026-06-29",
    dayName: "Monday",
    session: "Theory AM",
    status: "authorised",
    note: "Authorised workplace visit with employer mentor.",
    missedItems: [
      {
        id: "miss-1",
        kind: "module",
        title: "Cooling and lubrication overview",
        detail: "MV-103 theory session — catch up with Daniel’s demo notes.",
        moduleCode: "MV-103",
        href: "/learner/modules/m3",
        catchUpStatus: "in_progress",
      },
      {
        id: "miss-2",
        kind: "task",
        title: "Cooling circuit worksheet",
        detail: "Classroom worksheet issued that morning — still outstanding.",
        moduleCode: "MV-103",
        href: "/learner/assignments",
        catchUpStatus: "needed",
      },
    ],
  },
  {
    date: "2026-06-23",
    dayName: "Tuesday",
    session: "Workshop AM",
    status: "college_closed",
    note: "Staff development day — college closed to learners.",
  },
  {
    date: "2026-06-22",
    dayName: "Monday",
    session: "Theory AM",
    status: "unauthorised",
    note: "No contact received — employer notified.",
    missedItems: [
      {
        id: "miss-3",
        kind: "module",
        title: "Braking system overview — intro",
        detail: "First taught session for MV-103 braking outcomes.",
        moduleCode: "MV-103",
        href: "/learner/modules/m3",
        catchUpStatus: "needed",
      },
      {
        id: "miss-4",
        kind: "workshop",
        title: "Brake inspection bay walkthrough",
        detail: "Practical demo on the training bay — book a catch-up slot.",
        moduleCode: "MV-104",
        href: "/learner/modules/m4",
        catchUpStatus: "needed",
      },
      {
        id: "miss-5",
        kind: "task",
        title: "Brake inspection worksheet start",
        detail: "Peers started the assessed worksheet in class.",
        moduleCode: "MV-104",
        href: "/learner/assignments",
        catchUpStatus: "needed",
      },
    ],
  },
  {
    date: "2026-06-16",
    dayName: "Tuesday",
    session: "Workshop AM",
    status: "attended",
  },
  {
    date: "2026-06-15",
    dayName: "Monday",
    session: "Theory AM",
    status: "attended",
  },
  {
    date: "2026-05-26",
    dayName: "Tuesday",
    session: "Workshop AM",
    status: "college_closed",
    note: "Spring bank holiday — college closed.",
  },
  {
    date: "2026-05-25",
    dayName: "Monday",
    session: "Theory AM",
    status: "college_closed",
    note: "Spring bank holiday — college closed.",
  },
];

export const ALEX_LEARNING: LearningFocus = {
  purpose:
    "Your current learning plan — what to prioritise this week at college, at work, and for evidence.",
  weekLabel: `Week ${ALEX_PROFILE.programmeWeek}`,
  notes:
    "Catch-up OTJ is with Priya for agreement. Keep CEA Group 3 tyre evidence moving before the August progress review.",
  activeModuleIds: ["m3", "m4"],
  thisWeek: [
    {
      id: "lp-1",
      title: "Chase catch-up OTJ agreement with Priya",
      detail: "167h catch-up block is with the employer — follow up if needed before review.",
      kind: "otj",
      href: "/learner/evidence",
      hrefLabel: "Open OTJ hours",
    },
    {
      id: "lp-2",
      title: "Log this week’s OTJ (or a small catch-up)",
      detail: "Logging gap reminder is active — a single catch-up entry is fine if you need to backfill.",
      kind: "otj",
      href: "/learner/evidence",
      hrefLabel: "Log OTJ hours",
    },
    {
      id: "lp-3",
      title: "CEA Group 3 — tyre task ready for sign-off",
      detail: "Mark workplace tyre practice ready so employer/teacher can sign.",
      kind: "assignment",
      href: "/learner/assignments",
      hrefLabel: "Open CEA tasks",
    },
    {
      id: "lp-4",
      title: "College — inspection sheet marking",
      detail: "Bring your draft Tuesday; Daniel will mark the workshop assessment after lunch.",
      kind: "college",
      href: "/learner/modules/m4",
      hrefLabel: "Module coverage",
    },
  ],
  lookingAhead: [
    {
      id: "lp-5",
      title: "Finish Vehicle systems overview assessments",
      detail: "Close remaining MV-103 outcomes before the next review cycle.",
      kind: "college",
      href: "/learner/modules/m3",
      hrefLabel: "Open module",
    },
    {
      id: "lp-6",
      title: "Build evidence pack for August review",
      detail: `Progress review with ${ALEX_PROFILE.mentorName} on 8 Aug — gather accepted evidence and open actions.`,
      kind: "review",
      href: "/learner/reviews",
      hrefLabel: "View reviews",
    },
  ],
};

export function getAlexActiveLearningModules(): LearnerModuleDetail[] {
  return ALEX_LEARNING.activeModuleIds
    .map((id) => getAlexModuleDetail(id))
    .filter((m): m is LearnerModuleDetail => m != null);
}

export function learningKindLabel(kind: LearningPlanItemKind): string {
  switch (kind) {
    case "college":
      return "College";
    case "workplace":
      return "Workplace";
    case "assignment":
      return "CEA Task";
    case "otj":
      return "OTJ";
    case "evidence":
      return "Evidence";
    case "review":
      return "Review";
  }
}

export const ALEX_OPEN_TARGETS = [
  {
    id: "tgt-1",
    title: "Employer to agree catch-up OTJ block (167h)",
    owner: "Priya Shah (employer)",
    dueDate: "2026-07-25",
    status: "open",
    href: "/learner/evidence",
    hrefLabel: "Open OTJ hours",
  },
  {
    id: "tgt-2",
    title: "Submit OTJ this week — logging gap reminder",
    owner: "Alex Morgan",
    dueDate: "2026-07-25",
    status: "open",
    href: "/learner/evidence",
    hrefLabel: "Log OTJ hours",
  },
  {
    id: "tgt-3",
    title: "CEA — mark Group 3 tyre task ready for sign-off",
    owner: "Alex Morgan",
    dueDate: "2026-07-25",
    status: "open",
    href: "/learner/assignments",
    hrefLabel: "Open CEA tasks",
  },
];

export function getAlexProfile(): LearnerPortalProfile {
  return ALEX_PROFILE;
}
