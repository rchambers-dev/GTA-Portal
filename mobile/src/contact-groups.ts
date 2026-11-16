import type { ContactGroup } from "./types";

/**
 * Folder name written into the phone address book.
 * Tutors are staff, so they share the GTA Staff folder.
 */
export const ADDRESS_BOOK_GROUP_NAMES: Record<ContactGroup, string> = {
  learner: "GTA Learners",
  employer: "GTA Employers",
  tutor: "GTA Staff",
  staff: "GTA Staff",
};

/** The single folder used by the first version of the companion. Removed on a full clear. */
export const LEGACY_PORTAL_GROUP_NAME = "GTA Portal";

/** A tutors-only folder from an earlier build. Cleared, never created. */
export const RETIRED_TUTOR_GROUP_NAME = "GTA Tutors";

export type NamedGroup = {
  id: string;
  name: string;
};

export function addressBookGroupName(group: ContactGroup): string {
  return ADDRESS_BOOK_GROUP_NAMES[group];
}

export function isPortalAddressBookGroup(name: string | null | undefined): boolean {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return false;
  if (trimmed === LEGACY_PORTAL_GROUP_NAME || trimmed === RETIRED_TUTOR_GROUP_NAME) return true;
  return (Object.values(ADDRESS_BOOK_GROUP_NAMES) as string[]).includes(trimmed);
}

export function profilePersonKey(contactKey: string): string | null {
  return contactKey.startsWith("profile:") ? contactKey : null;
}

/**
 * Tutors and staff are one set of people. The same profile is kept once and
 * filed as staff, so a person who appears in both lists becomes one contact.
 */
export function collapseTutorAndStaff<T extends { contactKey: string; contactGroup: ContactGroup }>(
  people: readonly T[],
): T[] {
  const indexByPerson = new Map<string, number>();
  const result: T[] = [];
  for (const person of people) {
    const id = profilePersonKey(person.contactKey);
    if (!id) {
      result.push(person);
      continue;
    }
    const existingIndex = indexByPerson.get(id);
    if (existingIndex === undefined) {
      indexByPerson.set(id, result.length);
      result.push(person);
      continue;
    }
    if (person.contactGroup === "staff" && result[existingIndex]?.contactGroup === "tutor") {
      result[existingIndex] = person;
    }
  }
  return result;
}

/** A phone or email label written by this app, including the old shared label. */
export function isPortalContactLabel(label: string | null | undefined): boolean {
  const trimmed = (label ?? "").trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase() === LEGACY_PORTAL_GROUP_NAME.toLowerCase()) return true;
  return isPortalAddressBookGroup(trimmed);
}

/**
 * The existing folder to reuse. Null means the caller should create one.
 * The first exact name wins, so a second folder with the same name is not created.
 */
export function resolveGroupId(name: string, existing: readonly NamedGroup[]): string | null {
  const match = existing.find((group) => group.name === name);
  return match?.id ?? null;
}

/** Portal folders this contact should leave when it belongs in `destinationName`. */
export function groupsToLeave(destinationName: string, memberships: readonly NamedGroup[]): NamedGroup[] {
  return memberships.filter((group) => isPortalAddressBookGroup(group.name) && group.name !== destinationName);
}

/** Only the folders this app created. A personal folder such as Family is left alone. */
export function portalGroupsToDelete(existing: readonly NamedGroup[]): NamedGroup[] {
  return existing.filter((group) => isPortalAddressBookGroup(group.name));
}
