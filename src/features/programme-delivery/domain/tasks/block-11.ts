import type { PracticalTaskDef } from "../task-schema";
import {
  makeBlockReflection,
  makeJobCard,
  makeKnowledgeTest,
  makePractical,
} from "./shared";

/**
 * Pre-EPA consolidation — Block 11 (lighter than Block 10 mock/capstone).
 * Gateways are separate milestones (see gateways.ts), not this block.
 */
export const BLOCK_11_TASKS: PracticalTaskDef[] = [
  makeKnowledgeTest(11),
  makeJobCard(11),
  makePractical({
    blockId: 11,
    taskNumber: 3,
    evidenceRef: "Block_11_Task_3_Portfolio_Consolidation_Check",
    title: "Portfolio Consolidation Check",
    scenario:
      "Before EPA, consolidate your portfolio evidence with the assessor. Confirm that knowledge, skills and behaviours are evidenced, identify remaining gaps, and agree actions so you are ready for End-Point Assessment.",
    objectives: [
      "Review portfolio evidence against programme requirements.",
      "Identify any gaps in knowledge, skills or behaviours evidence.",
      "Confirm mandatory qualifications and functional skills status.",
      "Agree actions and owners before EPA.",
      "Record readiness honestly with assessor support.",
    ],
    estimatedMinutes: 60,
    sourcePdf: "Block_11_Task_3_Portfolio_Consolidation_Check_v1.0.pdf",
    weeks: "Pre-EPA consolidation",
    dutiesCovered: "All duties — consolidation",
    ksbsCovered: "All KSBs — gap check",
    materials: [
      "Portfolio / evidence log",
      "Mandatory qualification records",
      "Functional skills status",
      "Apprentice Assessment Record",
    ],
    instructions: [
      "Bring your portfolio evidence to the consolidation review.",
      "Work through the checklist with the assessor.",
      "Record gaps and agreed actions with owners and dates.",
      "Confirm what still blocks EPA readiness.",
      "Update your evidence plan before the next review.",
    ],
    measurementFields: [
      { key: "portfolioCompletePct", type: "text", label: "Portfolio complete %" },
      {
        key: "gapsIdentified",
        type: "textarea",
        label: "Gaps identified",
        required: true,
      },
      {
        key: "mqStatus",
        type: "text",
        label: "Mandatory qualifications status",
      },
      {
        key: "fsStatus",
        type: "text",
        label: "Functional skills status",
      },
      {
        key: "actionsAgreed",
        type: "textarea",
        label: "Actions agreed",
        required: true,
      },
      {
        key: "readyForEpa",
        type: "radio_group",
        label: "Ready for EPA",
        options: ["Yes", "Not yet", "Needs further evidence"],
        required: true,
      },
    ],
    knowledgeQuestions: [
      "What evidence still needs to be uploaded or improved?",
      "Which KSBs feel least well evidenced and why?",
      "What must be complete before EPA?",
      "How will you close the gaps with your employer?",
      "What support do you need from your trainer?",
      "How will you know you are EPA-ready?",
      "What is your next priority action this week?",
    ],
  }),
  makePractical({
    blockId: 11,
    taskNumber: 4,
    evidenceRef: "Block_11_Task_4_Professional_Discussion_Prep",
    title: "Professional Discussion Preparation",
    scenario:
      "Prepare for an EPA-style professional discussion. Select examples from your portfolio, explain decisions you made on real jobs, and show how you work safely and professionally with customers and colleagues.",
    objectives: [
      "Select strong portfolio examples for discussion.",
      "Explain technical decisions using clear evidence.",
      "Show safe working and professional behaviours.",
      "Answer follow-up questions under mock discussion conditions.",
      "Identify improvements before EPA.",
    ],
    estimatedMinutes: 60,
    sourcePdf: "Block_11_Task_4_Professional_Discussion_Prep_v1.0.pdf",
    weeks: "Pre-EPA consolidation",
    dutiesCovered: "All duties — discussion prep",
    ksbsCovered: "All KSBs — discussion prep",
    materials: [
      "Selected portfolio examples",
      "Job cards and practical records",
      "Assessor question prompts",
      "Apprentice Assessment Record",
    ],
    instructions: [
      "Choose two or three strong examples from your portfolio.",
      "Prepare to explain diagnosis, repair, safety and customer communication.",
      "Complete a mock discussion with the assessor.",
      "Record feedback and actions.",
      "Update your preparation notes for EPA.",
    ],
    measurementFields: [
      {
        key: "examplesSelected",
        type: "textarea",
        label: "Examples selected",
        required: true,
      },
      {
        key: "discussionNotes",
        type: "textarea",
        label: "Discussion notes",
        required: true,
      },
      {
        key: "discussionAssessorFeedback",
        type: "textarea",
        label: "Assessor feedback",
      },
      {
        key: "improvements",
        type: "textarea",
        label: "Improvements before EPA",
        required: true,
      },
    ],
    knowledgeQuestions: [
      "Why did you choose these examples?",
      "How did you keep the customer informed?",
      "What safety controls mattered most on those jobs?",
      "How did you check the repair was complete?",
      "What would you do differently next time?",
      "How do these examples show independence?",
      "What question would you still find hard in EPA?",
    ],
  }),
  makeBlockReflection(11),
];
