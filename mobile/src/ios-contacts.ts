/**
 * Expo Go does not have the iOS contacts-notes entitlement. Reading or writing
 * the note field raises a native exception that JavaScript cannot catch.
 * Notes stay off unless a custom build sets EXPO_PUBLIC_CONTACTS_NOTES=true
 * and is not running inside Expo Go.
 */

export const CONTACT_SCAN_FIELDS = ["nickname", "extraNames"] as const;

export function contactNotesEnabled(input: {
  platform: string;
  expoGo: boolean;
  flag?: string;
}): boolean {
  if (input.platform === "ios" && input.expoGo) return false;
  if (input.platform === "ios") return input.flag === "true";
  return input.flag !== "false";
}

/** Fields passed to getAllDetails. iOS never includes note unless notes are explicitly enabled. */
export function contactScanFields(notesEnabled: boolean): string[] {
  return notesEnabled ? [...CONTACT_SCAN_FIELDS, "note"] : [...CONTACT_SCAN_FIELDS];
}

export type ContactWrite = {
  givenName: string;
  familyName?: string;
  middleName?: string;
  company?: string;
  jobTitle?: string;
  department: string;
  nickname?: string;
  extraNames?: { label: string; name: string }[];
  phones?: { label: string; number: string }[];
  emails?: { label: string; address: string }[];
  note?: string;
};

export function contactWriteBody(
  draft: {
    contactKey: string;
    givenName: string;
    familyName: string;
    middleName: string | null;
    organisation: string | null;
    jobTitle: string | null;
    email: string | null;
    phone: string | null;
    note: string;
    department: string;
  },
  input: { platform: string; notesEnabled: boolean },
): ContactWrite {
  const body: ContactWrite = {
    givenName: draft.givenName,
    department: draft.department,
  };
  if (draft.familyName) body.familyName = draft.familyName;
  if (draft.middleName) body.middleName = draft.middleName;
  if (draft.organisation) body.company = draft.organisation;
  if (draft.jobTitle) body.jobTitle = draft.jobTitle;
  if (draft.phone) body.phones = [{ label: draft.department, number: draft.phone }];
  if (draft.email) body.emails = [{ label: draft.department, address: draft.email }];
  if (input.platform === "ios") body.nickname = draft.contactKey;
  if (input.platform === "android") body.extraNames = [{ label: "nickname", name: draft.contactKey }];
  if (input.notesEnabled) body.note = draft.note;
  return body;
}

export function syncProblemMessage(input: { failed: number; foldersUnavailable: boolean }): string | null {
  const parts: string[] = [];
  if (input.failed > 0) {
    parts.push(
      input.failed === 1
        ? "1 contact could not be saved."
        : `${input.failed} contacts could not be saved.`,
    );
  }
  if (input.foldersUnavailable) {
    parts.push("The iPhone folders could not be updated. The contacts were still saved.");
  }
  return parts.length > 0 ? parts.join(" ") : null;
}
