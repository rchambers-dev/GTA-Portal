/**
 * Shape of public.apprentices after the 9 Nov 2026 replacement.
 * The database assigns gta_id. This page never sends one.
 */

import { PERMISSIONS } from "@/lib/permissions/capabilities";

export const APPRENTICE_STATUSES = [
  "in_learning",
  "break_in_learning",
  "withdrawn",
  "completed",
  "overdue",
] as const;

export type ApprenticeStatus = (typeof APPRENTICE_STATUSES)[number];

export const APPRENTICE_STATUS_LABELS: Record<ApprenticeStatus, string> = {
  in_learning: "In learning",
  break_in_learning: "Break in learning",
  withdrawn: "Withdrawn",
  completed: "Completed",
  overdue: "Overdue",
};

export const DEFAULT_APPRENTICE_STATUS: ApprenticeStatus = "in_learning";

/** Columns this page reads and writes. gta_id is returned, never written. */
export const APPRENTICE_COLUMNS =
  "gta_id, first_name, middle_names, last_name, email, programme_id, status, created_at, updated_at";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GTA_ID_PATTERN = /^GTA-[0-9]{6}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ApprenticeProgrammeOption = {
  id: string;
  name: string;
  standardCode: string;
};

export type NewApprenticeInput = {
  firstName: string;
  middleNames: string;
  lastName: string;
  email?: string;
  programmeId: string;
  status: string;
};

export type ValidatedApprentice = {
  firstName: string;
  middleNames: string | null;
  lastName: string;
  email: string | null;
  programmeId: string | null;
  status: ApprenticeStatus;
};

/** Insert body for public.apprentices. gta_id is omitted so the column default runs. */
export type ApprenticeInsert = {
  first_name: string;
  middle_names: string | null;
  last_name: string;
  email: string | null;
  programme_id: string | null;
  status: ApprenticeStatus;
};

export type SavedApprentice = {
  gtaId: string;
  firstName: string;
  middleNames: string | null;
  lastName: string;
  email: string | null;
  programmeId: string | null;
  status: ApprenticeStatus;
  createdAt: string;
  updatedAt: string;
};

export type ApprenticeListItem = {
  gtaId: string;
  firstName: string;
  middleNames: string | null;
  lastName: string;
  programmeId: string | null;
  programmeLabel: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ApprenticeField = keyof ApprenticeFieldErrors;

export type ApprenticeFieldErrors = Partial<
  Record<"firstName" | "middleNames" | "lastName" | "email" | "programmeId" | "status", string>
>;

export type AddApprenticeResult =
  | { ok: true; apprentice: SavedApprentice }
  | { ok: false; fieldErrors: ApprenticeFieldErrors; formError: string | null };

export type ApprenticeRow = {
  gta_id: string;
  first_name: string;
  middle_names: string | null;
  last_name: string;
  email: string | null;
  programme_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

/** Blank becomes null. A value is trimmed and stored in lower case. */
export function normaliseApprenticeEmail(value: string | null | undefined): string | null {
  const email = (value ?? "").trim().toLowerCase();
  return email || null;
}

export function validateApprenticeEmail(
  value: string | null | undefined,
): { ok: true; email: string | null } | { ok: false; error: string } {
  const email = normaliseApprenticeEmail(value);
  if (email && !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  return { ok: true, email };
}

type PortalActor = {
  account: { baseRole: string };
  permissions: readonly string[];
};

export function isApprenticeStatus(value: string): value is ApprenticeStatus {
  return (APPRENTICE_STATUSES as readonly string[]).includes(value);
}

export function apprenticeStatusLabel(status: string): string {
  if (isApprenticeStatus(status)) return APPRENTICE_STATUS_LABELS[status];
  return status;
}

/**
 * Programme name plus its Skills England standard code.
 * "Autocare Level 2" and ST0499 become "Autocare L2 (ST0499)".
 */
export function formatProgrammeChoice(name: string, standardCode: string): string {
  const compactName = name.trim().replace(/\bLevel\s+(\d+)\b/gi, "L$1");
  const code = standardCode.trim();
  if (!compactName) return code;
  if (!code) return compactName;
  return `${compactName} (${code})`;
}

export function formatApprenticeName(person: {
  firstName: string;
  middleNames?: string | null;
  lastName: string;
}): string {
  return [person.firstName, person.middleNames, person.lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

/** Search covers the GTA ID, name, programme label, and status. */
export function apprenticeMatchesQuery(row: ApprenticeListItem, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const haystack = [
    row.gtaId,
    formatApprenticeName(row),
    row.programmeLabel,
    row.status,
    apprenticeStatusLabel(row.status),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

/**
 * Administrator and Management may add. Tutors, and anyone else, may not.
 * The nav uses the same records permission; RLS checks base_role.
 */
export function canAddApprentice(session: PortalActor | null): boolean {
  if (!session) return false;
  const role = session.account.baseRole.trim();
  const roleCanWrite = role === "Administrator" || role === "Management";
  return roleCanWrite && session.permissions.includes(PERMISSIONS.ADMIN_RECORDS_MANAGE);
}

export function validateNewApprentice(
  input: NewApprenticeInput,
): { ok: true; value: ValidatedApprentice } | { ok: false; fieldErrors: ApprenticeFieldErrors } {
  const fieldErrors: ApprenticeFieldErrors = {};
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const middleNames = input.middleNames.trim();
  const email = validateApprenticeEmail(input.email);
  const programmeId = input.programmeId.trim();
  const status = input.status.trim();

  if (!firstName) fieldErrors.firstName = "Enter a first name.";
  if (!lastName) fieldErrors.lastName = "Enter a last name.";
  if (!email.ok) fieldErrors.email = email.error;
  if (programmeId && !UUID_PATTERN.test(programmeId)) {
    fieldErrors.programmeId = "Choose a programme from the list.";
  }
  if (!isApprenticeStatus(status)) {
    fieldErrors.status = "Choose a status.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      firstName,
      middleNames: middleNames || null,
      lastName,
      email: email.ok ? email.email : null,
      programmeId: programmeId || null,
      status: status as ApprenticeStatus,
    },
  };
}

export function toApprenticeInsert(value: ValidatedApprentice): ApprenticeInsert {
  return {
    first_name: value.firstName,
    middle_names: value.middleNames,
    last_name: value.lastName,
    email: value.email,
    programme_id: value.programmeId,
    status: value.status,
  };
}

export function isAssignedGtaId(value: string): boolean {
  return GTA_ID_PATTERN.test(value);
}

export function explainApprenticeWriteError(error: {
  code?: string;
  message?: string;
}): { fieldErrors: ApprenticeFieldErrors; formError: string | null } {
  const message = error.message?.trim() || "The apprentice could not be saved.";
  if (message.includes("apprentices_first_name_not_blank")) {
    return { fieldErrors: { firstName: "Enter a first name." }, formError: null };
  }
  if (message.includes("apprentices_last_name_not_blank")) {
    return { fieldErrors: { lastName: "Enter a last name." }, formError: null };
  }
  if (message.includes("apprentices_status_check")) {
    return { fieldErrors: { status: "Choose a status." }, formError: null };
  }
  if (message.includes("apprentices_email_format")) {
    return { fieldErrors: { email: "Enter a valid email address." }, formError: null };
  }
  if (message.includes("apprentices_email_lower_key") || (error.code === "23505" && /email/i.test(message))) {
    return {
      fieldErrors: { email: "That email address is already used by another apprentice." },
      formError: null,
    };
  }
  if (message.includes("apprentices_programme_id_fkey") || error.code === "23503") {
    return {
      fieldErrors: { programmeId: "That programme is no longer available. Choose another." },
      formError: null,
    };
  }
  if (message.includes("apprentices_gta_id_format")) {
    return {
      fieldErrors: {},
      formError:
        "The database rejected the GTA ID. Leave the ID blank so the database can assign one.",
    };
  }
  if (
    error.code === "42501" ||
    /row-level security|permission denied/i.test(message)
  ) {
    return {
      fieldErrors: {},
      formError:
        "You do not have permission to add an apprentice. Administrator and Management can add apprentices.",
    };
  }
  return { fieldErrors: {}, formError: message };
}

export function mapApprenticeRow(
  row: ApprenticeRow,
  programmes: readonly ApprenticeProgrammeOption[] = [],
): ApprenticeListItem {
  const programme = row.programme_id
    ? programmes.find((item) => item.id === row.programme_id)
    : undefined;
  return {
    gtaId: row.gta_id,
    firstName: row.first_name,
    middleNames: row.middle_names,
    lastName: row.last_name,
    programmeId: row.programme_id,
    programmeLabel: programme
      ? formatProgrammeChoice(programme.name, programme.standardCode)
      : row.programme_id
        ? "Programme unavailable"
        : null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function savedApprenticeToListItem(
  saved: SavedApprentice,
  programmes: readonly ApprenticeProgrammeOption[],
): ApprenticeListItem {
  const programme = programmes.find((item) => item.id === saved.programmeId);
  return {
    gtaId: saved.gtaId,
    firstName: saved.firstName,
    middleNames: saved.middleNames,
    lastName: saved.lastName,
    programmeId: saved.programmeId,
    programmeLabel: programme
      ? formatProgrammeChoice(programme.name, programme.standardCode)
      : null,
    status: saved.status,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  };
}
