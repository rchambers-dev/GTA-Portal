/** A test apprentice is for trying the Portal. They stay out of lists, totals, and reports. */
export function excludeTestApprentices<T extends { is_test?: boolean | null }>(rows: T[]): T[] {
  return rows.filter((row) => row.is_test !== true);
}

export function isMissingTestColumn(message: string | undefined): boolean {
  return /is_test/i.test(message || "") && /does not exist|schema cache|column/i.test(message || "");
}
