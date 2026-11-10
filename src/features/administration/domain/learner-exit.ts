/**
 * Recording and reversing a learner exit.
 * record_learner_exit and reverse_learner_exit enforce the same rules in
 * the database. This module checks them before the call and explains the
 * errors the functions raise.
 */

import { isAssignedGtaId } from "./apprentice-record";
import { isIsoDate, type ReasonOption } from "./apprentice-programme";
import { formatTutorDate, normaliseGtaId } from "./apprentice-tutor";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const EXIT_TYPES = ["completed", "withdrawn"] as const;

export type ExitType = (typeof EXIT_TYPES)[number];

export const EXIT_PERMISSION_ERROR =
  "You do not have permission to change an exit. Administrator and Management can.";

export type ExitActionResult = { ok: true } | { ok: false; formError: string };

export type ValidatedLearnerExit = {
  gtaId: string;
  exitType: ExitType;
  exitDate: string;
  reasonId: string | null;
  notes: string | null;
};

export type LearnerExitRecord = {
  id: string;
  gtaId: string;
  exitType: string;
  exitDate: string;
  reason: string | null;
  isSafeguarding: boolean;
  notes: string | null;
  notesWithheld: boolean;
  recordedByName: string;
  recordedAt: string;
  reversedAt: string | null;
  reversedByName: string | null;
  reversalNote: string | null;
  reversalNoteWithheld: boolean;
};

export type LearnerExitPage = {
  exits: LearnerExitRecord[];
  reasons: ReasonOption[];
  courseStart: string | null;
  today: string;
  loadError: string | null;
};

export function isExitType(value: string): value is ExitType {
  return (EXIT_TYPES as readonly string[]).includes(value);
}

export function exitTypeLabel(exitType: string): string {
  if (exitType === "completed") return "Completed";
  if (exitType === "withdrawn") return "Withdrawn";
  return exitType.trim() || "Exit type unavailable";
}

export function exitReasonLabel(exit: { exitType: string; reason: string | null }): string {
  const reason = exit.reason?.trim() ?? "";
  if (reason) return reason;
  if (exit.exitType === "completed") return "No reason";
  return "Reason unavailable";
}

export function exitNotesLabel(exit: { notes: string | null; notesWithheld: boolean }): string {
  if (exit.notesWithheld) return "Notes withheld";
  return exit.notes?.trim() || "No notes";
}

export function reversalNoteLabel(exit: {
  reversalNote: string | null;
  reversalNoteWithheld: boolean;
}): string {
  if (exit.reversalNoteWithheld) return "Notes withheld";
  return exit.reversalNote?.trim() || "No note";
}

export function splitLearnerExits(exits: readonly LearnerExitRecord[]): {
  active: LearnerExitRecord[];
  reversed: LearnerExitRecord[];
} {
  return {
    active: exits.filter((exit) => exit.reversedAt === null),
    reversed: exits.filter((exit) => exit.reversedAt !== null),
  };
}

/** London wall time, for example "10 Nov 2026, 18:49". */
export function formatRecordedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const day = part("day");
  const month = part("month");
  const year = part("year");
  const hour = part("hour");
  const minute = part("minute");
  if (!day || !month || !year || !hour || !minute) return value;
  return `${day} ${month} ${year}, ${hour}:${minute}`;
}

export function validateLearnerExit(input: {
  gtaId: string;
  exitType: string;
  exitDate: string;
  reasonId: string;
  notes: string;
  today: string;
  courseStart: string | null;
}): { ok: true; value: ValidatedLearnerExit } | { ok: false; formError: string } {
  const gtaId = normaliseGtaId(input.gtaId);
  if (!isAssignedGtaId(gtaId)) {
    return { ok: false, formError: "This apprentice does not have a valid GTA ID." };
  }
  const exitType = input.exitType.trim();
  if (!isExitType(exitType)) {
    return { ok: false, formError: "Choose Completed or Withdrawn." };
  }
  const exitDate = input.exitDate.trim();
  if (!isIsoDate(exitDate)) {
    return { ok: false, formError: "Enter an exit date." };
  }
  if (!isIsoDate(input.today)) {
    return { ok: false, formError: "Today's date is unavailable. Refresh the page." };
  }
  if (exitDate > input.today) {
    return { ok: false, formError: "The exit date cannot be in the future." };
  }
  const courseStart = input.courseStart?.trim() || null;
  if (courseStart && !isIsoDate(courseStart)) {
    return { ok: false, formError: "The course start date could not be read. Refresh the page." };
  }
  if (courseStart && exitDate < courseStart) {
    return {
      ok: false,
      formError: `The exit date cannot be before the course start date (${formatTutorDate(courseStart)}).`,
    };
  }

  const reasonId = input.reasonId.trim();
  if (exitType === "withdrawn" && !UUID_PATTERN.test(reasonId)) {
    return { ok: false, formError: "Choose a reason for the withdrawal." };
  }
  if (exitType === "completed" && reasonId) {
    return { ok: false, formError: "A completion does not take a reason." };
  }

  return {
    ok: true,
    value: {
      gtaId,
      exitType,
      exitDate,
      reasonId: exitType === "withdrawn" ? reasonId : null,
      notes: input.notes.trim() || null,
    },
  };
}

export function validateExitReversal(input: {
  exitId: string;
  note: string;
}): { ok: true; value: { exitId: string; note: string } } | { ok: false; formError: string } {
  const exitId = input.exitId.trim();
  if (!UUID_PATTERN.test(exitId)) {
    return { ok: false, formError: "That exit could not be found. Refresh the page." };
  }
  const note = input.note.trim();
  if (!note) {
    return { ok: false, formError: "Enter a note explaining the reversal." };
  }
  return { ok: true, value: { exitId, note } };
}

export function explainExitError(error: { code?: string; message?: string; details?: string }): string {
  const message = error.message?.trim() || error.details?.trim() || "The exit could not be saved.";
  if (
    error.code === "42501" ||
    /row-level security|permission denied|Administrator or Management role required|Staff role required/i.test(
      message,
    )
  ) {
    return EXIT_PERMISSION_ERROR;
  }
  if (/Exit date cannot be in the future/i.test(message)) {
    return "The exit date cannot be in the future.";
  }
  if (/reason is required for a withdrawal/i.test(message)) {
    return "Choose a reason for the withdrawal.";
  }
  if (/completion does not take a reason/i.test(message)) {
    return "A completion does not take a reason.";
  }
  if (/before the course start date/i.test(message)) {
    return "The exit date cannot be before the course start date.";
  }
  if (/already has an active exit/i.test(message)) {
    return "This apprentice already has an exit. Reverse it before recording another.";
  }
  if (/Apprentice .+ not found/i.test(message) || error.code === "P0002") {
    return "This apprentice could not be found. Refresh the page.";
  }
  if (/before the open break start date/i.test(message)) {
    return "The exit date cannot be before the open break start date.";
  }
  if (/before the current placement start date/i.test(message)) {
    return "The exit date cannot be before the current placement start date.";
  }
  if (/Reason not found/i.test(message) || /is not active/i.test(message)) {
    return "Choose a reason from the list.";
  }
  if (/cannot be used for withdrawals/i.test(message)) {
    return "Choose a withdrawal reason.";
  }
  if (/reversal note is required/i.test(message)) {
    return "Enter a note explaining the reversal.";
  }
  if (/already been reversed/i.test(message)) {
    return "This exit has already been reversed. Refresh the page.";
  }
  if (/Learner exit not found/i.test(message)) {
    return "That exit could not be found. Refresh the page.";
  }
  if (/exit_type must be completed or withdrawn/i.test(message)) {
    return "Choose Completed or Withdrawn.";
  }
  if (/Exit date is required/i.test(message)) {
    return "Enter an exit date.";
  }
  return message;
}
