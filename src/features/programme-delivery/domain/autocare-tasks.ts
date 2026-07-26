/**
 * Autocare practical tasks — re-exports the split block modules.
 * Prefer importing from `./tasks` for new code; this path stays for existing screens.
 */
export {
  AUTOCARE_LESSON_PLANS,
  AUTOCARE_PRACTICAL_TASKS,
  lessonPlansForBlock,
  makeBlockReflection,
  makePractical,
  taskById,
  tasksForBlock,
} from "./tasks";
