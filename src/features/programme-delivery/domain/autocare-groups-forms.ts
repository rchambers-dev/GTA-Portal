/**
 * Seeded Course Builder learner forms for Autocare CEA groups (ST0499).
 * Titles match cea/autocare-pack.ts — scenarios and fields are GTA workshop templates
 * using existing form modules only (see docs/architecture/course-builder-missing-modules.md).
 */

import type { AuthoredTaskForm, FormModule } from "./form-modules";

type Kind =
  | "safety"
  | "measure"
  | "tools"
  | "fabricate"
  | "ev"
  | "practical"
  | "alignment"
  | "diagnose"
  | "customer"
  | "stock"
  | "emissions"
  | "service"
  | "inspect";

type TaskSpec = {
  title: string;
  kind: Kind;
  /** Extra scenario sentence after the default opener. */
  focus?: string;
  checks?: string[];
  knowledge?: string[];
  /** Extra short-answer / measurement labels. */
  readings?: string[];
  includeParts?: boolean;
};

function mod(taskId: string, field: Omit<FormModule, "id">): FormModule {
  return { id: `seed-${taskId}-${field.key}`, ...field };
}

const DIFFICULTY_OPTIONS = [
  "Too easy",
  "About right",
  "Challenging",
  "Too hard",
];

function vehicleAndJob(taskId: string): FormModule[] {
  return [
    mod(taskId, {
      key: "h_vehicle",
      type: "heading",
      label: "Vehicle and job details",
    }),
    mod(taskId, {
      key: "vehicleMake",
      type: "text",
      label: "Vehicle make",
      required: true,
    }),
    mod(taskId, {
      key: "vehicleModel",
      type: "text",
      label: "Vehicle model",
      required: true,
    }),
    mod(taskId, {
      key: "vehicleReg",
      type: "text",
      label: "Vehicle reg",
      required: true,
    }),
    mod(taskId, {
      key: "mileage",
      type: "text",
      label: "Mileage",
    }),
    mod(taskId, {
      key: "dateCompleted",
      type: "date",
      label: "Date completed",
      required: true,
    }),
  ];
}

function workAndSafety(taskId: string): FormModule[] {
  return [
    mod(taskId, {
      key: "h_work",
      type: "heading",
      label: "Work carried out",
    }),
    mod(taskId, {
      key: "workDescription",
      type: "textarea",
      label:
        "Brief description of work carried out and any further recommendations",
      required: true,
    }),
    mod(taskId, {
      key: "ppeWorn",
      type: "textarea",
      label: "PPE worn and special precautions taken",
      required: true,
    }),
    mod(taskId, {
      key: "specialTools",
      type: "textarea",
      label: "Special tools including any required calibration",
    }),
  ];
}

function checklist(
  taskId: string,
  label: string,
  options: string[],
): FormModule {
  return mod(taskId, {
    key: "taskChecklist",
    type: "checkbox_group",
    label,
    options,
    required: true,
  });
}

function knowledgeQs(taskId: string, questions: string[]): FormModule[] {
  if (questions.length === 0) return [];
  return [
    mod(taskId, {
      key: "h_knowledge",
      type: "heading",
      label: "Knowledge checks",
    }),
    ...questions.map((label, i) =>
      mod(taskId, {
        key: `kq${i + 1}`,
        type: "knowledge_question",
        label: `${i + 1}. ${label}`,
        required: true,
      }),
    ),
  ];
}

function readings(taskId: string, labels: string[]): FormModule[] {
  if (labels.length === 0) return [];
  return [
    mod(taskId, {
      key: "h_readings",
      type: "heading",
      label: "Technical data and readings",
    }),
    ...labels.map((label, i) =>
      mod(taskId, {
        key: `reading${i + 1}`,
        type: "text",
        label,
        required: true,
      }),
    ),
  ];
}

function parts(taskId: string): FormModule {
  return mod(taskId, {
    key: "partsUsed",
    type: "parts_rows",
    label: "Parts and materials used (qty, description, reference)",
    rowCount: 4,
  });
}

function closing(taskId: string): FormModule[] {
  return [
    mod(taskId, {
      key: "h_signoff",
      type: "heading",
      label: "Declaration",
    }),
    mod(taskId, {
      key: "apprenticeSign",
      type: "sign_off",
      label: "I confirm this is my own work and the record is accurate",
      signOffRole: "apprentice",
      required: true,
    }),
    mod(taskId, {
      key: "difficulty",
      type: "difficulty_feedback",
      label: "How challenging was this task for you?",
      options: DIFFICULTY_OPTIONS,
      required: true,
    }),
  ];
}

function guidance(taskId: string, text: string): FormModule {
  return mod(taskId, {
    key: "guidance",
    type: "description",
    label: text,
  });
}

function defaultChecks(kind: Kind, title: string): string[] {
  switch (kind) {
    case "safety":
      return [
        "Risk assessment / safe system of work followed",
        "Correct PPE selected and worn",
        "Workshop hazards identified and controlled",
        "Tools and equipment checked before use",
        "Waste / consumables disposed of correctly",
      ];
    case "ev":
      return [
        "Vehicle identified as electric / hybrid",
        "High-voltage warning labels located",
        "Service disconnect / isolation points identified",
        "Orange HV cabling and components located (not touched)",
        "Safe working distance and PPE requirements noted",
      ];
    case "measure":
      return [
        "Correct measuring equipment selected",
        "Equipment checked / calibrated as required",
        "Manufacturer or workshop limits obtained",
        "Readings recorded accurately",
        "Result compared against specification",
      ];
    case "alignment":
      return [
        "Pre-checks completed (tyres, suspension, ride height)",
        "Equipment set up to manufacturer procedure",
        "Before readings recorded",
        "Adjustments made within specification",
        "After readings recorded and printed / saved",
      ];
    case "diagnose":
      return [
        "Customer / reported fault confirmed",
        "Diagnostic strategy planned",
        "Tests carried out systematically",
        "Root cause identified with evidence",
        "Repair or further action recommended",
      ];
    case "emissions":
      return [
        "Vehicle prepared for test (oil, coolant, condition)",
        "Analyser / equipment set up correctly",
        "Readings recorded against limits",
        "Results interpreted",
        "Findings reported clearly",
      ];
    case "service":
      return [
        "Service schedule / manufacturer data obtained",
        "Parts and fluids identified",
        "Inspection items listed for this service type",
        "Workshop time / resources planned",
        "Customer-facing notes prepared",
      ];
    case "inspect":
      return [
        "Systematic safety inspection completed",
        "Defects recorded with severity",
        "Quote / estimate prepared",
        "Findings explained clearly for the customer",
        "Recommendations prioritised",
      ];
    case "customer":
      return [
        "Customer need identified",
        "Clear explanation given in non-technical language",
        "Options and costs discussed where relevant",
        "Next steps agreed",
        "Record kept of the conversation",
      ];
    case "stock":
      return [
        "Correct part numbers identified",
        "Stock checked / ordered",
        "Quality / suitability confirmed",
        "Cost and lead time noted",
        "Parts booked to job correctly",
      ];
    case "fabricate":
      return [
        "Job specification understood",
        "Materials selected appropriately",
        "Marking out and cutting completed accurately",
        "Joining / finishing to required standard",
        "Finished item checked against brief",
      ];
    case "tools":
      return [
        "Correct tools selected for the job",
        "Tools inspected before use",
        "Used safely and as intended",
        "Stored / returned correctly after use",
        "Any damaged equipment reported",
      ];
    default:
      return [
        `Safe preparation completed for: ${title}`,
        "Manufacturer / workshop data obtained",
        "Removal / strip carried out correctly",
        "Install / refit to specification (torque where required)",
        "System checked / road-test considerations noted",
        "Work area left clean and tidy",
      ];
  }
}

function defaultKnowledge(kind: Kind, title: string): string[] {
  switch (kind) {
    case "safety":
      return [
        "Why must you assess risks before starting work on a vehicle?",
        "Give two examples of PPE for vehicle maintenance and when each is needed.",
        "What should you do if a tool or piece of equipment is damaged?",
      ];
    case "ev":
      return [
        "Why must high-voltage systems only be worked on by trained people?",
        "What visual clues help you identify an electric or hybrid vehicle?",
        "What is the purpose of the service disconnect / isolation procedure?",
      ];
    case "measure":
      return [
        "Why must measuring equipment be checked or calibrated?",
        "How do you decide whether a reading is within specification?",
        "What would you do if a reading was outside limits?",
      ];
    case "diagnose":
      return [
        "Describe the diagnostic approach you used and why.",
        "What evidence confirmed the root cause?",
        "What further tests would you recommend if the fault returned?",
      ];
    case "customer":
      return [
        "How did you check you understood the customer’s needs?",
        "How would you explain a technical finding to a non-technical customer?",
        "What would you do if the customer disagreed with your recommendation?",
      ];
    case "stock":
      return [
        "Why is using the correct part number important?",
        "What checks do you make before fitting a new part?",
        "How do lead times affect customer communication?",
      ];
    case "service":
      return [
        "What is the difference between this service type and a major service?",
        "Which items must always be checked regardless of service level?",
        "How do manufacturer schedules and mileage interact?",
      ];
    case "inspect":
      return [
        "How do you prioritise defects for the customer?",
        "What information must a clear quote include?",
        "When would you refuse to return a vehicle to the road?",
      ];
    case "emissions":
      return [
        "What factors can affect emissions test results?",
        "How do oxygen sensor / EGR faults show up in emissions readings?",
        "What follow-up would you recommend after a failed test?",
      ];
    case "alignment":
      return [
        "Why must tyre pressures and ride height be correct before alignment?",
        "What does an out-of-spec camber or toe reading suggest?",
        "When would you recommend further suspension investigation?",
      ];
    default:
      return [
        `Explain the main safety considerations for: ${title}.`,
        "Which technical data or torque figures did you use, and why?",
        "What checks confirm the repair was successful?",
      ];
  }
}

function buildForm(taskId: string, spec: TaskSpec): AuthoredTaskForm {
  const checks = spec.checks ?? defaultChecks(spec.kind, spec.title);
  const knowledge = spec.knowledge ?? defaultKnowledge(spec.kind, spec.title);
  const includeParts =
    spec.includeParts ??
    (spec.kind === "practical" ||
      spec.kind === "fabricate" ||
      spec.kind === "stock" ||
      spec.kind === "service");

  const opener =
    spec.kind === "customer"
      ? "Complete this task from a real or simulated customer interaction at work or in the training centre."
      : spec.kind === "stock"
        ? "Complete this parts-sourcing activity using workshop systems and manufacturer data."
        : spec.kind === "service" || spec.kind === "inspect"
          ? "Plan and record this inspection / service preparation using manufacturer data and workshop procedures."
          : "Carry out this Autocare technician task under supervision. Work safely, follow workshop procedures, and record what you found and what you did.";

  const scenario = [opener, spec.focus].filter(Boolean).join(" ");

  const modules: FormModule[] = [
    guidance(
      taskId,
      "Complete every section. Use manufacturer or workshop data where readings or limits are required. Ask your trainer if you are unsure before starting.",
    ),
    ...vehicleAndJob(taskId),
    checklist(taskId, "Steps completed (tick all that apply)", checks),
    ...readings(taskId, spec.readings ?? []),
    ...workAndSafety(taskId),
    ...(includeParts ? [parts(taskId)] : []),
    ...knowledgeQs(taskId, knowledge),
    ...closing(taskId),
  ];

  return {
    title: spec.title,
    scenario,
    status: "ready",
    modules,
  };
}

/** Compact specs for all 56 Autocare group tasks (g{n}-t{m}). */
const AUTOCARE_GROUP_TASK_SPECS: Record<string, TaskSpec> = {
  "g1-t1": {
    title: "Health and safety practices in vehicle maintenance",
    kind: "safety",
    focus:
      "Show how you apply health and safety practices for a typical vehicle maintenance job.",
  },
  "g1-t2": {
    title: "Using mechanical measuring equipment",
    kind: "measure",
    focus: "Use mechanical measuring equipment (e.g. micrometers, dial gauges, feeler gauges) on a real component.",
    readings: [
      "Equipment used",
      "Component measured",
      "Reading taken",
      "Manufacturer / workshop limit",
      "Pass / fail against limit",
    ],
  },
  "g1-t3": {
    title: "Using electrical measuring equipment",
    kind: "measure",
    focus: "Use electrical measuring equipment (e.g. multimeter) to take accurate readings safely.",
    readings: [
      "Meter / equipment used",
      "Circuit or component tested",
      "Reading (V / A / Ω)",
      "Expected value / range",
      "Pass / fail against expected",
    ],
  },
  "g1-t4": {
    title: "Using tools and equipment",
    kind: "tools",
    focus: "Select and use common workshop tools and equipment safely for a maintenance task.",
  },
  "g1-t5": {
    title: "Fabrication task",
    kind: "fabricate",
    focus: "Complete a fabrication brief to the required standard (marking out, cutting, joining, finishing).",
    includeParts: true,
  },
  "g2-t1": {
    title: "Locating electric/hybrid vehicle components",
    kind: "ev",
    focus:
      "Identify and locate electric / hybrid components and isolation points without working on live HV systems.",
  },
  "g3-t1": {
    title: "Remove and install tyres",
    kind: "practical",
    focus: "Remove and refit tyres using correct equipment and procedures.",
    readings: ["Tyre size / load / speed rating", "Recommended pressures", "Torque used on wheel nuts"],
    includeParts: true,
  },
  "g3-t2": {
    title: "Carry out puncture repair",
    kind: "practical",
    focus: "Assess and repair a puncture using an approved method, or record why repair was not suitable.",
    includeParts: true,
  },
  "g3-t3": {
    title: "Replace a TPMS valve",
    kind: "practical",
    focus: "Replace a TPMS valve and confirm sensor / system status after fitment.",
    readings: ["TPMS part / sensor ID", "System status after replacement"],
    includeParts: true,
  },
  "g3-t4": {
    title: "Balance all four wheels",
    kind: "practical",
    focus: "Balance all four wheels and record weights fitted.",
    readings: [
      "LF weight(s)",
      "RF weight(s)",
      "LR weight(s)",
      "RR weight(s)",
    ],
  },
  "g3-t5": {
    title: "Repair run-flat tyre",
    kind: "practical",
    focus: "Follow manufacturer guidance for run-flat assessment and repair (or justify non-repair).",
    includeParts: true,
  },
  "g4-t1": {
    title: "Remove and install front brake discs and pads",
    kind: "practical",
    focus: "Replace front discs and pads to specification and reassemble safely.",
    readings: ["Disc thickness (measured)", "Minimum disc thickness", "Pad part numbers / friction material notes"],
    includeParts: true,
  },
  "g4-t2": {
    title: "Remove and install rear brake shoes and drums",
    kind: "practical",
    focus: "Replace rear shoes and drums, adjust as required, and confirm operation.",
    readings: ["Drum diameter (measured)", "Maximum drum diameter", "Shoe part reference"],
    includeParts: true,
  },
  "g4-t3": {
    title: "Replace hydraulic brake fluid",
    kind: "practical",
    focus: "Replace brake fluid using the correct grade and bleed procedure.",
    readings: ["Fluid specification", "Bleed method used"],
    includeParts: true,
  },
  "g4-t4": {
    title: "Remove and install rear brake discs and pads",
    kind: "practical",
    focus: "Replace rear discs and pads to specification.",
    readings: ["Disc thickness (measured)", "Minimum disc thickness"],
    includeParts: true,
  },
  "g4-t5": {
    title: "Check front brake disc run-out",
    kind: "measure",
    focus: "Measure front brake disc run-out and compare with limits.",
    readings: [
      "Equipment used",
      "Run-out reading (LF)",
      "Run-out reading (RF)",
      "Manufacturer limit",
      "Result",
    ],
  },
  "g4-t6": {
    title: "Check rear brake drum ovality",
    kind: "measure",
    focus: "Measure rear brake drum ovality / out-of-round and compare with limits.",
    readings: [
      "Equipment used",
      "Ovality reading (LR)",
      "Ovality reading (RR)",
      "Manufacturer limit",
      "Result",
    ],
  },
  "g5-t1": {
    title: "Carry out two-wheel alignment",
    kind: "alignment",
    focus: "Carry out two-wheel (front) alignment and record before / after figures.",
    readings: [
      "Toe before",
      "Toe after",
      "Camber before (if measured)",
      "Camber after (if measured)",
      "Specification used",
    ],
  },
  "g5-t2": {
    title: "Remove and replace a steering track rod end",
    kind: "practical",
    focus: "Replace a track rod end and set / check alignment as required.",
    readings: ["Torque used", "Alignment check completed? (Y/N / notes)"],
    includeParts: true,
  },
  "g5-t3": {
    title: "Remove and replace a front lower ball joint",
    kind: "practical",
    focus: "Replace a front lower ball joint using correct tools and torque.",
    includeParts: true,
  },
  "g5-t4": {
    title: "Remove and replace a front suspension strut",
    kind: "practical",
    focus: "Replace a front strut / spring assembly safely (spring compressor where required).",
    includeParts: true,
  },
  "g5-t5": {
    title: "Remove and replace a rear suspension damper",
    kind: "practical",
    focus: "Replace a rear damper and check related fastenings / bushes.",
    includeParts: true,
  },
  "g5-t6": {
    title: "Remove and install power steering pump",
    kind: "practical",
    focus: "Replace a power steering pump, refill / bleed, and check for leaks.",
    readings: ["Fluid specification", "Bleed procedure notes"],
    includeParts: true,
  },
  "g5-t7": {
    title: "Remove and install steering rack gaitor",
    kind: "practical",
    focus: "Replace a steering rack gaiter and secure clips correctly.",
    includeParts: true,
  },
  "g6-t1": {
    title: "Remove and install radiator",
    kind: "practical",
    focus: "Replace a radiator, refill coolant correctly, and check for leaks.",
    readings: ["Coolant specification", "Bleed / fill method"],
    includeParts: true,
  },
  "g6-t2": {
    title: "Remove and install a water pump",
    kind: "practical",
    focus: "Replace a water pump and restore the cooling system correctly.",
    includeParts: true,
  },
  "g6-t3": {
    title: "Remove and install a thermostat",
    kind: "practical",
    focus: "Replace a thermostat and confirm cooling system operation.",
    includeParts: true,
  },
  "g6-t4": {
    title: "Replace a sump gasket",
    kind: "practical",
    focus: "Replace a sump gasket, refill oil to specification, and check for leaks.",
    readings: ["Oil grade / quantity"],
    includeParts: true,
  },
  "g6-t5": {
    title: "Remove and install oil pump",
    kind: "practical",
    focus: "Replace an oil pump following manufacturer procedure and priming requirements.",
    includeParts: true,
  },
  "g7-t1": {
    title: "Remove and install starter motor",
    kind: "practical",
    focus: "Replace a starter motor and confirm cranking operation.",
    readings: ["Battery voltage before test", "Cranking result"],
    includeParts: true,
  },
  "g7-t2": {
    title: "Remove and install alternator",
    kind: "practical",
    focus: "Replace an alternator and confirm charging output.",
    readings: ["Charging voltage (engine running)", "Expected range"],
    includeParts: true,
  },
  "g7-t3": {
    title: "Replace vehicle battery",
    kind: "practical",
    focus: "Replace a vehicle battery safely, including memory / coding considerations where relevant.",
    readings: ["Old battery CCA / Ah", "New battery CCA / Ah", "Resting voltage after fit"],
    includeParts: true,
  },
  "g8-t1": {
    title: "Dealing with customer needs and relationships",
    kind: "customer",
    focus:
      "Record how you identified needs, communicated clearly, and agreed next steps with a customer.",
    includeParts: false,
    readings: ["Customer name / ref (or simulated)", "Enquiry or complaint summary"],
  },
  "g9-t1": {
    title: "Sourcing parts for servicing",
    kind: "stock",
    focus: "Identify, source, and book parts required for a service or repair.",
    includeParts: true,
    readings: ["Job / vehicle ref", "Parts system used", "Lead time / availability notes"],
  },
  "g10-t1": {
    title: "Remove and install an ABS wheel speed sensor",
    kind: "practical",
    focus: "Replace an ABS wheel speed sensor and clear / confirm system status.",
    readings: ["Fault code(s) before", "Fault code(s) after"],
    includeParts: true,
  },
  "g10-t2": {
    title: "Remove and install ABS reluctor wheel",
    kind: "practical",
    focus: "Replace an ABS reluctor (tone) wheel and confirm sensor signal.",
    includeParts: true,
  },
  "g10-t3": {
    title: "Check output from ABS wheel speed sensor",
    kind: "diagnose",
    focus: "Measure or scope ABS wheel speed sensor output and interpret the result.",
    readings: [
      "Test method (scope / meter / scan data)",
      "Signal / reading obtained",
      "Expected result",
      "Conclusion",
    ],
  },
  "g11-t1": {
    title: "Traction control fault",
    kind: "diagnose",
    focus: "Diagnose a traction control fault using codes, data, and systematic tests.",
    readings: ["Fault codes", "Freeze-frame / live data notes", "Root cause"],
  },
  "g11-t2": {
    title: "Replace suspension ride height sensor",
    kind: "practical",
    focus: "Replace a ride height sensor and carry out any required calibration.",
    readings: ["Calibration / coding completed? (notes)"],
    includeParts: true,
  },
  "g11-t3": {
    title: "Diagnose fault with adaptive suspension",
    kind: "diagnose",
    focus: "Diagnose an adaptive suspension fault and recommend repair.",
    readings: ["Fault codes", "Tests performed", "Root cause"],
  },
  "g11-t4": {
    title: "Diagnose excessive front tyre wear",
    kind: "diagnose",
    focus: "Diagnose the cause of excessive front tyre wear (alignment, suspension, pressures, driving).",
    readings: ["Wear pattern observed", "Pressures", "Alignment / suspension findings", "Root cause"],
  },
  "g11-t5": {
    title: "Carry out 4-wheel alignment and report",
    kind: "alignment",
    focus: "Carry out four-wheel alignment and produce a clear before / after report.",
    readings: [
      "Front toe before / after",
      "Rear toe before / after",
      "Camber notes",
      "Thrust angle notes",
      "Report reference / print ID",
    ],
  },
  "g11-t6": {
    title: "Diagnose ADAS fault",
    kind: "diagnose",
    focus: "Diagnose an ADAS-related fault and note any calibration requirements.",
    readings: ["System affected", "Fault codes", "Calibration required? (Y/N / notes)", "Root cause"],
  },
  "g12-t1": {
    title: "Remove and install complete exhaust system",
    kind: "practical",
    focus: "Replace a complete exhaust system and check for leaks / secure mounting.",
    includeParts: true,
  },
  "g12-t2": {
    title: "Carry out an exhaust emissions test",
    kind: "emissions",
    focus: "Carry out an emissions test and record results against limits.",
    readings: [
      "Fuel type",
      "CO / HC / Lambda or opacity readings",
      "Limit values",
      "Pass / fail",
    ],
  },
  "g12-t3": {
    title: "Diagnose exhaust emissions fault",
    kind: "diagnose",
    focus: "Diagnose the cause of an emissions failure or warning.",
    readings: ["Symptoms / codes", "Tests performed", "Root cause"],
  },
  "g12-t4": {
    title: "Checking the operation of the oxygen sensor",
    kind: "diagnose",
    focus: "Check oxygen (lambda) sensor operation using suitable test equipment.",
    readings: ["Sensor location (pre/post cat)", "Test method", "Result vs expected"],
  },
  "g12-t5": {
    title: "Checking operation of the EGR valve",
    kind: "diagnose",
    focus: "Check EGR valve operation and record findings.",
    readings: ["Test method", "Commanded vs actual (if available)", "Result"],
  },
  "g13-t1": {
    title: "Remove and install air conditioning condenser",
    kind: "practical",
    focus:
      "Replace an A/C condenser. Note F-Gas / recovery requirements — only qualified people may handle refrigerant.",
    readings: ["Recovery / recharge carried out by (name / ticket)", "System pressures after (if applicable)"],
    includeParts: true,
  },
  "g13-t2": {
    title: "Remove and install air conditioning expansion valve",
    kind: "practical",
    focus:
      "Replace an A/C expansion valve under correct F-Gas controls.",
    includeParts: true,
  },
  "g13-t3": {
    title: "Remove and install air conditioning compressor",
    kind: "practical",
    focus:
      "Replace an A/C compressor under correct F-Gas controls and oil quantity rules.",
    readings: ["Oil quantity / type notes", "Recovery / recharge by"],
    includeParts: true,
  },
  "g14-t1": {
    title: "Prepare for an oil service",
    kind: "service",
    focus: "Prepare the parts, checks, and plan for an oil service.",
    readings: ["Oil grade / quantity", "Filter part number(s)", "Additional items due"],
    includeParts: true,
  },
  "g14-t2": {
    title: "Prepare for an interim service",
    kind: "service",
    focus: "Prepare the parts, inspection list, and plan for an interim service.",
    includeParts: true,
  },
  "g14-t3": {
    title: "Prepare for a major service",
    kind: "service",
    focus: "Prepare the parts, inspection list, and plan for a major service.",
    includeParts: true,
  },
  "g14-t4": {
    title: "Prepare a 3-year service plan",
    kind: "service",
    focus: "Build a 3-year service plan from manufacturer schedules and typical mileage.",
    includeParts: false,
    readings: [
      "Assumed annual mileage",
      "Year 1 key items",
      "Year 2 key items",
      "Year 3 key items",
    ],
  },
  "g14-t5": {
    title: "Safety inspection and quote",
    kind: "inspect",
    focus: "Complete a safety inspection, record defects, and produce a customer quote.",
    includeParts: false,
    readings: ["Inspection checklist used", "Quote total (ex/inc VAT as noted)", "Priority advisories"],
  },
};

export function isAutocareGroupsPackId(packId: string): boolean {
  return (
    packId === "cea-autocare-st0499" ||
    packId.startsWith("cea-autocare-st0499-")
  );
}

export function getAutocareGroupsSeedForm(
  packId: string,
  taskId: string,
): AuthoredTaskForm | null {
  if (!isAutocareGroupsPackId(packId)) return null;
  const spec = AUTOCARE_GROUP_TASK_SPECS[taskId];
  if (!spec) return null;
  return buildForm(taskId, spec);
}

/** All Autocare group task ids that have seeded forms. */
export function listAutocareGroupsSeedTaskIds(): string[] {
  return Object.keys(AUTOCARE_GROUP_TASK_SPECS);
}

/**
 * Write seeded forms for any Autocare groups pack keys that are not already stored.
 * Does not overwrite staff edits.
 */
export function buildAutocareGroupsSeedFormsForPack(
  packId: string,
): Record<string, AuthoredTaskForm> {
  if (!isAutocareGroupsPackId(packId)) return {};
  const out: Record<string, AuthoredTaskForm> = {};
  for (const taskId of listAutocareGroupsSeedTaskIds()) {
    const form = getAutocareGroupsSeedForm(packId, taskId);
    if (form) out[`${packId}::${taskId}`] = form;
  }
  return out;
}
