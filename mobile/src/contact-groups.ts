import type { ContactGroup } from "./types";

/** Folder name written into the phone address book for each Portal group. */
export const ADDRESS_BOOK_GROUP_NAMES: Record<ContactGroup, string> = {
  learner: "GTA Learners",
  employer: "GTA Employers",
  tutor: "GTA Tutors",
  staff: "GTA Staff",
};

/** The single folder used by the first version of the companion. Removed on a full clear. */
export const LEGACY_PORTAL_GROUP_NAME = "GTA Portal";

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
  if (trimmed === LEGACY_PORTAL_GROUP_NAME) return true;
  return (Object.values(ADDRESS_BOOK_GROUP_NAMES) as string[]).includes(trimmed);
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
