import { addDays } from "./plan-due";

export type NoteUntilPreset = "today" | "week" | "fortnight" | "month";

export function noteUntilPresets(today: string): Record<NoteUntilPreset, string> {
  const [year, month, day] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const friday = addDays(today, (5 - weekday + 7) % 7);
  return {
    today,
    week: friday,
    fortnight: addDays(today, 14),
    month: addDays(today, 28),
  };
}

export const NOTE_UNTIL_PRESETS: { id: NoteUntilPreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "fortnight", label: "2 weeks" },
  { id: "month", label: "1 month" },
];

export function noteUntilLabel(until: string, today: string): { overdue: boolean; label: string } {
  if (!until) return { overdue: true, label: "Add an end date so this is not forgotten" };
  if (until < today) return { overdue: true, label: `Check this — ended ${formatNoteDate(until)}` };
  if (until === today) return { overdue: false, label: "Until today" };
  return { overdue: false, label: `Until ${formatNoteDate(until)}` };
}

export function formatNoteDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
