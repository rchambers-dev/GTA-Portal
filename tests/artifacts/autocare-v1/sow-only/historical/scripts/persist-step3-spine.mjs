import { readFileSync, writeFileSync } from "fs";

const ids = JSON.parse(readFileSync(".tmp-autocare-step2-ids.json", "utf8"));

const getUrl = new URL(
  "http://localhost:3000/api/management/programme-definition/spine",
);
getUrl.searchParams.set("programmeVersionId", ids.programmeVersionId);
getUrl.searchParams.set("standardCode", "ST0499");
const getRes = await fetch(getUrl);
const getJson = await getRes.json();
if (!getJson.ok || !getJson.programme) {
  console.error("GET failed", getJson);
  process.exit(1);
}
const programme = getJson.programme;

const SOURCE = {
  controlledSource: "Clean Master v4.1",
  citedIn:
    "GTA_SOW_Design_and_RPL_Adjustment_Guide_v1.4_Portal_Logic.docx",
  weekCalendar:
    "left empty per rebuild rules (weekStart/weekEnd not set)",
};

const training = [
  {
    n: 1,
    title: "Motor Vehicle Foundation Skills - Shared Controlled Programme",
    otj: 45,
    nonOtj: 15,
    plannedWeeks: 10,
    weekEvidence:
      "SOW Guide: Weeks 1-10 use central Foundation Skills SOW FS01-FS10",
  },
  {
    n: 2,
    title: "Vehicle Inspection, Servicing and Customer Interaction",
    otj: 55,
    nonOtj: 5,
    plannedWeeks: 10,
    weekEvidence: "Lesson plan index weeks 11-20",
  },
  {
    n: 3,
    title: "Workshop Processes, Tools and Environmental Awareness",
    otj: 55,
    nonOtj: 5,
    plannedWeeks: 10,
    weekEvidence: "Lesson plan index weeks 21-30",
  },
  {
    n: 4,
    title: "Emerging Technology and Driveline Systems",
    otj: 55,
    nonOtj: 5,
    plannedWeeks: 10,
    weekEvidence: "Lesson plan index weeks 31-40",
  },
  {
    n: 5,
    title: "Diagnostic Thinking and Complex Repair Activities",
    otj: 55,
    nonOtj: 5,
    plannedWeeks: 10,
    weekEvidence: "Lesson plan index weeks 41-50",
  },
  {
    n: 6,
    title: "Vehicle Systems Integration and Advanced Diagnostics",
    otj: 55,
    nonOtj: 5,
    plannedWeeks: 10,
    weekEvidence: "Lesson plan index weeks 51-60",
  },
  {
    n: 7,
    title: "Advanced Workshop Practice and Technical Communication",
    otj: 55,
    nonOtj: 5,
    plannedWeeks: 10,
    weekEvidence: "Lesson plan index weeks 61-70",
  },
  {
    n: 8,
    title: "Advanced Diagnostics and Workshop Organisation",
    otj: 55,
    nonOtj: 5,
    plannedWeeks: 10,
    weekEvidence: "Lesson plan index weeks 71-80",
  },
  {
    n: 9,
    title:
      "Emerging Technologies, Electric Vehicles and Hydrogen Awareness",
    otj: 77,
    nonOtj: 7,
    plannedWeeks: 14,
    weekEvidence: "Lesson plan index weeks 81-94",
  },
  {
    n: 10,
    title:
      "Final Consolidation, Corrective Learning and EPA Readiness Training",
    otj: 104.5,
    nonOtj: 9.5,
    plannedWeeks: 19,
    weekEvidence: "Lesson plan index weeks 95-113",
  },
];

const spineItems = [];
for (const b of training) {
  spineItems.push({
    id: crypto.randomUUID(),
    itemType: "block",
    gatewayType: null,
    title: b.title,
    sequence: b.n,
    plannedWeeks: b.plannedWeeks,
    plannedOtjHours: b.otj,
    countsTowardsLearningHours: true,
    metadata: {
      blockNumber: b.n,
      sourceEligibleOtjHours: b.otj,
      sourceNonOtjHours: b.nonOtj,
      sourcePlannedWeeks: b.plannedWeeks,
      sourceWeekEvidence: b.weekEvidence,
      source: SOURCE,
    },
  });
}
spineItems.push({
  id: crypto.randomUUID(),
  itemType: "gateway",
  gatewayType: "official",
  title: "Gateway Readiness and Confirmation",
  sequence: 11,
  plannedWeeks: null,
  plannedOtjHours: 0,
  countsTowardsLearningHours: false,
  metadata: {
    sourceEligibleOtjHours: 0,
    sourceNonOtjHours: "Not quantified",
    source: SOURCE,
    note: "Zero eligible OTJ per Clean Master v4.1",
  },
});
spineItems.push({
  id: crypto.randomUUID(),
  itemType: "epa",
  gatewayType: null,
  title: "End-Point Assessment",
  sequence: 12,
  plannedWeeks: 0,
  plannedOtjHours: 0,
  countsTowardsLearningHours: false,
  metadata: {
    sourceEligibleOtjHours: 0,
    sourceNonOtjHours: "Not quantified",
    source: SOURCE,
    note: "Zero eligible OTJ per Clean Master v4.1",
  },
});

const otjTotal = spineItems.reduce(
  (s, i) => s + (Number(i.plannedOtjHours) || 0),
  0,
);
console.log("proposed OTJ total", otjTotal, "items", spineItems.length);

const putBody = {
  programmeId: programme.programmeId,
  programmeVersionId: programme.id,
  programmeTitle: programme.programmeTitle,
  standardCode: programme.standardCode,
  externalVersion: programme.externalVersion,
  standardVersionId: programme.standardVersionId,
  status: programme.status,
  internalVersion: programme.internalVersion,
  spineItems,
  ksbMappings: [],
  parameters: programme.parameters,
};

const putRes = await fetch(
  "http://localhost:3000/api/management/programme-definition/spine",
  {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(putBody),
  },
);
const putJson = await putRes.json();
console.log("PUT", putRes.status, putJson);
if (!putJson.ok) process.exit(1);

writeFileSync(
  ".tmp-autocare-step3-spine.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      programmeVersionId: programme.id,
      source: SOURCE,
      expectedOtjTotal: 611.5,
      items: spineItems.map((i) => ({
        id: i.id,
        sequence: i.sequence,
        itemType: i.itemType,
        title: i.title,
        plannedOtjHours: i.plannedOtjHours,
        plannedWeeks: i.plannedWeeks,
        blockNumber: i.metadata?.blockNumber ?? null,
      })),
    },
    null,
    2,
  ),
);
console.log("wrote .tmp-autocare-step3-spine.json");
