/**
 * Programme module catalogues by year.
 * Formal reviews show modules up to the apprentice's current programme year only
 * (Year 2 shows Years 1–2; Year 3 modules stay hidden until Year 3).
 */

export type ProgrammeYear = 1 | 2 | 3;

export type ProgrammeModuleDefinition = {
  moduleId: string;
  code: string;
  title: string;
  year: ProgrammeYear;
  credits?: number;
};

export type ModuleProgressStatus = "completed" | "in_progress" | "remaining";

export type ReviewModuleRow = {
  moduleId: string;
  code: string;
  title: string;
  year: ProgrammeYear;
  status: ModuleProgressStatus;
  completedAt: string | null;
  evidenceNote: string | null;
};

const PLUMBING: ProgrammeModuleDefinition[] = [
  { moduleId: "pl-y1-ind", code: "PL-101", title: "Induction & safe working practices", year: 1 },
  { moduleId: "pl-y1-tools", code: "PL-102", title: "Hand tools and measuring", year: 1 },
  { moduleId: "pl-y1-copper", code: "PL-103", title: "Copper pipework and jointing", year: 1 },
  { moduleId: "pl-y1-plastic", code: "PL-104", title: "Plastic pipe systems", year: 1 },
  { moduleId: "pl-y1-sanitary", code: "PL-105", title: "Sanitary appliances & drainage basics", year: 1 },
  { moduleId: "pl-y1-hot", code: "PL-106", title: "Hot and cold water systems intro", year: 1 },
  { moduleId: "pl-y2-central", code: "PL-201", title: "Central heating systems", year: 2 },
  { moduleId: "pl-y2-unvented", code: "PL-202", title: "Unvented hot water systems", year: 2 },
  { moduleId: "pl-y2-fault", code: "PL-203", title: "Fault diagnosis on domestic systems", year: 2 },
  { moduleId: "pl-y2-regs", code: "PL-204", title: "Water regulations and compliance", year: 2 },
  { moduleId: "pl-y2-cust", code: "PL-205", title: "Customer care and workplace mentoring", year: 2 },
  { moduleId: "pl-y3-complex", code: "PL-301", title: "Complex multi-system installations", year: 3 },
  { moduleId: "pl-y3-comm", code: "PL-302", title: "Commercial plumbing practices", year: 3 },
  { moduleId: "pl-y3-epa", code: "PL-303", title: "EPA readiness and professional discussion", year: 3 },
];

const MOTOR: ProgrammeModuleDefinition[] = [
  { moduleId: "mv-y1-hs", code: "MV-101", title: "Health & safety in the workshop", year: 1 },
  { moduleId: "mv-y1-tools", code: "MV-102", title: "Tools, equipment and measuring", year: 1 },
  { moduleId: "mv-y1-engine", code: "MV-103", title: "Engine mechanical systems", year: 1 },
  { moduleId: "mv-y1-brake", code: "MV-104", title: "Braking systems fundamentals", year: 1 },
  { moduleId: "mv-y1-elect", code: "MV-105", title: "Vehicle electrical fundamentals", year: 1 },
  { moduleId: "mv-y1-service", code: "MV-106", title: "Routine vehicle servicing", year: 1 },
  { moduleId: "mv-y2-diag", code: "MV-201", title: "Diagnostic routines and scanners", year: 2 },
  { moduleId: "mv-y2-susp", code: "MV-202", title: "Suspension and steering", year: 2 },
  { moduleId: "mv-y2-trans", code: "MV-203", title: "Transmission and driveline", year: 2 },
  { moduleId: "mv-y2-adv-elec", code: "MV-204", title: "Advanced vehicle electrics", year: 2 },
  { moduleId: "mv-y2-cust", code: "MV-205", title: "Customer handover and job cards", year: 2 },
  { moduleId: "mv-y3-adv-diag", code: "MV-301", title: "Advanced fault diagnosis", year: 3 },
  { moduleId: "mv-y3-hybrid", code: "MV-302", title: "Hybrid and EV awareness", year: 3 },
  { moduleId: "mv-y3-epa", code: "MV-303", title: "EPA readiness and end-point assessment", year: 3 },
];

const PANEL: ProgrammeModuleDefinition[] = [
  { moduleId: "pt-y1-hs", code: "PT-101", title: "Workshop H&S and PPE", year: 1 },
  { moduleId: "pt-y1-tools", code: "PT-102", title: "Body repair tools and equipment", year: 1 },
  { moduleId: "pt-y1-metal", code: "PT-103", title: "Metal working and panel shaping", year: 1 },
  { moduleId: "pt-y1-prep", code: "PT-104", title: "Surface preparation and filling", year: 1 },
  { moduleId: "pt-y1-paint", code: "PT-105", title: "Paint application fundamentals", year: 1 },
  { moduleId: "pt-y1-plastic", code: "PT-106", title: "Plastic component repair", year: 1 },
  { moduleId: "pt-y2-align", code: "PT-201", title: "Panel alignment and fitting", year: 2 },
  { moduleId: "pt-y2-struct", code: "PT-202", title: "Structural repair principles", year: 2 },
  { moduleId: "pt-y2-colour", code: "PT-203", title: "Colour matching and blending", year: 2 },
  { moduleId: "pt-y2-est", code: "PT-204", title: "Estimating and job planning", year: 2 },
  { moduleId: "pt-y2-qa", code: "PT-205", title: "Quality checks and handover", year: 2 },
  { moduleId: "pt-y3-complex", code: "PT-301", title: "Complex multi-panel repairs", year: 3 },
  { moduleId: "pt-y3-adv", code: "PT-302", title: "Advanced refinishing techniques", year: 3 },
  { moduleId: "pt-y3-epa", code: "PT-303", title: "EPA readiness and showcase evidence", year: 3 },
];

const ADMIN: ProgrammeModuleDefinition[] = [
  { moduleId: "ba-y1-org", code: "BA-101", title: "Organising work and diaries", year: 1 },
  { moduleId: "ba-y1-comm", code: "BA-102", title: "Business communication", year: 1 },
  { moduleId: "ba-y1-docs", code: "BA-103", title: "Document production", year: 1 },
  { moduleId: "ba-y1-data", code: "BA-104", title: "Data handling and GDPR basics", year: 1 },
  { moduleId: "ba-y1-cust", code: "BA-105", title: "Customer service standards", year: 1 },
  { moduleId: "ba-y1-it", code: "BA-106", title: "IT systems for administrators", year: 1 },
  { moduleId: "ba-y2-proj", code: "BA-201", title: "Supporting projects and events", year: 2 },
  { moduleId: "ba-y2-fin", code: "BA-202", title: "Finance and expense processes", year: 2 },
  { moduleId: "ba-y2-hr", code: "BA-203", title: "HR administration support", year: 2 },
  { moduleId: "ba-y2-proc", code: "BA-204", title: "Process improvement", year: 2 },
  { moduleId: "ba-y2-stake", code: "BA-205", title: "Stakeholder management", year: 2 },
  { moduleId: "ba-y3-lead", code: "BA-301", title: "Leading small workstreams", year: 3 },
  { moduleId: "ba-y3-anal", code: "BA-302", title: "Business analysis basics", year: 3 },
  { moduleId: "ba-y3-epa", code: "BA-303", title: "EPA readiness and portfolio", year: 3 },
];

const ELECTRICAL: ProgrammeModuleDefinition[] = [
  { moduleId: "el-y1-hs", code: "EL-101", title: "Electrical safety and regulations intro", year: 1 },
  { moduleId: "el-y1-theory", code: "EL-102", title: "Electrical science fundamentals", year: 1 },
  { moduleId: "el-y1-install", code: "EL-103", title: "Installation practices", year: 1 },
  { moduleId: "el-y1-test", code: "EL-104", title: "Inspection and testing basics", year: 1 },
  { moduleId: "el-y1-cable", code: "EL-105", title: "Cable containment and termination", year: 1 },
  { moduleId: "el-y1-draw", code: "EL-106", title: "Reading drawings and schedules", year: 1 },
  { moduleId: "el-y2-18th", code: "EL-201", title: "18th Edition application", year: 2 },
  { moduleId: "el-y2-fault", code: "EL-202", title: "Fault finding on circuits", year: 2 },
  { moduleId: "el-y2-three", code: "EL-203", title: "Three-phase systems intro", year: 2 },
  { moduleId: "el-y2-docs", code: "EL-204", title: "Certification and documentation", year: 2 },
  { moduleId: "el-y2-cust", code: "EL-205", title: "Customer liaison on site", year: 2 },
  { moduleId: "el-y3-adv", code: "EL-301", title: "Advanced fault diagnosis", year: 3 },
  { moduleId: "el-y3-design", code: "EL-302", title: "Design and verification support", year: 3 },
  { moduleId: "el-y3-epa", code: "EL-303", title: "EPA readiness and professional discussion", year: 3 },
];

const ART: ProgrammeModuleDefinition[] = [
  { moduleId: "ar-y1-hs", code: "AR-101", title: "Workshop safety and vehicle recovery intro", year: 1 },
  { moduleId: "ar-y1-assess", code: "AR-102", title: "Damage assessment basics", year: 1 },
  { moduleId: "ar-y1-strip", code: "AR-103", title: "Strip and refit procedures", year: 1 },
  { moduleId: "ar-y1-panel", code: "AR-104", title: "Panel repair fundamentals", year: 1 },
  { moduleId: "ar-y1-prep", code: "AR-105", title: "Preparation for refinishing", year: 1 },
  { moduleId: "ar-y1-systems", code: "AR-106", title: "Vehicle systems awareness", year: 1 },
  { moduleId: "ar-y2-struct", code: "AR-201", title: "Structural alignment principles", year: 2 },
  { moduleId: "ar-y2-adv", code: "AR-202", title: "Advanced panel techniques", year: 2 },
  { moduleId: "ar-y2-paint", code: "AR-203", title: "Refinishing and blending", year: 2 },
  { moduleId: "ar-y2-est", code: "AR-204", title: "Estimating and insurer liaison", year: 2 },
  { moduleId: "ar-y2-qa", code: "AR-205", title: "Quality assurance and handover", year: 2 },
  { moduleId: "ar-y3-complex", code: "AR-301", title: "Complex multi-system repairs", year: 3 },
  { moduleId: "ar-y3-adas", code: "AR-302", title: "ADAS and modern vehicle systems", year: 3 },
  { moduleId: "ar-y3-epa", code: "AR-303", title: "EPA readiness and showcase", year: 3 },
];

export const PROGRAMME_MODULES: Record<string, ProgrammeModuleDefinition[]> = {
  "prog-plumbing": PLUMBING,
  "prog-motor": MOTOR,
  "prog-panel": PANEL,
  "prog-admin": ADMIN,
  "prog-electrical": ELECTRICAL,
  "prog-art": ART,
};

/**
 * Modules visible in a review: all modules for years 1..currentYear inclusive.
 * Year 3 content is not shown until the apprentice is in Year 3.
 */
export function modulesUpToYear(
  programmeId: string,
  currentYear: ProgrammeYear,
): ProgrammeModuleDefinition[] {
  const catalogue = PROGRAMME_MODULES[programmeId] ?? MOTOR;
  return catalogue.filter((m) => m.year <= currentYear);
}

/**
 * Derive completed / in-progress / remaining from actual progress against the
 * year-scoped module list. Progress is mapped evenly across visible modules.
 */
export function buildModuleProgressForApprentice(input: {
  programmeId: string;
  programmeYear: ProgrammeYear;
  actualProgressPercent: number;
  reviewDate: string;
}): {
  modules: ReviewModuleRow[];
  completedCount: number;
  remainingCount: number;
  inProgressCount: number;
  totalVisible: number;
  currentYearTotal: number;
  currentYearCompleted: number;
  currentYearRemaining: number;
} {
  const visible = modulesUpToYear(input.programmeId, input.programmeYear);
  const totalVisible = visible.length || 1;
  const completedSlots = Math.min(
    totalVisible,
    Math.floor((input.actualProgressPercent / 100) * totalVisible),
  );
  const hasInProgress =
    input.actualProgressPercent > 0 &&
    completedSlots < totalVisible &&
    input.actualProgressPercent % Math.round(100 / totalVisible) !== 0;

  const modules: ReviewModuleRow[] = visible.map((mod, index) => {
    let status: ModuleProgressStatus = "remaining";
    if (index < completedSlots) status = "completed";
    else if (index === completedSlots && (hasInProgress || completedSlots < totalVisible)) {
      // One active module when not fully complete
      if (index === completedSlots && input.actualProgressPercent > (completedSlots / totalVisible) * 100) {
        status = "in_progress";
      }
    }

    // Prefer a clearer rule: completed up to floor, next is in_progress if any remaining progress, rest remaining
    if (index < completedSlots) status = "completed";
    else if (index === completedSlots && completedSlots < totalVisible) status = "in_progress";
    else status = "remaining";

    // If 100% complete, all completed
    if (input.actualProgressPercent >= 99) status = "completed";

    return {
      moduleId: mod.moduleId,
      code: mod.code,
      title: mod.title,
      year: mod.year,
      status,
      completedAt:
        status === "completed"
          ? offsetDate(input.reviewDate, -(totalVisible - index) * 12)
          : null,
      evidenceNote:
        status === "completed"
          ? "Evidence checked in apprentice pack"
          : status === "in_progress"
            ? "In progress — tutor observation outstanding"
            : null,
    };
  });

  // Fix: if progress is 0, all remaining
  if (input.actualProgressPercent <= 0) {
    for (const m of modules) {
      m.status = "remaining";
      m.completedAt = null;
      m.evidenceNote = null;
    }
  }

  const completedCount = modules.filter((m) => m.status === "completed").length;
  const inProgressCount = modules.filter((m) => m.status === "in_progress").length;
  const remainingCount = modules.filter((m) => m.status === "remaining").length;
  const currentYearModules = modules.filter((m) => m.year === input.programmeYear);

  return {
    modules,
    completedCount,
    remainingCount,
    inProgressCount,
    totalVisible: modules.length,
    currentYearTotal: currentYearModules.length,
    currentYearCompleted: currentYearModules.filter((m) => m.status === "completed").length,
    currentYearRemaining: currentYearModules.filter((m) => m.status !== "completed").length,
  };
}

function offsetDate(isoDate: string, daysBack: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + daysBack);
  return d.toISOString().slice(0, 10);
}

export type AttendanceMonth = {
  month: string;
  percent: number;
  sessionsAttended: number;
  sessionsExpected: number;
  note: string | null;
};

export function buildAttendanceDetail(
  overallPercent: number | null,
  reviewDate = "2026-06-28",
): {
  overallPercent: number | null;
  trendLabel: string;
  lastTwelveWeeks: number[];
  months: AttendanceMonth[];
  collegeDays: Array<{
    date: string;
    dayName: string;
    status: "attended" | "absent" | "late" | "authorised";
    session: string;
    note: string | null;
  }>;
  daysAttended: number;
  daysExpected: number;
  daysAbsent: number;
  daysLate: number;
  concern: string | null;
} {
  if (overallPercent == null) {
    return {
      overallPercent: null,
      trendLabel: "No attendance data",
      lastTwelveWeeks: [],
      months: [],
      collegeDays: [],
      daysAttended: 0,
      daysExpected: 0,
      daysAbsent: 0,
      daysLate: 0,
      concern: "Attendance feed unavailable at review creation.",
    };
  }

  const trendLabel =
    overallPercent >= 95
      ? "Stable / strong"
      : overallPercent >= 90
        ? "Slightly falling"
        : overallPercent >= 80
          ? "Falling — monitoring"
          : "Priority attendance concern";

  const weeks = Array.from({ length: 12 }, (_, i) => {
    const drift = ((i % 4) - 1.5) * 2;
    return Math.max(40, Math.min(100, Math.round(overallPercent + drift)));
  });

  const months: AttendanceMonth[] = [
    {
      month: "Apr 2026",
      percent: Math.min(100, overallPercent + 3),
      sessionsAttended: 8,
      sessionsExpected: 8,
      note: null,
    },
    {
      month: "May 2026",
      percent: Math.min(100, overallPercent + 1),
      sessionsAttended: 7,
      sessionsExpected: 8,
      note: overallPercent < 90 ? "One late arrival recorded" : null,
    },
    {
      month: "Jun 2026",
      percent: overallPercent,
      sessionsAttended: overallPercent >= 90 ? 8 : 6,
      sessionsExpected: 8,
      note: overallPercent < 85 ? "Two absences — employer notified" : null,
    },
  ];

  const collegeDays = buildCollegeDays(overallPercent, reviewDate);
  const daysAttended = collegeDays.filter((d) => d.status === "attended" || d.status === "late").length;
  const daysAbsent = collegeDays.filter((d) => d.status === "absent").length;
  const daysLate = collegeDays.filter((d) => d.status === "late").length;

  return {
    overallPercent,
    trendLabel,
    lastTwelveWeeks: weeks,
    months,
    collegeDays,
    daysAttended,
    daysExpected: collegeDays.length,
    daysAbsent,
    daysLate,
    concern:
      overallPercent < 85
        ? "Attendance below expected threshold — recovery plan required."
        : overallPercent < 90
          ? "Attendance dipping; continue to monitor."
          : null,
  };
}

function buildCollegeDays(
  overallPercent: number,
  reviewDate: string,
): Array<{
  date: string;
  dayName: string;
  status: "attended" | "absent" | "late" | "authorised";
  session: string;
  note: string | null;
}> {
  const end = new Date(reviewDate);
  const days: Array<{
    date: string;
    dayName: string;
    status: "attended" | "absent" | "late" | "authorised";
    session: string;
    note: string | null;
  }> = [];
  // Last 12 college days before review (Mon/Tue workshop pattern demo)
  const cursor = new Date(end);
  let safety = 0;
  while (days.length < 12 && safety < 60) {
    safety += 1;
    cursor.setDate(cursor.getDate() - 1);
    const dow = cursor.getDay();
    if (dow !== 1 && dow !== 2) continue; // Mon/Tue college days
    const index = days.length;
    let status: "attended" | "absent" | "late" | "authorised" = "attended";
    let note: string | null = null;
    if (overallPercent < 98 && index === 3) {
      status = "late";
      note = "Arrived 20 minutes late — signed in at reception";
    }
    if (overallPercent < 92 && index === 7) {
      status = "absent";
      note = "Unauthorised absence — employer contacted";
    }
    if (overallPercent < 85 && index === 1) {
      status = "absent";
      note = "Sick — no certificate received";
    }
    if (overallPercent < 85 && index === 9) {
      status = "authorised";
      note = "Authorised workplace visit day";
    }
    days.push({
      date: cursor.toISOString().slice(0, 10),
      dayName: cursor.toLocaleDateString("en-GB", { weekday: "long" }),
      status,
      session: dow === 1 ? "Workshop day (Mon)" : "Theory / assessment (Tue)",
      note,
    });
  }
  return days.reverse();
}
