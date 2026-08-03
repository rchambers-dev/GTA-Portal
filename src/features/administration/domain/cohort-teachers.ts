/** Separator used when storing multiple teachers in cohorts.tutor_name. */
export const COHORT_TEACHER_SEP = " | ";

/** Parse cohort teacher list from stored tutor_name (supports legacy single name). */
export function parseCohortTeachers(stored: string | null | undefined): string[] {
  const raw = (stored ?? "").trim();
  if (!raw) return [];
  return raw
    .split(/\s*\|\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Deduplicate and trim teacher names (same rules as format). */
export function normalizeTeacherNames(names: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return unique;
}

/** Encode teacher names for cohorts.tutor_name. */
export function formatCohortTeachers(names: string[]): string {
  return normalizeTeacherNames(names).join(COHORT_TEACHER_SEP);
}

/** Short label for list cards, e.g. "2 teachers" or a single name. */
export function cohortTeachersLabel(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.length} teachers`;
}
