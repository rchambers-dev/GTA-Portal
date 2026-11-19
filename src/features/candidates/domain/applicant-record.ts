import { ukDate } from "./format";

export type ApplicantCheckLine = {
  code: string;
  label: string;
  done: boolean;
  actualOn: string | null;
  definitionId?: string | null;
  resultId?: string | null;
  result?: string | null;
};

export type ApplicantEventLine = {
  title: string;
  meta: string;
};

export function checkSummary(line: ApplicantCheckLine): string {
  if (line.result === "fail") return line.actualOn ? `Failed ${ukDate(line.actualOn)}` : "Failed";
  if (!line.done) return "Not yet";
  return line.actualOn ? ukDate(line.actualOn) : "Recorded";
}

export function contactEventTitle(detail: { type?: string | null; notes?: string | null } | null): string {
  const type = detail?.type?.trim() || "Contact";
  const notes = detail?.notes?.trim();
  return notes ? `${type}: ${notes}` : type;
}
