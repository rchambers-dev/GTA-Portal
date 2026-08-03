import type { CeaApprenticeState, CeaPackDef, CeaTaskDef } from "./types";
import { stripPackKsbs } from "./pack-builder";

function task(
  groupId: string,
  number: number,
  title: string,
  related?: CeaTaskDef["relatedTeaching"],
  alwaysMandatory?: boolean,
): CeaTaskDef {
  // Seed with structure only — never ship KSB / IMI refs (Jon maps later).
  void related;
  return {
    id: `${groupId}-t${number}`,
    groupId,
    number,
    title,
    alwaysMandatory,
  };
}

/**
 * Seeded from MV13.1 Autocare Apprentice Personal Tracking v1.8.
 * Official backbone: Autocare Technician ST0499 (Skills England / IMI EPA AS-AC-EPA).
 * KSBs intentionally omitted — staff map later in Course Builder.
 */
const AUTOCARE_CEA_PACK_RAW: CeaPackDef = {
  id: "cea-autocare-st0499",
  title: "Autocare Apprentice Personal Tracking",
  version: "1.3",
  standardCode: "ST0499",
  standardLabel: "Autocare Technician (Level 2) — ST0499",
  milestones: [
    {
      id: "ms-foundation",
      title: "Foundation",
      description: "Year 1 · 0–6 months — foundation skills and EV/hybrid awareness.",
      sortOrder: 1,
      phaseLabel: "0–6 months",
      monthStart: 0,
      monthEnd: 6,
      kind: "groups_phase",
    },
    {
      id: "ms-year1-systems",
      title: "Year 1 systems",
      description:
        "Year 1 · 7–12 months — tyres, brakes, steering, cooling, starting & charging.",
      sortOrder: 2,
      phaseLabel: "7–12 months",
      monthStart: 7,
      monthEnd: 12,
      kind: "groups_phase",
    },
    {
      id: "ms-gateway1",
      title: "Gateway 1",
      description: "Gateway assessments and e-logbook review before Year 2.",
      sortOrder: 3,
      phaseLabel: "Gateway 1",
      monthStart: 12,
      monthEnd: 12,
      kind: "gateway",
    },
    {
      id: "ms-year2-systems",
      title: "Year 2 systems",
      description:
        "Year 2 · 13–21 months — customer, stock, advanced systems, inspection.",
      sortOrder: 4,
      phaseLabel: "13–21 months",
      monthStart: 13,
      monthEnd: 21,
      kind: "groups_phase",
    },
    {
      id: "ms-gateway2",
      title: "Gateway 2",
      description: "Final gateway assessments and e-logbook review before EPA.",
      sortOrder: 5,
      phaseLabel: "Gateway 2",
      monthStart: 21,
      monthEnd: 21,
      kind: "gateway",
    },
    {
      id: "ms-epa",
      title: "EPA",
      description: "21–24 months — End-point assessment (IMI AS-AC-EPA).",
      sortOrder: 6,
      phaseLabel: "21–24 months",
      monthStart: 21,
      monthEnd: 24,
      kind: "epa",
    },
  ],
  groups: [
    {
      id: "g1",
      milestoneId: "ms-foundation",
      number: 1,
      title: "Foundation Skills",
      mandatoryRequired: 5,
      milestoneWeightPercent: 70,
      yearLabel: "Year 1",
      phaseLabel: "0–6 months",
      knowledgeTestNote: "Group knowledge tests 1–3",
      tasks: [
        task("g1", 1, "Health and safety practices in vehicle maintenance", {
          moduleId: "m1",
          label: "Health & safety in the workshop",
          imiRefs: ["ST0499:Duty6", "ST0499:B-health-safety"],
          needsStaffConfirm: true,
        }),
        task("g1", 2, "Using mechanical measuring equipment", {
          moduleId: "m2",
          label: "Hand tools and workshop practice",
          imiRefs: ["ST0499:Duty2"],
          needsStaffConfirm: true,
        }),
        task("g1", 3, "Using electrical measuring equipment", {
          moduleId: "m2",
          label: "Hand tools and workshop practice",
          imiRefs: ["ST0499:Duty2"],
          needsStaffConfirm: true,
        }),
        task("g1", 4, "Using tools and equipment", {
          moduleId: "m2",
          label: "Hand tools and workshop practice",
          imiRefs: ["ST0499:Duty2"],
          needsStaffConfirm: true,
        }),
        task("g1", 5, "Fabrication task", {
          moduleId: "m2",
          label: "Hand tools and workshop practice",
          imiRefs: ["ST0499:Duty2"],
          needsStaffConfirm: true,
        }),
      ],
    },
    {
      id: "g2",
      milestoneId: "ms-foundation",
      number: 2,
      title: "Electric and Hybrid Awareness",
      mandatoryRequired: 1,
      milestoneWeightPercent: 30,
      yearLabel: "Year 1",
      phaseLabel: "0–6 months",
      knowledgeTestNote: "Group knowledge test",
      tasks: [
        task("g2", 1, "Locating electric/hybrid vehicle components", {
          moduleId: "m3",
          label: "Vehicle systems overview",
          imiRefs: ["ST0499:Gateway:EV-isolation-prep"],
          needsStaffConfirm: true,
        }),
      ],
    },
    {
      id: "g3",
      milestoneId: "ms-year1-systems",
      number: 3,
      title: "Wheels and Tyres",
      mandatoryRequired: 2,
      milestoneWeightPercent: 20,
      yearLabel: "Year 1",
      phaseLabel: "7–12 months",
      knowledgeTestNote: "Group knowledge test",
      tasks: [
        task("g3", 1, "Remove and install tyres", {
          label: "Tyre replacement practice",
          imiRefs: ["ST0499:K9", "ST0499:S10", "ST0499:Duty4"],
          needsStaffConfirm: true,
        }),
        task("g3", 2, "Carry out puncture repair", {
          label: "Tyre repair",
          imiRefs: ["ST0499:K9", "ST0499:S10"],
          needsStaffConfirm: true,
        }),
        task("g3", 3, "Replace a TPMS valve", {
          label: "TPMS",
          imiRefs: ["ST0499:K9"],
          needsStaffConfirm: true,
        }),
        task("g3", 4, "Balance all four wheels", {
          label: "Wheel balancing",
          imiRefs: ["ST0499:S10", "ST0499:Duty4"],
          needsStaffConfirm: true,
        }),
        task("g3", 5, "Repair run-flat tyre", {
          label: "Run-flat repair",
          imiRefs: ["ST0499:K9", "ST0499:S10"],
          needsStaffConfirm: true,
        }),
      ],
    },
    {
      id: "g4",
      milestoneId: "ms-year1-systems",
      number: 4,
      title: "Basic Braking",
      mandatoryRequired: 2,
      milestoneWeightPercent: 20,
      yearLabel: "Year 1",
      phaseLabel: "7–12 months",
      knowledgeTestNote: "Group knowledge test",
      tasks: [
        task("g4", 1, "Remove and install front brake discs and pads", {
          moduleId: "m4",
          label: "Routine maintenance — brakes",
          imiRefs: ["ST0499:K12", "ST0499:Duty4"],
          needsStaffConfirm: true,
        }),
        task("g4", 2, "Remove and install rear brake shoes and drums", {
          moduleId: "m4",
          label: "Routine maintenance — brakes",
          imiRefs: ["ST0499:K12"],
          needsStaffConfirm: true,
        }),
        task("g4", 3, "Replace hydraulic brake fluid", {
          imiRefs: ["ST0499:K12"],
          label: "Brake hydraulics",
          needsStaffConfirm: true,
        }),
        task("g4", 4, "Remove and install rear brake discs and pads", {
          moduleId: "m4",
          label: "Routine maintenance — brakes",
          imiRefs: ["ST0499:K12"],
          needsStaffConfirm: true,
        }),
        task("g4", 5, "Check front brake disc run-out", {
          imiRefs: ["ST0499:K12"],
          label: "Brake inspection",
          needsStaffConfirm: true,
        }),
        task("g4", 6, "Check rear brake drum ovality", {
          imiRefs: ["ST0499:K12"],
          label: "Brake inspection",
          needsStaffConfirm: true,
        }),
      ],
    },
    {
      id: "g5",
      milestoneId: "ms-year1-systems",
      number: 5,
      title: "Basic Steering and Suspension",
      mandatoryRequired: 3,
      milestoneWeightPercent: 20,
      yearLabel: "Year 1",
      phaseLabel: "7–12 months",
      knowledgeTestNote: "Group knowledge test",
      tasks: [
        task("g5", 1, "Carry out two-wheel alignment", {
          imiRefs: ["ST0499:Duty4"],
          label: "Wheel alignment",
          needsStaffConfirm: true,
        }),
        task("g5", 2, "Remove and replace a steering track rod end", {
          imiRefs: ["ST0499:Duty4"],
          label: "Steering components",
          needsStaffConfirm: true,
        }),
        task("g5", 3, "Remove and replace a front lower ball joint", {
          imiRefs: ["ST0499:Duty4"],
          label: "Suspension components",
          needsStaffConfirm: true,
        }),
        task("g5", 4, "Remove and replace a front suspension strut", {
          imiRefs: ["ST0499:Duty4"],
          label: "Suspension components",
          needsStaffConfirm: true,
        }),
        task("g5", 5, "Remove and replace a rear suspension damper", {
          imiRefs: ["ST0499:Duty4"],
          label: "Suspension components",
          needsStaffConfirm: true,
        }),
        task("g5", 6, "Remove and install power steering pump", {
          imiRefs: ["ST0499:Duty4"],
          label: "Steering systems",
          needsStaffConfirm: true,
        }),
        task("g5", 7, "Remove and install steering rack gaitor", {
          imiRefs: ["ST0499:Duty4"],
          label: "Steering systems",
          needsStaffConfirm: true,
        }),
      ],
    },
    {
      id: "g6",
      milestoneId: "ms-year1-systems",
      number: 6,
      title: "Cooling, Lubrication, and Filters",
      mandatoryRequired: 2,
      milestoneWeightPercent: 20,
      yearLabel: "Year 1",
      phaseLabel: "7–12 months",
      knowledgeTestNote: "Group knowledge test",
      tasks: [
        task("g6", 1, "Remove and install radiator", {
          moduleId: "m3",
          topicId: undefined,
          label: "Cooling systems",
          imiRefs: ["ST0499:Duty2"],
          needsStaffConfirm: true,
        }),
        task("g6", 2, "Remove and install a water pump", {
          label: "Cooling systems",
          imiRefs: ["ST0499:Duty2"],
          needsStaffConfirm: true,
        }),
        task("g6", 3, "Remove and install a thermostat", {
          label: "Cooling systems",
          imiRefs: ["ST0499:Duty2"],
          needsStaffConfirm: true,
        }),
        task("g6", 4, "Replace a sump gasket", {
          label: "Lubrication",
          imiRefs: ["ST0499:Duty2"],
          needsStaffConfirm: true,
        }),
        task("g6", 5, "Remove and install oil pump", {
          label: "Lubrication",
          imiRefs: ["ST0499:Duty2"],
          needsStaffConfirm: true,
        }),
      ],
    },
    {
      id: "g7",
      milestoneId: "ms-year1-systems",
      number: 7,
      title: "Starting and Charging Systems",
      mandatoryRequired: 1,
      milestoneWeightPercent: 20,
      yearLabel: "Year 1",
      phaseLabel: "7–12 months",
      knowledgeTestNote: "Group knowledge test",
      tasks: [
        task("g7", 1, "Remove and install starter motor", {
          imiRefs: ["ST0499:Duty4"],
          label: "Starting system",
          needsStaffConfirm: true,
        }),
        task("g7", 2, "Remove and install alternator", {
          imiRefs: ["ST0499:Duty4"],
          label: "Charging system",
          needsStaffConfirm: true,
        }),
        task("g7", 3, "Replace vehicle battery", {
          imiRefs: ["ST0499:Duty4"],
          label: "Battery & charging",
          needsStaffConfirm: true,
        }),
      ],
    },
    {
      id: "g8",
      milestoneId: "ms-year2-systems",
      number: 8,
      title: "Customer Service and Sales",
      mandatoryRequired: 1,
      milestoneWeightPercent: 10,
      yearLabel: "Year 2",
      phaseLabel: "13–21 months",
      knowledgeTestNote: "Group knowledge test",
      tasks: [
        task("g8", 1, "Dealing with customer needs and relationships", {
          imiRefs: ["ST0499:Duty1"],
          label: "Customer communication",
          needsStaffConfirm: true,
        }),
      ],
    },
    {
      id: "g9",
      milestoneId: "ms-year2-systems",
      number: 9,
      title: "Stock Management",
      mandatoryRequired: 1,
      milestoneWeightPercent: 10,
      yearLabel: "Year 2",
      phaseLabel: "13–21 months",
      knowledgeTestNote: "Group knowledge test",
      tasks: [
        task("g9", 1, "Sourcing parts for servicing", {
          imiRefs: ["ST0499:Duty5"],
          label: "Parts sourcing",
          needsStaffConfirm: true,
        }),
      ],
    },
    {
      id: "g10",
      milestoneId: "ms-year2-systems",
      number: 10,
      title: "Advanced Braking",
      mandatoryRequired: 1,
      milestoneWeightPercent: 15,
      yearLabel: "Year 2",
      phaseLabel: "13–21 months",
      knowledgeTestNote: "Group knowledge test",
      tasks: [
        task("g10", 1, "Remove and install an ABS wheel speed sensor", {
          imiRefs: ["ST0499:K12"],
          label: "ABS systems",
          needsStaffConfirm: true,
        }),
        task("g10", 2, "Remove and install ABS reluctor wheel", {
          imiRefs: ["ST0499:K12"],
          label: "ABS systems",
          needsStaffConfirm: true,
        }),
        task("g10", 3, "Check output from ABS wheel speed sensor", {
          imiRefs: ["ST0499:K12"],
          label: "ABS diagnostics",
          needsStaffConfirm: true,
        }),
      ],
    },
    {
      id: "g11",
      milestoneId: "ms-year2-systems",
      number: 11,
      title: "Advance Steering and Suspension",
      mandatoryRequired: 2,
      milestoneWeightPercent: 15,
      yearLabel: "Year 2",
      phaseLabel: "13–21 months",
      knowledgeTestNote: "Group knowledge test",
      tasks: [
        task("g11", 1, "Traction control fault", {
          imiRefs: ["ST0499:Duty4"],
          label: "Advanced chassis systems",
          needsStaffConfirm: true,
        }),
        task("g11", 2, "Replace suspension ride height sensor", {
          imiRefs: ["ST0499:Duty4"],
          label: "Advanced suspension",
          needsStaffConfirm: true,
        }),
        task("g11", 3, "Diagnose fault with adaptive suspension", {
          imiRefs: ["ST0499:Duty4"],
          label: "Advanced suspension",
          needsStaffConfirm: true,
        }),
        task("g11", 4, "Diagnose excessive front tyre wear", {
          imiRefs: ["ST0499:K9", "ST0499:Duty4"],
          label: "Tyre wear diagnosis",
          needsStaffConfirm: true,
        }),
        task("g11", 5, "Carry out 4-wheel alignment and report", {
          imiRefs: ["ST0499:Duty4"],
          label: "Four-wheel alignment",
          needsStaffConfirm: true,
        }),
        task("g11", 6, "Diagnose ADAS fault", {
          imiRefs: ["ST0499:Duty4"],
          label: "ADAS",
          needsStaffConfirm: true,
        }),
      ],
    },
    {
      id: "g12",
      milestoneId: "ms-year2-systems",
      number: 12,
      title: "Exhaust and Emissions",
      mandatoryRequired: 2,
      milestoneWeightPercent: 15,
      yearLabel: "Year 2",
      phaseLabel: "13–21 months",
      knowledgeTestNote: "Group knowledge test",
      tasks: [
        task("g12", 1, "Remove and install complete exhaust system", {
          imiRefs: ["ST0499:Duty4"],
          label: "Exhaust systems",
          needsStaffConfirm: true,
        }),
        task("g12", 2, "Carry out an exhaust emissions test", {
          imiRefs: ["ST0499:Duty4"],
          label: "Emissions testing",
          needsStaffConfirm: true,
        }),
        task("g12", 3, "Diagnose exhaust emissions fault", {
          imiRefs: ["ST0499:Duty4"],
          label: "Emissions diagnosis",
          needsStaffConfirm: true,
        }),
        task("g12", 4, "Checking the operation of the oxygen sensor", {
          imiRefs: ["ST0499:Duty4"],
          label: "Emissions sensors",
          needsStaffConfirm: true,
        }),
        task("g12", 5, "Checking operation of the EGR valve", {
          imiRefs: ["ST0499:Duty4"],
          label: "EGR systems",
          needsStaffConfirm: true,
        }),
      ],
    },
    {
      id: "g13",
      milestoneId: "ms-year2-systems",
      number: 13,
      title: "Air Conditioning",
      mandatoryRequired: 1,
      milestoneWeightPercent: 10,
      yearLabel: "Year 2",
      phaseLabel: "13–21 months",
      knowledgeTestNote: "Group knowledge test",
      tasks: [
        task("g13", 1, "Remove and install air conditioning condenser", {
          imiRefs: ["ST0499:Duty4", "ST0499:Gateway:F-Gas"],
          label: "Air conditioning",
          needsStaffConfirm: true,
        }),
        task("g13", 2, "Remove and install air conditioning expansion valve", {
          imiRefs: ["ST0499:Duty4", "ST0499:Gateway:F-Gas"],
          label: "Air conditioning",
          needsStaffConfirm: true,
        }),
        task("g13", 3, "Remove and install air conditioning compressor", {
          imiRefs: ["ST0499:Duty4", "ST0499:Gateway:F-Gas"],
          label: "Air conditioning",
          needsStaffConfirm: true,
        }),
      ],
    },
    {
      id: "g14",
      milestoneId: "ms-year2-systems",
      number: 14,
      title: "Vehicle Inspection",
      mandatoryRequired: 2,
      milestoneWeightPercent: 15,
      yearLabel: "Year 2",
      phaseLabel: "13–21 months",
      knowledgeTestNote: "Group knowledge test · Task 5 is always mandatory",
      tasks: [
        task("g14", 1, "Prepare for an oil service", {
          moduleId: "m4",
          label: "Routine maintenance",
          imiRefs: ["ST0499:Duty2"],
          needsStaffConfirm: true,
        }),
        task("g14", 2, "Prepare for an interim service", {
          moduleId: "m4",
          label: "Routine maintenance",
          imiRefs: ["ST0499:Duty2"],
          needsStaffConfirm: true,
        }),
        task("g14", 3, "Prepare for a major service", {
          moduleId: "m4",
          label: "Routine maintenance",
          imiRefs: ["ST0499:Duty2"],
          needsStaffConfirm: true,
        }),
        task("g14", 4, "Prepare a 3-year service plan", {
          imiRefs: ["ST0499:Duty2"],
          label: "Service planning",
          needsStaffConfirm: true,
        }),
        task(
          "g14",
          5,
          "Safety inspection and quote",
          {
            imiRefs: ["ST0499:Duty2"],
            label: "Vehicle safety inspection",
            needsStaffConfirm: true,
          },
          true,
        ),
      ],
    },
  ],
  gatewayItems: [
    {
      id: "gw1-01",
      milestoneId: "ms-gateway1",
      code: "GW1AC01",
      title: "Remove and Replace Wheels and Tyres",
      status: "not_started",
    },
    {
      id: "gw1-02",
      milestoneId: "ms-gateway1",
      code: "GW1AC02",
      title: "Remove and Replace Battery Charging and Starting System Components",
      status: "not_started",
    },
    {
      id: "gw1-03",
      milestoneId: "ms-gateway1",
      code: "GW1AC03",
      title: "Carry Out Front Wheel Alignment",
      status: "not_started",
    },
    {
      id: "gw1-04",
      milestoneId: "ms-gateway1",
      code: "GW1AC04",
      title: "Remove and Replace Brake Discs and Pads",
      status: "not_started",
    },
    {
      id: "gw1-k",
      milestoneId: "ms-gateway1",
      code: "AP01GW1k",
      title: "Knowledge Assessment",
      status: "not_started",
    },
    {
      id: "gw1-log",
      milestoneId: "ms-gateway1",
      code: "E-Logbook",
      title: "E-Logbook Review",
      status: "not_started",
    },
    {
      id: "gw2-01",
      milestoneId: "ms-gateway2",
      code: "GW2AC01",
      title: "Carry Out a Vehicle Safety Inspection",
      status: "not_started",
    },
    {
      id: "gw2-02",
      milestoneId: "ms-gateway2",
      code: "GW2AC02",
      title: "Carry Out Four-Wheel Alignment",
      status: "not_started",
    },
    {
      id: "gw2-03",
      milestoneId: "ms-gateway2",
      code: "GW2AC03",
      title: "Emissions Related Fault",
      status: "not_started",
    },
    {
      id: "gw2-k",
      milestoneId: "ms-gateway2",
      code: "AP01GW2k",
      title: "Knowledge Assessment",
      status: "not_started",
    },
    {
      id: "gw2-log",
      milestoneId: "ms-gateway2",
      code: "E-Logbook",
      title: "E-Logbook Review (Final)",
      status: "not_started",
    },
  ],
  supportItems: [
    { id: "eq-div", section: "Equality and Diversity", title: "Equality and Diversity Online Training", status: "complete" },
    { id: "fs-eng", section: "Functional Skills", title: "English Level 1", status: "complete" },
    { id: "fs-maths", section: "Functional Skills", title: "Maths Level 1", status: "not_started" },
    { id: "bolt-first", section: "Bolt-on Courses", title: "Emergency First Aid at Work Course", status: "not_started" },
    { id: "bolt-hs", section: "Bolt-on Courses", title: "Health & Safety Level 2 Course", status: "complete" },
    { id: "bolt-mh", section: "Bolt-on Courses", title: "Manual Handling Course", status: "not_started" },
    { id: "bolt-fire", section: "Bolt-on Courses", title: "Fire Safety Course", status: "not_started" },
    { id: "ev-tyres", section: "Evidence Collection", title: "Professional Quality Job Card – Tyres", status: "not_started" },
    { id: "ev-brakes", section: "Evidence Collection", title: "Professional Quality Job Card – Brakes", status: "not_started" },
    { id: "ev-steer", section: "Evidence Collection", title: "Professional Quality Job Card – Steering/Suspension", status: "not_started" },
  ],
};

/** Current Autocare groups pack (ST0499 v1.3) — no KSB mappings. */
export const AUTOCARE_CEA_PACK: CeaPackDef = stripPackKsbs(AUTOCARE_CEA_PACK_RAW);

/** Blank personal-tracking state for a live apprentice on a groups pack. */
export function createBlankCeaState(
  apprenticeId: string,
  pack: CeaPackDef,
): CeaApprenticeState {
  const mandatoryByGroup: Record<string, string[]> = {};
  for (const group of pack.groups) {
    mandatoryByGroup[group.id] = group.tasks
      .filter((t) => t.alwaysMandatory)
      .map((t) => t.id);
  }
  return {
    apprenticeId,
    packId: pack.id,
    mandatoryByGroup,
    progress: {},
    milestoneReflections: {},
  };
}

/** Prefer resolveGroupsPack / getGroupsPackById from ./packs */
export function getCeaPack(packId: string = AUTOCARE_CEA_PACK.id) {
  // Lazy import avoided — keep thin compat wrapper.
  if (
    packId === AUTOCARE_CEA_PACK.id ||
    packId === "cea-autocare-st0499" ||
    packId === "cea-autocare-st0499-v1.3"
  ) {
    return AUTOCARE_CEA_PACK;
  }
  return null;
}
