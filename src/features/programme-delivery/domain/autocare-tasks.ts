import type { LessonPlanDef, PracticalTaskDef } from "./task-schema";

const assessmentRecordFields = [
  { key: "vehicleMake", type: "text" as const, label: "Vehicle make", required: true },
  { key: "vehicleModel", type: "text" as const, label: "Vehicle model", required: true },
  { key: "vehicleReg", type: "text" as const, label: "Vehicle reg", required: true },
  { key: "mileage", type: "text" as const, label: "Mileage" },
  { key: "engineSize", type: "text" as const, label: "Engine size" },
  { key: "chassisNumber", type: "text" as const, label: "Chassis number" },
  {
    key: "workDescription",
    type: "textarea" as const,
    label: "Brief description of work carried out and any further recommendations",
    required: true,
  },
  {
    key: "ppeWorn",
    type: "textarea" as const,
    label: "PPE worn and special precautions taken",
    required: true,
  },
];

const signOffSection = {
  id: "signoff",
  title: "Assessment declarations",
  fields: [
    {
      key: "apprenticeSign",
      type: "sign_off" as const,
      label: "Apprentice declaration — this is my own work",
      signOffRole: "apprentice" as const,
      required: true,
    },
    {
      key: "assessorSign",
      type: "sign_off" as const,
      label: "Assessor / trainer observation and decision",
      signOffRole: "trainer" as const,
      filledBy: "trainer" as const,
      required: true,
    },
    {
      key: "assessmentDecision",
      type: "text" as const,
      label: "Assessment decision (Pass / Refer / Resubmission required)",
      filledBy: "trainer" as const,
      required: true,
    },
    {
      key: "assessorFeedback",
      type: "textarea" as const,
      label: "Assessor feedback and action points",
      filledBy: "trainer" as const,
    },
  ],
};

const difficultySection = {
  id: "feedback",
  title: "How was this task?",
  fields: [
    {
      key: "difficulty",
      type: "difficulty_feedback" as const,
      label: "How easy or hard was this learning?",
      required: true,
      hint: "Helps tutors adapt the course for next year",
      options: ["1 — Too easy", "2 — Easy", "3 — About right", "4 — Hard", "5 — Too hard"],
    },
    {
      key: "difficultyComment",
      type: "textarea" as const,
      label: "Anything that would make this clearer next time? (optional)",
    },
  ],
};

/** Pilot transcriptions from Autocare L2 practical PDFs — curriculum can correct. */
export const AUTOCARE_PRACTICAL_TASKS: PracticalTaskDef[] = [
  {
    id: "block-1-task-3",
    evidenceRef: "Block_1_Task_3_Vehicle_Safety_Inspection",
    blockId: 1,
    kind: "practical",
    title: "Vehicle Safety Inspection and Workshop Preparation",
    scenario:
      "A customer vehicle has arrived for an initial safety inspection. You must prepare the work area, use PPE correctly, complete a structured inspection and record any safety-related findings without carrying out repairs.",
    objectives: [
      "Prepare the vehicle and workstation safely before inspection.",
      "Carry out a basic safety inspection using a methodical routine.",
      "Identify visible defects and record recommendations clearly.",
      "Demonstrate correct PPE, housekeeping and documentation practice.",
      "Explain which findings would require customer authorisation before work.",
    ],
    estimatedMinutes: 60,
    sourcePdf: "Block_1_Task_3_Vehicle_Safety_Inspection_v1.0.pdf",
    reviewStatus: "curriculum_review",
    sections: [
      {
        id: "record",
        title: "Apprentice Assessment Record",
        fields: assessmentRecordFields,
      },
      {
        id: "measurements",
        title: "Technical data and measurements",
        fields: [
          { key: "treadNsf", type: "text", label: "Tyre tread depth NS/F" },
          { key: "treadOsf", type: "text", label: "Tyre tread depth OS/F" },
          { key: "pressureNsf", type: "text", label: "Tyre pressure NS/F" },
          { key: "pressureOsf", type: "text", label: "Tyre pressure OS/F" },
          { key: "brakeFluid", type: "text", label: "Brake fluid condition" },
          { key: "batterySecurity", type: "text", label: "Battery security check" },
          { key: "lightsCheck", type: "text", label: "Lights/warning lamps check" },
          { key: "wheelTorque", type: "text", label: "Wheel torque setting" },
          {
            key: "specialTools",
            type: "textarea",
            label: "Special tools including any required calibration",
          },
        ],
      },
      {
        id: "knowledge",
        title: "Knowledge questions",
        fields: [
          {
            key: "kq1",
            type: "knowledge_question",
            label: "1. Why must PPE be selected before starting the task?",
            required: true,
          },
          {
            key: "kq2",
            type: "knowledge_question",
            label: "2. State the minimum legal tread depth for a car tyre.",
            required: true,
          },
          {
            key: "kq3",
            type: "knowledge_question",
            label: "3. Why should defects be recorded clearly before speaking to the customer?",
            required: true,
          },
          {
            key: "kq4",
            type: "knowledge_question",
            label: "4. What checks must be completed before raising a vehicle?",
            required: true,
          },
          {
            key: "kq5",
            type: "knowledge_question",
            label: "5. Explain how poor housekeeping can create a workshop risk.",
            required: true,
          },
          {
            key: "kq6",
            type: "knowledge_question",
            label: "6. Which defects would you class as safety critical?",
            required: true,
          },
          {
            key: "kq7",
            type: "knowledge_question",
            label: "7. What further work or customer authorisation may be required?",
            required: true,
          },
          {
            key: "assessorNotes",
            type: "textarea",
            label: "Assessor observation notes",
            filledBy: "trainer",
          },
        ],
      },
      signOffSection,
      difficultySection,
    ],
  },
  {
    id: "block-1-task-4",
    evidenceRef: "Block_1_Task_4_Basic_Braking_and_Tyre_Check",
    blockId: 1,
    kind: "practical",
    title: "Basic Brake and Tyre Condition Check",
    scenario:
      "A vehicle has been reported with possible tyre and brake wear during a basic workshop check. You must inspect visible brake and tyre components, record measurements and explain any customer recommendations.",
    objectives: [
      "Carry out brake and tyre checks using safe working practices.",
      "Measure tyre tread depth and inspect visible brake condition.",
      "Record findings, wheel torque and customer recommendations.",
      "Identify legal or safety concerns using evidence.",
      "Explain how tyre and brake condition affects vehicle safety.",
    ],
    estimatedMinutes: 60,
    sourcePdf: "Block_1_Task_4_Basic_Braking_and_Tyre_Check_v1.0.pdf",
    reviewStatus: "curriculum_review",
    sections: [
      {
        id: "record",
        title: "Apprentice Assessment Record",
        fields: assessmentRecordFields,
      },
      {
        id: "measurements",
        title: "Technical data and measurements",
        fields: [
          { key: "treadNsf", type: "text", label: "NS/F tread depth" },
          { key: "treadOsf", type: "text", label: "OS/F tread depth" },
          { key: "treadNsr", type: "text", label: "NS/R tread depth" },
          { key: "treadOsr", type: "text", label: "OS/R tread depth" },
          { key: "recPressure", type: "text", label: "Recommended tyre pressure" },
          { key: "measPressure", type: "text", label: "Measured tyre pressure" },
          { key: "wheelTorque", type: "text", label: "Wheel torque setting" },
          { key: "brakeCondition", type: "textarea", label: "Visible brake condition" },
          {
            key: "specialTools",
            type: "textarea",
            label: "Special tools including any required calibration",
          },
        ],
      },
      {
        id: "knowledge",
        title: "Knowledge questions",
        fields: [
          {
            key: "kq1",
            type: "knowledge_question",
            label: "1. What are the legal tyre requirements for tread depth?",
            required: true,
          },
          {
            key: "kq2",
            type: "knowledge_question",
            label: "2. Why must tyre pressures be checked before assessing wear?",
            required: true,
          },
          {
            key: "kq3",
            type: "knowledge_question",
            label: "3. What brake defects may be identified during a visual inspection?",
            required: true,
          },
          {
            key: "kq4",
            type: "knowledge_question",
            label: "4. What customer symptoms may indicate tyre or brake issues?",
            required: true,
          },
          {
            key: "kq5",
            type: "knowledge_question",
            label: "5. Why is wheel torque important after wheel removal?",
            required: true,
          },
          {
            key: "kq6",
            type: "knowledge_question",
            label: "6. How would you explain an advisory tyre defect to a customer?",
            required: true,
          },
          {
            key: "kq7",
            type: "knowledge_question",
            label: "7. What documentation should be completed after the check?",
            required: true,
          },
          {
            key: "assessorNotes",
            type: "textarea",
            label: "Assessor observation notes",
            filledBy: "trainer",
          },
        ],
      },
      signOffSection,
      difficultySection,
    ],
  },
  {
    id: "block-1-task-5",
    evidenceRef: "Task_5_Block_Reflection_and_Review",
    blockId: 1,
    kind: "reflection",
    title: "Block 1 Reflection and Review",
    scenario:
      "Complete this at the end of the block. It evidences learning and progress, records mentor and trainer feedback, and must be verified before progressing to the next block.",
    objectives: [
      "Reflect on knowledge, skills and behaviours developed in the block.",
      "Rate confidence before and now with evidence examples.",
      "Capture workplace mentor feedback.",
      "Obtain trainer progress verification (gate to next block).",
    ],
    estimatedMinutes: 45,
    sourcePdf: "Task_5_Block_Reflection_and_Review_v1.0.pdf",
    reviewStatus: "curriculum_review",
    sections: [
      {
        id: "self",
        title: "Apprentice self-assessment",
        fields: [
          {
            key: "progress1",
            type: "textarea",
            label: "1. At the start of this block I could not / was not confident to… Now I can…",
            required: true,
          },
          {
            key: "progress2",
            type: "textarea",
            label: "2. At the start of this block I could not / was not confident to… Now I can…",
            required: true,
          },
          {
            key: "mostUseful",
            type: "textarea",
            label: "What was the most useful learning in this block, and why?",
            required: true,
          },
          {
            key: "mostChallenging",
            type: "textarea",
            label: "What did you find most challenging, and how did you manage it?",
            required: true,
          },
          {
            key: "workplaceApply",
            type: "textarea",
            label: "How have you applied, or will you apply, this learning at work?",
            required: true,
          },
          {
            key: "nextGoal",
            type: "text",
            label: "One goal I will work towards in the next block",
            required: true,
          },
        ],
      },
      {
        id: "mentor",
        title: "Workplace mentor feedback",
        fields: [
          {
            key: "mentorProgress",
            type: "textarea",
            label: "What can the apprentice do now that they could not do before?",
            filledBy: "mentor",
            required: true,
          },
          {
            key: "mentorSign",
            type: "sign_off",
            label: "Mentor confirmation",
            signOffRole: "mentor",
            filledBy: "mentor",
            required: true,
          },
        ],
      },
      {
        id: "trainer",
        title: "Trainer review (releases next block)",
        fields: [
          {
            key: "trainerFeedback",
            type: "textarea",
            label: "Trainer feedback on learning and progress",
            filledBy: "trainer",
            required: true,
          },
          {
            key: "trainerDecision",
            type: "text",
            label: "Decision (Progress verified / More evidence / Additional support)",
            filledBy: "trainer",
            required: true,
          },
          {
            key: "trainerSign",
            type: "sign_off",
            label: "Trainer progress verified — unlocks next block",
            signOffRole: "trainer",
            filledBy: "trainer",
            required: true,
          },
        ],
      },
      difficultySection,
    ],
  },
];

/** Lesson plans — staff/tutor only. Apprentices never see these. */
export const AUTOCARE_LESSON_PLANS: LessonPlanDef[] = [
  ...Array.from({ length: 10 }, (_, i) => {
    const week = i + 1;
    return {
      id: `fs-week-${week}`,
      week,
      blockId: 1,
      title: `Foundation Skills FS${String(week).padStart(2, "0")} · Week ${week}`,
      audience: "staff" as const,
      sourceFile: `Foundation_Skills_FS${String(week).padStart(2, "0")}_Week_${week}_Lesson_Plan_v1.0.docx`,
    };
  }),
  ...Array.from({ length: 10 }, (_, i) => {
    const week = 11 + i;
    return {
      id: `ac-week-${week}`,
      week,
      blockId: 2,
      title: `Autocare Week ${week} Lesson Plan`,
      audience: "staff" as const,
      sourceFile: `Autocare_L2_Week_${String(week).padStart(3, "0")}_Lesson_Plan_v1.0.docx`,
    };
  }),
];

export function tasksForBlock(blockId: number): PracticalTaskDef[] {
  return AUTOCARE_PRACTICAL_TASKS.filter((t) => t.blockId === blockId);
}

export function taskById(id: string): PracticalTaskDef | undefined {
  return AUTOCARE_PRACTICAL_TASKS.find((t) => t.id === id);
}

export function lessonPlansForBlock(blockId: number): LessonPlanDef[] {
  return AUTOCARE_LESSON_PLANS.filter((p) => p.blockId === blockId);
}
