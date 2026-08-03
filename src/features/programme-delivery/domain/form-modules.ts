/**
 * Drag-and-drop form modules for Course Builder task authoring.
 * Built from the existing TaskBlockType field model apprentices already complete.
 */

import type { TaskBlockType, TaskFieldDef } from "./task-schema";

export type FormModule = TaskFieldDef & {
  /** Stable id for DnD / list keys. */
  id: string;
  /** When true, module cannot be moved, edited, or removed until unlocked. */
  locked?: boolean;
};

export type FormModulePaletteItem = {
  type: TaskBlockType;
  label: string;
  description: string;
  defaults: Omit<TaskFieldDef, "key" | "type">;
};

export const FORM_MODULE_PALETTE: FormModulePaletteItem[] = [
  {
    type: "heading",
    label: "Section heading",
    description: "Breaks the form into clear sections",
    defaults: { label: "e.g. Section title" },
  },
  {
    type: "description",
    label: "Guidance text",
    description: "Instructions the learner reads (not answered)",
    defaults: {
      label: "e.g. Read this carefully before you start.",
    },
  },
  {
    type: "text",
    label: "Short answer",
    description: "One-line response for any short detail",
    defaults: {
      label: "e.g. Your answer",
      required: true,
    },
  },
  {
    type: "textarea",
    label: "Written response",
    description: "Longer notes or explanation from the learner",
    defaults: {
      label: "e.g. Write your response here",
      required: true,
    },
  },
  {
    type: "number",
    label: "Number entry",
    description: "Any numeric answer — count, score, size, time, cost, etc.",
    defaults: {
      label: "e.g. Enter the number",
      required: false,
    },
  },
  {
    type: "date",
    label: "Date",
    description: "Any date the learner needs to record",
    defaults: { label: "e.g. Date completed", required: true },
  },
  {
    type: "checkbox_group",
    label: "Checklist",
    description: "Learner ticks all that apply",
    defaults: {
      label: "e.g. Select all that apply",
      options: [
        "e.g. Option one",
        "e.g. Option two",
        "e.g. Option three",
      ],
      required: true,
    },
  },
  {
    type: "radio_group",
    label: "Single choice",
    description: "Learner picks one option only",
    defaults: {
      label: "e.g. Choose one option",
      options: [
        "e.g. Option A",
        "e.g. Option B",
        "e.g. Option C",
      ],
      required: true,
    },
  },
  {
    type: "knowledge_question",
    label: "Knowledge check",
    description: "Tests understanding in their own words",
    defaults: {
      label: "e.g. Explain your understanding in your own words",
      required: true,
    },
  },
  {
    type: "rating_rows",
    label: "Confidence rating",
    description: "Before / after ratings with evidence",
    defaults: {
      label: "e.g. Rate your confidence before and after",
      rowCount: 3,
    },
  },
  {
    type: "action_rows",
    label: "Action plan",
    description: "Follow-up actions, support needed, and owner",
    defaults: {
      label: "e.g. List next steps, who owns them, and by when",
      rowCount: 3,
    },
  },
  {
    type: "parts_rows",
    label: "Parts & materials",
    description: "List of items, quantities, or materials used",
    defaults: {
      label: "e.g. List items used (qty, description, reference)",
      rowCount: 4,
    },
  },
  {
    type: "sign_off",
    label: "Sign-off",
    description: "Confirmation by learner, mentor, or trainer",
    defaults: {
      label: "e.g. I confirm this is my own work and the record is accurate",
      signOffRole: "apprentice",
      required: true,
    },
  },
  {
    type: "difficulty_feedback",
    label: "Task difficulty",
    description:
      "End-of-task rating of how hard the learning felt, with a Why? note",
    defaults: {
      label: "How challenging was this task for you?",
      options: ["Too easy", "About right", "Challenging", "Too hard"],
      required: true,
    },
  },
];

/** Staff confirmation that the learner form is finished and ready to use. */
export type AuthoredTaskFormStatus = "pending" | "ready";

export type AuthoredTaskForm = {
  title: string;
  scenario: string;
  modules: FormModule[];
  /** Defaults to pending until staff click Mark form complete. */
  status?: AuthoredTaskFormStatus;
};

export function authoredFormIsReady(form: AuthoredTaskForm | null | undefined): boolean {
  return form?.status === "ready";
}

export function newModuleId(type: TaskBlockType): string {
  return `mod-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createModuleFromPalette(
  item: FormModulePaletteItem,
): FormModule {
  const keyBase = item.type.replace(/_/g, "");
  return {
    id: newModuleId(item.type),
    key: `${keyBase}_${Math.random().toString(36).slice(2, 8)}`,
    type: item.type,
    ...item.defaults,
  };
}

export function createDifficultyFeedbackModule(): FormModule {
  const item = FORM_MODULE_PALETTE.find((p) => p.type === "difficulty_feedback");
  if (!item) {
    throw new Error("Difficulty feedback palette item missing");
  }
  return createModuleFromPalette(item);
}

/**
 * Blocks that may appear only once on a learner form.
 * Remove to re-enable; they can be added again after removal.
 */
export const SINGLE_INSTANCE_MODULE_TYPES: ReadonlySet<TaskBlockType> = new Set([
  "difficulty_feedback",
  "rating_rows",
  "action_rows",
  "parts_rows",
  "sign_off",
]);

export function isSingleInstanceModuleType(type: TaskBlockType): boolean {
  return SINGLE_INSTANCE_MODULE_TYPES.has(type);
}

export function formHasModuleType(
  modules: FormModule[],
  type: TaskBlockType,
): boolean {
  return modules.some((m) => m.type === type);
}

export function canAddModuleType(
  modules: FormModule[],
  type: TaskBlockType,
): boolean {
  if (!isSingleInstanceModuleType(type)) return true;
  return !formHasModuleType(modules, type);
}

export function defaultAuthoredTaskForm(title: string): AuthoredTaskForm {
  return {
    title: title.trim(),
    scenario: "",
    status: "pending",
    /** Difficulty feedback is always seeded at the bottom; staff can remove/re-add. */
    modules: [createDifficultyFeedbackModule()],
  };
}

/**
 * Keep difficulty feedback last when appending, unless the new module is
 * difficulty feedback itself (re-add) or a drop index is explicit.
 * Single-instance types replace any existing copy instead of duplicating.
 */
export function insertModuleKeepingDifficultyLast(
  modules: FormModule[],
  module: FormModule,
  dropIndex?: number,
): FormModule[] {
  if (isSingleInstanceModuleType(module.type) && formHasModuleType(modules, module.type)) {
    // Already present — do not add a second copy.
    return modules;
  }

  if (module.type === "difficulty_feedback") {
    const without = modules.filter((m) => m.type !== "difficulty_feedback");
    if (typeof dropIndex === "number") {
      return insertModuleAt(without, module, Math.min(dropIndex, without.length));
    }
    return [...without, module];
  }

  const diffIdx = modules.findIndex((m) => m.type === "difficulty_feedback");
  if (diffIdx < 0) {
    return typeof dropIndex === "number"
      ? insertModuleAt(modules, module, dropIndex)
      : [...modules, module];
  }

  const at =
    typeof dropIndex === "number"
      ? Math.min(dropIndex, diffIdx)
      : diffIdx;
  return insertModuleAt(modules, module, at);
}

/** Staff-facing caption for the main configure field, by module role. */
export function moduleConfigFieldCaption(type: TaskBlockType): string {
  switch (type) {
    case "heading":
      return "Section heading text";
    case "description":
      return "Guidance the learner should read";
    case "text":
      return "Question for the short answer";
    case "textarea":
      return "What should they write about?";
    case "number":
      return "Label for this number field";
    case "date":
      return "Label for this date field";
    case "checkbox_group":
      return "Checklist question";
    case "radio_group":
      return "Single-choice question";
    case "knowledge_question":
      return "Knowledge check question";
    case "rating_rows":
      return "What should they rate?";
    case "action_rows":
      return "What is this action plan for?";
    case "parts_rows":
      return "Title for the parts list";
    case "sign_off":
      return "Declaration wording";
    case "difficulty_feedback":
      return "Difficulty question (shown at the end of the task)";
    default:
      return "Wording shown on the form";
  }
}

/** Placeholder hints shown while configuring a module. */
export function moduleLabelPlaceholder(type: TaskBlockType): string {
  switch (type) {
    case "heading":
      return "e.g. Section title";
    case "description":
      return "e.g. Read this before you start…";
    case "text":
      return "e.g. Your answer";
    case "textarea":
      return "e.g. Write your response here…";
    case "number":
      return "e.g. Hours completed, score, quantity, measurement…";
    case "date":
      return "e.g. Date completed";
    case "checkbox_group":
      return "e.g. Select all that apply";
    case "radio_group":
      return "e.g. Choose one option";
    case "knowledge_question":
      return "e.g. Explain your understanding…";
    case "rating_rows":
      return "e.g. Rate your confidence";
    case "action_rows":
      return "e.g. Agreed next steps";
    case "parts_rows":
      return "e.g. Items used";
    case "sign_off":
      return "e.g. I confirm this record is accurate";
    case "difficulty_feedback":
      return "e.g. How challenging was this task for you?";
    default:
      return "Wording shown on the form…";
  }
}

export function moduleOptionsCaption(type: TaskBlockType): string {
  switch (type) {
    case "checkbox_group":
      return "Choices (each bullet is one tick box)";
    case "radio_group":
      return "Choices (learner picks one)";
    case "difficulty_feedback":
      return "Difficulty ratings (learner picks one)";
    default:
      return "Choices (each bullet is one option)";
  }
}

export function moduleRequiredCaption(type: TaskBlockType): string {
  switch (type) {
    case "heading":
    case "description":
      return "Not answered by the learner";
    case "difficulty_feedback":
      return "Required — learner must rate difficulty before submit";
    case "sign_off":
      return "Required — must be signed before submit";
    case "number":
      return "Required — learner must enter a number";
    default:
      return "Required — learner must complete this";
  }
}

/** Convert authored modules into a single TaskSectionDef list for preview / fill. */
export function modulesToSections(modules: FormModule[]) {
  return [
    {
      id: "main",
      title: "Your task",
      fields: modules.map(({ id: _id, ...field }) => ({
        ...field,
        options: field.options
          ?.map((opt) => opt.trim())
          .filter(Boolean),
      })),
    },
  ];
}

export function moveModule(
  modules: FormModule[],
  fromIndex: number,
  toIndex: number,
): FormModule[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= modules.length ||
    toIndex > modules.length ||
    fromIndex === toIndex
  ) {
    return modules;
  }
  const moving = modules[fromIndex];
  if (moving?.locked) return modules;
  const next = [...modules];
  const [item] = next.splice(fromIndex, 1);
  const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
  next.splice(Math.max(0, insertAt), 0, item);
  return next;
}

/** Insert a new module at a canvas drop index (0 = top). */
export function insertModuleAt(
  modules: FormModule[],
  module: FormModule,
  index: number,
): FormModule[] {
  const next = [...modules];
  const at = Math.max(0, Math.min(index, next.length));
  next.splice(at, 0, module);
  return next;
}
