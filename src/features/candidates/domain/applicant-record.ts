import { ukDate } from "./format";

export type ApplicantCheckLine = {
  code: string;
  label: string;
  done: boolean;
  actualOn: string | null;
};

export type ApplicantEventLine = {
  title: string;
  meta: string;
};

export function checkSummary(line: ApplicantCheckLine): string {
  if (!line.done) return "Not yet";
  return line.actualOn ? ukDate(line.actualOn) : "Recorded";
}

export function contactEventTitle(detail: { type?: string | null; notes?: string | null } | null): string {
  const type = detail?.type?.trim() || "Contact";
  const notes = detail?.notes?.trim();
  return notes ? `${type}: ${notes}` : type;
}
