/** Skills England typical on-programme length excludes EPA; buffer for assessment window. */
export const EPA_DURATION_MONTHS = 3;

/** Add calendar months to YYYY-MM-DD, clamping the day to the target month length. */
export function addMonthsToIsoDate(isoDate: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match || !Number.isFinite(months)) return "";
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const totalMonths = monthIndex + months;
  const nextYear = year + Math.floor(totalMonths / 12);
  const nextMonth = ((totalMonths % 12) + 12) % 12;
  const lastDay = new Date(nextYear, nextMonth + 1, 0).getDate();
  const nextDay = Math.min(day, lastDay);
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth + 1).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
}

export function plannedDatesFromStart(
  startDate: string,
  durationMonths: number | undefined,
): { practicalEndDate: string; apprenticeshipEndDate: string } {
  if (!startDate || !durationMonths || durationMonths < 1) {
    return { practicalEndDate: "", apprenticeshipEndDate: "" };
  }
  return {
    practicalEndDate: addMonthsToIsoDate(startDate, durationMonths),
    apprenticeshipEndDate: addMonthsToIsoDate(
      startDate,
      durationMonths + EPA_DURATION_MONTHS,
    ),
  };
}
