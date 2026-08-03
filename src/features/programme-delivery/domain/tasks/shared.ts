import type {
  PracticalTaskDef,
  TaskFieldDef,
  TaskSectionDef,
} from "../task-schema";
import { AUTOCARE_BLOCKS } from "../autocare-blocks";

export const assessmentRecordFields: TaskFieldDef[] = [
  { key: "vehicleMake", type: "text", label: "Vehicle make", required: true },
  { key: "vehicleModel", type: "text", label: "Vehicle model", required: true },
  { key: "vehicleReg", type: "text", label: "Vehicle reg", required: true },
  { key: "mileage", type: "text", label: "Mileage" },
  { key: "engineSize", type: "text", label: "Engine size" },
  { key: "chassisNumber", type: "text", label: "Chassis number" },
  {
    key: "workDescription",
    type: "textarea",
    label:
      "Brief description of work carried out and any further recommendations",
    required: true,
  },
  {
    key: "ppeWorn",
    type: "textarea",
    label: "PPE worn and special precautions taken",
    required: true,
  },
];

export const signOffSection: TaskSectionDef = {
  id: "signoff",
  title: "Assessment declarations",
  fields: [
    {
      key: "apprenticeSign",
      type: "sign_off",
      label: "Apprentice declaration — this is my own work",
      signOffRole: "apprentice",
      required: true,
    },
    {
      key: "assessorSign",
      type: "sign_off",
      label: "Assessor / trainer observation and decision",
      signOffRole: "trainer",
      filledBy: "trainer",
      required: true,
    },
    {
      key: "assessmentDecision",
      type: "radio_group",
      label: "Assessment decision",
      options: ["Pass", "Refer", "Resubmission required"],
      filledBy: "trainer",
      required: true,
    },
    {
      key: "assessmentEvidenceRef",
      type: "text",
      label: "Assessment / evidence reference",
      filledBy: "trainer",
    },
    {
      key: "assessorFeedback",
      type: "textarea",
      label: "Assessor feedback and action points",
      filledBy: "trainer",
    },
  ],
};

export const difficultySection: TaskSectionDef = {
  id: "feedback",
  title: "How was this task?",
  fields: [
    {
      key: "difficulty",
      type: "difficulty_feedback",
      label: "How easy or hard was this learning?",
      required: true,
      hint: "Helps tutors adapt the course for next year",
      options: [
        "1 — Too easy",
        "2 — Easy",
        "3 — About right",
        "4 — Hard",
        "5 — Too hard",
      ],
    },
    {
      key: "difficultyComment",
      type: "textarea",
      label: "Anything that would make this clearer next time? (optional)",
    },
  ],
};

function blockContext(blockId: number): { name: string; weeks?: string } {
  const block = AUTOCARE_BLOCKS.find((b) => b.id === blockId);
  return {
    name: block?.name ?? `Block ${blockId}`,
    weeks:
      block?.weekStart != null && block?.weekEnd != null
        ? `Weeks ${block.weekStart}–${block.weekEnd}`
        : undefined,
  };
}

/**
 * Task 1 — knowledge test result record, one per block.
 * The trainer records the score and decision; the apprentice signs to
 * acknowledge the result, so almost every field here is staff-filled.
 */
export function makeKnowledgeTest(blockId: number): PracticalTaskDef {
  const { name, weeks } = blockContext(blockId);

  return {
    id: `block-${blockId}-task-1`,
    evidenceRef: "Knowledge_Test_Result_Record_Simple",
    blockId,
    taskNumber: 1,
    kind: "knowledge_test",
    title: `Block ${blockId} Knowledge Test Result`,
    scenario:
      "Your knowledge test result for this block is recorded here. Your trainer enters the score and decision after marking, then you sign to confirm you have seen the result and the feedback.",
    objectives: [
      "Sit the block knowledge test under the conditions your trainer sets.",
      "Review the score, decision and feedback recorded by your trainer.",
      "Confirm you have seen the result and understand any referral action.",
    ],
    estimatedMinutes: 30,
    sourcePdf: "Knowledge_Test_Result_Record_Simple_v1.0.pdf",
    weeks,
    assessmentType: "Knowledge test",
    materials: [
      "Block knowledge test paper or online test",
      "Revision notes from this block",
    ],
    instructions: [
      "Sit the knowledge test for this block.",
      "Your trainer marks the test and records the score and decision.",
      "Review the feedback, then sign to confirm you have seen the result.",
    ],
    reviewStatus: "curriculum_review",
    sections: [
      {
        id: "test",
        title: "Test details",
        fields: [
          {
            key: "blockContext",
            type: "description",
            label: `Block ${blockId} · ${name}${weeks ? ` · ${weeks}` : ""}`,
          },
          {
            key: "examTitle",
            type: "text",
            label: "Exam title",
            filledBy: "trainer",
            required: true,
          },
          {
            key: "testDate",
            type: "date",
            label: "Date",
            filledBy: "trainer",
            required: true,
          },
          {
            key: "score",
            type: "text",
            label: "Score",
            filledBy: "trainer",
            required: true,
          },
          {
            key: "percentage",
            type: "text",
            label: "Percentage",
            filledBy: "trainer",
            required: true,
          },
          {
            key: "result",
            type: "text",
            label: "Result",
            filledBy: "trainer",
            required: true,
          },
        ],
      },
      {
        id: "decision",
        title: "Assessment decision and feedback",
        fields: [
          {
            key: "assessmentDecision",
            type: "radio_group",
            label: "Assessment decision",
            options: ["Pass", "Referred"],
            filledBy: "trainer",
            required: true,
          },
          {
            key: "trainerFeedback",
            type: "textarea",
            label: "Feedback",
            filledBy: "trainer",
          },
        ],
      },
      {
        id: "signoff",
        title: "Sign-off",
        fields: [
          {
            key: "apprenticeSign",
            type: "sign_off",
            label: "Apprentice — I confirm I have seen this result and feedback",
            signOffRole: "apprentice",
            required: true,
          },
          {
            key: "trainerSign",
            type: "sign_off",
            label: "Trainer confirmation of result",
            signOffRole: "trainer",
            filledBy: "trainer",
            required: true,
          },
        ],
      },
      difficultySection,
    ],
  };
}

/**
 * Task 2 — apprentice job card, workplace evidence signed by the mentor.
 * Modelled as one instance per block pending confirmation of whether
 * apprentices raise several job cards per block.
 */
export function makeJobCard(blockId: number): PracticalTaskDef {
  const { name, weeks } = blockContext(blockId);

  return {
    id: `block-${blockId}-task-2`,
    evidenceRef: "Apprentice_Job_Card",
    blockId,
    taskNumber: 2,
    kind: "job_card",
    title: `Block ${blockId} Apprentice Job Card`,
    scenario:
      "Record a real job you completed at work under your mentor's supervision during this block. Capture the vehicle, the customer complaint, what you diagnosed and repaired, the parts and tools you used, and how you worked safely. Your mentor reviews and signs it.",
    objectives: [
      "Record a workplace job accurately using the correct documentation.",
      "Show the technical data, tools and parts used to complete the job.",
      "Evidence safe working, correct PPE and proper waste disposal.",
      "Record time control and any delays honestly.",
      "Obtain mentor confirmation that the record reflects the work completed.",
    ],
    estimatedMinutes: 60,
    sourcePdf: "Apprentice_Job_Card_v1.0.pdf",
    weeks,
    assessmentType: "Workplace evidence / mentor observation",
    materials: [
      "A real workplace job completed under mentor supervision",
      "Manufacturer or workshop technical data",
      "Parts and materials records",
      "Mentor available to review and sign",
    ],
    instructions: [
      "Complete a workplace job under your mentor's supervision.",
      "Record the vehicle, complaint and work requested.",
      "Record the diagnosis, repair, technical data, tools and parts used.",
      "Record time control, road test and any delays.",
      "Confirm PPE and safe working, then ask your mentor to review and sign.",
    ],
    reviewStatus: "curriculum_review",
    sections: [
      {
        id: "job",
        title: "Job and workplace details",
        fields: [
          {
            key: "blockContext",
            type: "description",
            label: `Block ${blockId} · ${name}${weeks ? ` · ${weeks}` : ""}`,
          },
          { key: "jobReference", type: "text", label: "Job reference" },
          { key: "evidenceNo", type: "text", label: "Evidence no." },
          {
            key: "employerGarage",
            type: "text",
            label: "Employer / garage",
            required: true,
          },
          {
            key: "mentorName",
            type: "text",
            label: "Mentor name",
            required: true,
          },
          {
            key: "dateCompleted",
            type: "date",
            label: "Date completed",
            required: true,
          },
        ],
      },
      {
        id: "vehicle",
        title: "Vehicle details",
        fields: [
          { key: "make", type: "text", label: "Make", required: true },
          { key: "model", type: "text", label: "Model", required: true },
          { key: "regNo", type: "text", label: "Reg no.", required: true },
          { key: "mileage", type: "text", label: "Mileage" },
          { key: "vin", type: "text", label: "VIN / chassis" },
          { key: "engineSize", type: "text", label: "Engine size" },
        ],
      },
      {
        id: "summary",
        title: "Workplace task summary",
        fields: [
          {
            key: "jobTitle",
            type: "text",
            label: "Job / task title",
            required: true,
          },
          {
            key: "customerComplaint",
            type: "textarea",
            label: "Customer complaint / work requested",
            required: true,
          },
          {
            key: "furtherAttention",
            type: "textarea",
            label: "Items requiring further attention",
          },
        ],
      },
      {
        id: "bodyCondition",
        title: "Vehicle body condition and damage record",
        fields: [
          {
            key: "bodyDamageNotes",
            type: "textarea",
            label: "Body condition and damage notes",
            hint: "Describe the location of any dents (D), scratches or stone chips (S) and corrosion (C). The paper job card uses a vehicle diagram — if you marked one up, upload the PDF as well using the fallback below.",
            required: true,
          },
        ],
      },
      {
        id: "timeControl",
        title: "Time control and road test",
        fields: [
          { key: "timeIn", type: "text", label: "Time in" },
          { key: "timeRequired", type: "text", label: "Time required" },
          { key: "timeOut", type: "text", label: "Time out" },
          {
            key: "withinTimescale",
            type: "radio_group",
            label: "Completed within timescale",
            options: ["Yes", "No"],
            required: true,
          },
          {
            key: "roadTest",
            type: "checkbox_group",
            label: "Road test carried out",
            options: ["Pre-repair road test", "Post-repair road test"],
          },
          {
            key: "anyDelays",
            type: "radio_group",
            label: "Any delays",
            options: ["No", "Yes"],
            required: true,
          },
          {
            key: "delayReason",
            type: "textarea",
            label: "Delay reason / notes",
          },
        ],
      },
      {
        id: "repair",
        title: "Diagnosis and repair carried out",
        fields: [
          {
            key: "diagnosisRepair",
            type: "textarea",
            label: "Diagnosis and repair carried out",
            required: true,
          },
          {
            key: "technicalData",
            type: "textarea",
            label: "Technical data employed",
            hint: "Record technical information used, manufacturer data, measurements, torque settings and test results.",
            required: true,
          },
          {
            key: "specialTools",
            type: "textarea",
            label: "Special tools and equipment used",
          },
          {
            key: "partsUsed",
            type: "parts_rows",
            label: "Parts / materials used",
            rowCount: 4,
          },
        ],
      },
      {
        id: "safeWorking",
        title: "Protective equipment and working practice",
        fields: [
          {
            key: "ppeUsed",
            type: "checkbox_group",
            label: "Use of appropriate protective equipment",
            options: [
              "Vehicle protection",
              "Footwear",
              "Goggles",
              "Gloves",
              "Overalls",
              "Mask",
              "Ear defenders",
              "Head protection",
              "Skin protection",
            ],
            required: true,
          },
          {
            key: "ppeOther",
            type: "text",
            label: "Other protective equipment — please state",
          },
          {
            key: "apprenticeStatements",
            type: "checkbox_group",
            label: "Tick the statements that apply to you on this job",
            options: [
              "Dealt directly with customer",
              "Carried out test / fault diagnosis",
              "Work area cleaned down after repair",
              "Estimated time to complete job",
              "Worked in a safe manner",
              "Tools and equipment checked for serviceability pre and post task",
              "Recorded the job on appropriate documents",
              "Disposed of waste material correctly (COSHH)",
            ],
            required: true,
          },
        ],
      },
      {
        id: "declarations",
        title: "Declarations and mentor sign-off",
        fields: [
          {
            key: "apprenticeSign",
            type: "sign_off",
            label:
              "Apprentice declaration — this job card records work I completed at work under mentor supervision",
            signOffRole: "apprentice",
            required: true,
          },
          {
            key: "mentorObservation",
            type: "textarea",
            label: "Mentor observation comments",
            filledBy: "mentor",
            required: true,
          },
          {
            key: "mentorJobRole",
            type: "text",
            label: "Mentor job role",
            filledBy: "mentor",
          },
          {
            key: "mentorContact",
            type: "text",
            label: "Mentor contact no.",
            filledBy: "mentor",
          },
          {
            key: "mentorSign",
            type: "sign_off",
            label:
              "Mentor declaration — I observed or reviewed this work and it reflects the task completed",
            signOffRole: "mentor",
            filledBy: "mentor",
            required: true,
          },
        ],
      },
      {
        id: "assessor",
        title: "Assessor / IQA use only",
        fields: [
          {
            key: "assessorDecision",
            type: "radio_group",
            label: "Assessor decision",
            options: ["Accepted", "Query", "Resubmission required"],
            filledBy: "assessor",
            required: true,
          },
          {
            key: "assessorFeedback",
            type: "textarea",
            label: "Assessor / IQA feedback and action points",
            filledBy: "assessor",
          },
        ],
      },
      difficultySection,
    ],
  };
}

export type PracticalInput = {
  blockId: number;
  taskNumber: 3 | 4;
  evidenceRef: string;
  title: string;
  scenario: string;
  objectives: string[];
  estimatedMinutes: number;
  sourcePdf: string;
  weeks: string;
  dutiesCovered: string;
  ksbsCovered: string;
  materials: string[];
  instructions: string[];
  measurementFields: TaskFieldDef[];
  knowledgeQuestions: string[];
};

export function makePractical(input: PracticalInput): PracticalTaskDef {
  const knowledgeFields: TaskFieldDef[] = input.knowledgeQuestions.map(
    (label, i) => ({
      key: `kq${i + 1}`,
      type: "knowledge_question" as const,
      label: `${i + 1}. ${label}`,
      required: true,
    }),
  );

  return {
    id: `block-${input.blockId}-task-${input.taskNumber}`,
    evidenceRef: input.evidenceRef,
    blockId: input.blockId,
    taskNumber: input.taskNumber,
    kind: "practical",
    title: input.title,
    scenario: input.scenario,
    objectives: input.objectives,
    estimatedMinutes: input.estimatedMinutes,
    sourcePdf: input.sourcePdf,
    weeks: input.weeks,
    dutiesCovered: input.dutiesCovered,
    ksbsCovered: input.ksbsCovered,
    assessmentType: "Practical / knowledge / documentation",
    materials: input.materials,
    instructions: input.instructions,
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
          ...input.measurementFields,
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
          ...knowledgeFields,
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
  };
}

/** Full Task 5 reflection from the shared PDF template — one instance per block. */
export function makeBlockReflection(blockId: number): PracticalTaskDef {
  const { name: blockName, weeks } = blockContext(blockId);

  return {
    id: `block-${blockId}-task-5`,
    evidenceRef: "Task_5_Block_Reflection_and_Review",
    blockId,
    taskNumber: 5,
    kind: "reflection",
    title: `Block ${blockId} Reflection and Review`,
    scenario:
      "Complete this at the end of the block. It provides evidence of the learning and progress you have made, helps you identify what you can now do that you could not do before, and records feedback from your workplace mentor and trainer. Your answers should refer to real examples wherever possible.",
    objectives: [
      "Review the training, practical activities and workplace experience completed during the block.",
      "Compare your confidence and independence before the block with where you are now.",
      "Give clear examples or evidence of new knowledge, skills or behaviours.",
      "Discuss your reflection with your workplace mentor and trainer, then agree the next steps.",
    ],
    estimatedMinutes: 45,
    sourcePdf: "Task_5_Block_Reflection_and_Review_v1.0.pdf",
    weeks,
    assessmentType: "Block reflection and review",
    materials: [
      "Learning activities and notes from this block",
      "Completed practical tasks and assessments",
      "Job cards / workplace evidence",
      "Trainer observations and mentor feedback",
    ],
    instructions: [
      "Review the training, practical activities and workplace experience completed during the block.",
      "Compare your confidence and independence before the block with where you are now.",
      "Give clear examples or evidence of new knowledge, skills or behaviours.",
      "Discuss your reflection with your workplace mentor and trainer, then agree the next steps.",
    ],
    reviewStatus: "curriculum_review",
    sections: [
      {
        id: "details",
        title: "Block and apprentice details",
        fields: [
          {
            key: "blockContext",
            type: "description",
            label: `Block ${blockId} · ${blockName}${weeks ? ` · ${weeks}` : ""}`,
          },
          {
            key: "topicsCovered",
            type: "textarea",
            label: "Main knowledge and topics covered",
            hint: "List the main subjects, theory or technical knowledge developed.",
            required: true,
          },
          {
            key: "practicalsCompleted",
            type: "textarea",
            label: "Practical tasks and activities completed",
            hint: "Include workshop activities, assessments, projects or simulated tasks.",
            required: true,
          },
          {
            key: "workplaceExperience",
            type: "textarea",
            label: "Relevant workplace experience",
            hint: "Include jobs, duties or situations where the learning was applied at work.",
            required: true,
          },
          {
            key: "evidenceUsed",
            type: "checkbox_group",
            label: "Evidence used for this review",
            options: [
              "Learning activities / notes",
              "Practical tasks",
              "Job cards / workplace evidence",
              "Trainer observations",
              "Mentor feedback",
              "Other evidence",
            ],
            required: true,
          },
        ],
      },
      {
        id: "selfAssessment",
        title: "Apprentice self-assessment — before and now",
        fields: [
          {
            key: "ratingGuide",
            type: "description",
            label:
              "Rating guide: 1 = No previous knowledge or experience · 2 = Need full guidance · 3 = Can complete with some support · 4 = Can complete independently and consistently · 5 = Confident and able to explain or demonstrate to others",
          },
          {
            key: "selfRatings",
            type: "rating_rows",
            label:
              "Choose up to six important areas from the block. Rate yourself before and now, then give an example.",
            rowCount: 6,
            required: true,
          },
          {
            key: "progress1",
            type: "textarea",
            label:
              "1. At the start of this block I could not / was not confident to… Now I can…",
            required: true,
          },
          {
            key: "progress2",
            type: "textarea",
            label:
              "2. At the start of this block I could not / was not confident to… Now I can…",
            required: true,
          },
          {
            key: "progress3",
            type: "textarea",
            label:
              "3. At the start of this block I could not / was not confident to… Now I can…",
            required: true,
          },
        ],
      },
      {
        id: "reflection",
        title: "Apprentice reflection on learning",
        fields: [
          {
            key: "mostUseful",
            type: "textarea",
            label: "What was the most useful learning in this block, and why?",
            required: true,
          },
          {
            key: "mostChallenging",
            type: "textarea",
            label:
              "What did you find most challenging, and how did you overcome or manage it?",
            required: true,
          },
          {
            key: "workplaceApply",
            type: "textarea",
            label:
              "How have you applied, or how will you apply, this learning in the workplace?",
            required: true,
          },
          {
            key: "workImproved",
            type: "textarea",
            label:
              "How has your work improved in confidence, independence, quality, accuracy or safety?",
            required: true,
          },
          {
            key: "stillNeed",
            type: "textarea",
            label: "What do you still need to practise or develop further?",
            required: true,
          },
          {
            key: "supportNeeded",
            type: "textarea",
            label:
              "What support, equipment, practice or experience would help you next?",
            required: true,
          },
          {
            key: "overallView",
            type: "radio_group",
            label: "My overall view of my progress",
            options: [
              "Clear progress demonstrated",
              "Some progress demonstrated",
              "Limited progress / more support needed",
            ],
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
            label:
              "What can the apprentice do now that they could not do, or could not do as confidently, before this block?",
            filledBy: "mentor",
            required: true,
          },
          {
            key: "mentorEvidence",
            type: "textarea",
            label: "What evidence or workplace examples support this view?",
            filledBy: "mentor",
            required: true,
          },
          {
            key: "mentorChanges",
            type: "textarea",
            label:
              "What changes have you seen in confidence, independence, quality, accuracy, behaviour or safe working?",
            filledBy: "mentor",
            required: true,
          },
          {
            key: "mentorNext",
            type: "textarea",
            label:
              "What should the apprentice practise next, and what support or opportunities will you provide?",
            filledBy: "mentor",
            required: true,
          },
          {
            key: "mentorView",
            type: "radio_group",
            label: "Mentor view of progress",
            options: [
              "Clear progress",
              "Some progress",
              "Limited progress / support needed",
            ],
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
            label: "Trainer feedback on the apprentice's learning and progress",
            filledBy: "trainer",
            required: true,
          },
          {
            key: "trainerEvidence",
            type: "textarea",
            label: "Evidence reviewed and examples that verify progress",
            filledBy: "trainer",
            required: true,
          },
          {
            key: "trainerDecision",
            type: "radio_group",
            label: "Trainer decision",
            options: [
              "Progress verified",
              "More evidence required",
              "Additional support required",
            ],
            filledBy: "trainer",
            required: true,
          },
          {
            key: "agreedActions",
            type: "action_rows",
            label: "Agreed actions for the next block",
            hint: "Agree practical, measurable actions that build on the progress recorded in this review.",
            rowCount: 3,
            filledBy: "trainer",
          },
          {
            key: "nextReviewDate",
            type: "date",
            label: "Next review date",
            filledBy: "trainer",
          },
          {
            key: "reflectionOutcome",
            type: "radio_group",
            label: "Block reflection outcome",
            options: ["Complete", "Follow-up needed"],
            filledBy: "trainer",
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
  };
}
