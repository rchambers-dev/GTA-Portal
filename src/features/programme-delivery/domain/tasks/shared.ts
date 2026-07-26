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
  const block = AUTOCARE_BLOCKS.find((b) => b.id === blockId);
  const blockName = block?.name ?? `Block ${blockId}`;
  const weeks =
    block?.weekStart != null && block?.weekEnd != null
      ? `Weeks ${block.weekStart}–${block.weekEnd}`
      : undefined;

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
