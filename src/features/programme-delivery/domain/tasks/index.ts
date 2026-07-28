import type { LessonPlanDef, PracticalTaskDef } from "../task-schema";
import { BLOCK_01_TASKS } from "./block-01";
import { BLOCK_02_TASKS } from "./block-02";
import { BLOCK_03_TASKS } from "./block-03";
import { BLOCK_04_TASKS } from "./block-04";
import { BLOCK_05_TASKS } from "./block-05";
import { BLOCK_06_TASKS } from "./block-06";
import { BLOCK_07_TASKS } from "./block-07";
import { BLOCK_08_TASKS } from "./block-08";
import { BLOCK_09_TASKS } from "./block-09";
import { BLOCK_10_TASKS } from "./block-10";
import { BLOCK_11_TASKS } from "./block-11";
import { BLOCK_12_TASKS } from "./block-12";

/**
 * All Autocare tasks — knowledge test, job card, practicals and reflection.
 * Blocks 1–12 × 5 tasks = 60 (matches live Autocare ops spine).
 */
export const AUTOCARE_PRACTICAL_TASKS: PracticalTaskDef[] = [
  ...BLOCK_01_TASKS,
  ...BLOCK_02_TASKS,
  ...BLOCK_03_TASKS,
  ...BLOCK_04_TASKS,
  ...BLOCK_05_TASKS,
  ...BLOCK_06_TASKS,
  ...BLOCK_07_TASKS,
  ...BLOCK_08_TASKS,
  ...BLOCK_09_TASKS,
  ...BLOCK_10_TASKS,
  ...BLOCK_11_TASKS,
  ...BLOCK_12_TASKS,
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
  ...Array.from({ length: 103 }, (_, i) => {
    const week = 11 + i;
    const blockId =
      week <= 20
        ? 2
        : week <= 30
          ? 3
          : week <= 40
            ? 4
            : week <= 50
              ? 5
              : week <= 60
                ? 6
                : week <= 70
                  ? 7
                  : week <= 80
                    ? 8
                    : week <= 94
                      ? 9
                      : 10;
    return {
      id: `ac-week-${week}`,
      week,
      blockId,
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

export {
  makeBlockReflection,
  makeJobCard,
  makeKnowledgeTest,
  makePractical,
} from "./shared";
