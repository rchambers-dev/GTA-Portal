/** Recruitment rules shared by the database functions and the UI. */

export type Responsiveness = "responsive" | "unresponsive";

export function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}

/** Always counted from the original first-contact date. */
export function reviewDueOn(firstContact: string, responsiveness: Responsiveness): string {
  return addMonths(firstContact, responsiveness === "responsive" ? 12 : 3);
}

export function interviewEligible(mathsPassed: boolean, englishPassed: boolean): boolean {
  return mathsPassed && englishPassed;
}

export function stage2Unlocked(employerConfirmed: boolean, approved: boolean): boolean {
  return employerConfirmed && approved;
}

export type Failure = { actualOn: string };

export function nextInterviewAttempt(
  failures: Failure[],
  sessionOn: string,
  finalAlreadyUsed: boolean,
): { ok: true; attempt: number; final: boolean } | { ok: false; reason: string } {
  if (finalAlreadyUsed) return { ok: false, reason: "The final attempt has already been used." };
  const ordered = [...failures].sort((a, b) => a.actualOn.localeCompare(b.actualOn));
  if (ordered.length >= 3) {
    const third = ordered[2]?.actualOn;
    if (!third || sessionOn < addMonths(third, 6)) {
      return { ok: false, reason: "A final attempt is only available 6 months after the third failure." };
    }
    return { ok: true, attempt: 4, final: true };
  }
  return { ok: true, attempt: ordered.length + 1, final: false };
}

export function seatTaken(attendance: string | null, freesPlace: boolean): boolean {
  if ((attendance === "cancelled" || attendance === "rescheduled") && freesPlace) return false;
  return true;
}

export function canAllocate(input: {
  employerConfirmed: boolean;
  stage2Approved: boolean;
  taken: number;
  places: number;
  status: string;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.employerConfirmed || !input.stage2Approved) {
    return { ok: false, reason: "Stage 2 stays locked until the employer is confirmed and approved." };
  }
  if (input.status !== "potential" && input.status !== "open") {
    return { ok: false, reason: "This vacancy is not open." };
  }
  if (input.taken >= input.places) return { ok: false, reason: "That would over-allocate this vacancy." };
  return { ok: true };
}

export function canCountStart(alreadyStarted: boolean): boolean {
  return !alreadyStarted;
}
