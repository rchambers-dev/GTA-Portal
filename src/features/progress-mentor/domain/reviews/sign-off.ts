import { MENTOR_EMPLOYERS, MENTOR_NAME, type MentorLearnerRow } from "../../data/mentor-caseload";
import type { SignOffParty, SignOffState } from "./types";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Build realistic three-party sign-off rows for a formal review.
 */
export function buildSignOffState(input: {
  learner: MentorLearnerRow;
  tutorName: string;
  reviewDate: string;
  stage:
    | "created"
    | "preparation_continuing"
    | "in_progress"
    | "paused"
    | "awaiting_apprentice"
    | "awaiting_employer"
    | "awaiting_provider"
    | "returned_for_amendment"
    | "awaiting_sign_off"
    | "completed";
  existing?: Partial<SignOffState>;
}): SignOffState {
  const employer =
    MENTOR_EMPLOYERS.find((e) => e.employerId === input.learner.employerId) ??
    null;
  const employerContact = employer?.mainContact ?? `${input.learner.employerName} contact`;
  const completed = input.stage === "completed";
  const awaiting = input.stage === "awaiting_sign_off";

  const apprenticeSigned =
    input.existing?.apprenticeSigned ??
    (completed ||
      (awaiting && input.existing?.apprenticeSigned !== false) ||
      input.stage === "awaiting_employer" ||
      input.stage === "awaiting_provider");
  const employerSigned =
    input.existing?.employerSigned ??
    (completed || input.stage === "awaiting_provider");
  const providerSigned =
    input.existing?.providerSigned ?? completed;

  // Prefer explicit existing flags when provided on the formal row
  const aSigned = input.existing?.apprenticeSigned ?? apprenticeSigned;
  const eSigned = input.existing?.employerSigned ?? employerSigned;
  const pSigned = input.existing?.providerSigned ?? providerSigned;

  const parties: SignOffParty[] = [
    {
      role: "apprentice",
      printedName: input.learner.displayName,
      organisation: null,
      signed: aSigned,
      signedAt: aSigned ? offset(input.reviewDate, completed ? 0 : -1) : null,
      signatureMark: aSigned ? initials(input.learner.displayName) : null,
    },
    {
      role: "employer",
      printedName: employerContact,
      organisation: input.learner.employerName,
      signed: eSigned,
      signedAt: eSigned ? offset(input.reviewDate, completed ? 1 : 0) : null,
      signatureMark: eSigned ? initials(employerContact) : null,
    },
    {
      role: "provider",
      printedName: input.tutorName || MENTOR_NAME,
      organisation: "GTA Doncaster",
      signed: pSigned,
      signedAt: pSigned ? offset(input.reviewDate, completed ? 2 : 1) : null,
      signatureMark: pSigned ? initials(input.tutorName || MENTOR_NAME) : null,
    },
  ];

  return {
    apprenticeSigned: aSigned,
    employerSigned: eSigned,
    providerSigned: pSigned,
    summaryIssued:
      input.existing?.summaryIssued ??
      (completed || (aSigned && eSigned && pSigned)),
    amendmentRequested: input.existing?.amendmentRequested ?? false,
    reminderSent: input.existing?.reminderSent ?? awaiting,
    parties,
    summaryIssuedAt:
      input.existing?.summaryIssuedAt ??
      (completed ? offset(input.reviewDate, 2) : null),
  };
}

function offset(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
