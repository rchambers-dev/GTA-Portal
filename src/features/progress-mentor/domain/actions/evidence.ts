export type OtjEntry = {
  weekStarting: string;
  activity: string;
  plannedHours: number;
  loggedHours: number;
  loggedBy: string;
  loggedAt: string;
  status: "logged" | "missing" | "partial";
};

export type EvidencePack = {
  packId: string;
  kind: "otj_tracker";
  title: string;
  learnerId: string;
  learnerName: string;
  actionId: string;
  plannedTotalHours: number;
  loggedTotalHours: number;
  shortfallHours: number;
  summary: string;
  entries: OtjEntry[];
};

const OTJ_PACKS: EvidencePack[] = [
  {
    packId: "otj-isla-mentoring",
    kind: "otj_tracker",
    title: "OTJ tracker — workplace mentoring",
    learnerId: "lrn-isla-bennett",
    learnerName: "Isla Bennett",
    actionId: "act-isla-employer-otj",
    plannedTotalHours: 4,
    loggedTotalHours: 4,
    shortfallHours: 0,
    summary:
      "Target was 2 × 30 minutes mentoring each week for four weeks (4 hours). Tracker shows 4.0 hours logged — no shortfall against the college plan for this action.",
    entries: [
      {
        weekStarting: "2026-06-30",
        activity: "Workplace mentoring — panel prep review",
        plannedHours: 1,
        loggedHours: 1,
        loggedBy: "Mark Holton",
        loggedAt: "2026-07-01",
        status: "logged",
      },
      {
        weekStarting: "2026-07-07",
        activity: "Workplace mentoring — filler technique",
        plannedHours: 1,
        loggedHours: 1,
        loggedBy: "Mark Holton",
        loggedAt: "2026-07-08",
        status: "logged",
      },
      {
        weekStarting: "2026-07-14",
        activity: "Workplace mentoring — finish standards",
        plannedHours: 1,
        loggedHours: 1,
        loggedBy: "Mark Holton",
        loggedAt: "2026-07-15",
        status: "logged",
      },
      {
        weekStarting: "2026-07-21",
        activity: "Workplace mentoring — quality checklist",
        plannedHours: 1,
        loggedHours: 1,
        loggedBy: "Mark Holton",
        loggedAt: "2026-07-16",
        status: "logged",
      },
    ],
  },
  {
    packId: "otj-oscar-weekly",
    kind: "otj_tracker",
    title: "OTJ tracker — weekly logging",
    learnerId: "lrn-oscar-hayes",
    learnerName: "Oscar Hayes",
    actionId: "act-oscar-otj",
    plannedTotalHours: 24,
    loggedTotalHours: 18,
    shortfallHours: 6,
    summary:
      "Four consecutive weeks should be logged on time. Two weeks are on time; two weeks are late or short — shortfall of 6 hours against planned OTJ for this window.",
    entries: [
      {
        weekStarting: "2026-06-30",
        activity: "College workshop + guided study",
        plannedHours: 6,
        loggedHours: 6,
        loggedBy: "Oscar Hayes",
        loggedAt: "2026-07-01",
        status: "logged",
      },
      {
        weekStarting: "2026-07-07",
        activity: "College workshop + guided study",
        plannedHours: 6,
        loggedHours: 6,
        loggedBy: "Oscar Hayes",
        loggedAt: "2026-07-08",
        status: "logged",
      },
      {
        weekStarting: "2026-07-14",
        activity: "College workshop",
        plannedHours: 6,
        loggedHours: 4,
        loggedBy: "Oscar Hayes",
        loggedAt: "2026-07-17",
        status: "partial",
      },
      {
        weekStarting: "2026-07-21",
        activity: "Not yet logged",
        plannedHours: 6,
        loggedHours: 2,
        loggedBy: "—",
        loggedAt: "—",
        status: "partial",
      },
    ],
  },
  {
    packId: "otj-harvey-mentoring",
    kind: "otj_tracker",
    title: "OTJ tracker — mentoring hours",
    learnerId: "lrn-harvey-cole",
    learnerName: "Harvey Cole",
    actionId: "act-riverside-commitment",
    plannedTotalHours: 4,
    loggedTotalHours: 0,
    shortfallHours: 4,
    summary:
      "Employer commitment to confirm mentoring hours. Tracker shows 0 of 4 planned hours for this window — this is the shortfall behind the overdue action.",
    entries: [
      {
        weekStarting: "2026-06-30",
        activity: "Mentoring slot not logged",
        plannedHours: 1,
        loggedHours: 0,
        loggedBy: "—",
        loggedAt: "—",
        status: "missing",
      },
      {
        weekStarting: "2026-07-07",
        activity: "Mentoring slot not logged",
        plannedHours: 1,
        loggedHours: 0,
        loggedBy: "—",
        loggedAt: "—",
        status: "missing",
      },
      {
        weekStarting: "2026-07-14",
        activity: "Mentoring slot not logged",
        plannedHours: 1,
        loggedHours: 0,
        loggedBy: "—",
        loggedAt: "—",
        status: "missing",
      },
      {
        weekStarting: "2026-07-21",
        activity: "Mentoring slot not logged",
        plannedHours: 1,
        loggedHours: 0,
        loggedBy: "—",
        loggedAt: "—",
        status: "missing",
      },
    ],
  },
];

export function getEvidencePackForAction(
  actionId: string,
): EvidencePack | undefined {
  return OTJ_PACKS.find((p) => p.actionId === actionId);
}

export function getEvidencePack(packId: string): EvidencePack | undefined {
  return OTJ_PACKS.find((p) => p.packId === packId);
}
