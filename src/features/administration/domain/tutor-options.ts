import type { AdminPortalUser } from "./types";
import { parseCohortTeachers } from "./cohort-teachers";

/** Staff marked as Tutor — for cohort / apprentice tutor dropdowns. */
export function listTutorStaff(users: AdminPortalUser[]): AdminPortalUser[] {
  return users
    .filter((row) => row.role === "Tutor")
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function tutorSelectOptions(
  users: AdminPortalUser[],
  currentValue = "",
  /** When set, list these first (cohort teaching team), then remaining tutors. */
  preferredNames: string[] = [],
  opts?: { /** Only cohort teachers (+ current). Used when assigning caseload. */
    onlyPreferred?: boolean;
  },
): Array<{ value: string; label: string }> {
  const tutors = listTutorStaff(users);
  const preferred = preferredNames
    .map((name) => name.trim())
    .filter(Boolean);
  const preferredSet = new Set(preferred.map((n) => n.toLowerCase()));

  const preferredOptions = preferred.map((name) => ({
    value: name,
    label: preferred.length ? name : `${name} (on cohort)`,
  }));

  const otherOptions = opts?.onlyPreferred
    ? []
    : tutors
        .filter((row) => !preferredSet.has(row.displayName.toLowerCase()))
        .map((row) => ({
          value: row.displayName,
          label: row.displayName,
        }));

  const options = [
    {
      value: "",
      label: preferred.length
        ? "Choose teacher for this apprentice…"
        : "Choose tutor…",
    },
    ...preferredOptions,
    ...otherOptions,
  ];
  const current = currentValue.trim();
  if (current && !options.some((opt) => opt.value === current)) {
    options.splice(1, 0, { value: current, label: `${current} (current)` });
  }
  return options;
}

/** Prefer cohort.teacherNames; fall back to parsing legacy tutorName. */
export function cohortTeacherList(cohort: {
  teacherNames?: string[];
  tutorName?: string;
}): string[] {
  if (cohort.teacherNames && cohort.teacherNames.length > 0) {
    return cohort.teacherNames;
  }
  return parseCohortTeachers(cohort.tutorName);
}
