import {
  Contact,
  ContactField,
  Group,
  getPermissionsAsync,
  requestPermissionsAsync,
  type Contact as ContactInstance,
  type Group as GroupInstance,
} from "expo-contacts";
import { Platform } from "react-native";
import {
  addressBookGroupName,
  isPortalAddressBookGroup,
  isPortalContactLabel,
  resolveGroupId,
  type NamedGroup,
} from "./contact-groups";
import {
  contactKeyFromTag,
  indexTaggedContacts,
  type DeviceDraft,
  type TaggedContactSource,
} from "./map-contact";
import { CONTACT_GROUPS, type ContactGroup } from "./types";

export type ContactsAccess = "granted" | "limited" | "denied";

export type ContactsPermission = {
  access: ContactsAccess;
  canAskAgain: boolean;
};

export type DeviceIndex = {
  ids: Set<string>;
  tagged: Map<string, string>;
};

export type PortalGroupSet = {
  /** Folder for each Portal group. Null on Android, where folders are not available. */
  folders: Partial<Record<ContactGroup, GroupInstance | null>>;
  /** Every Portal folder that already exists, including the old shared "GTA Portal" folder. */
  managed: { name: string; group: GroupInstance }[];
};

const EMPTY_GROUPS: PortalGroupSet = { folders: {}, managed: [] };

const PAGE = 500;

export async function readContactsPermission(): Promise<ContactsPermission> {
  const result = await getPermissionsAsync();
  return toPermission(result.status, result.canAskAgain, result.accessPrivileges);
}

export async function askContactsPermission(): Promise<ContactsPermission> {
  const result = await requestPermissionsAsync();
  return toPermission(result.status, result.canAskAgain, result.accessPrivileges);
}

export async function readDeviceIndex(): Promise<DeviceIndex> {
  const sources: TaggedContactSource[] = [];
  const ids = new Set<string>();
  for (let offset = 0; ; offset += PAGE) {
    const page = await loadPage(offset);
    for (const item of page) {
      if (!item.id) continue;
      ids.add(item.id);
      sources.push(item);
    }
    if (page.length < PAGE) break;
  }
  return { ids, tagged: indexTaggedContacts(sources) };
}

/**
 * On iPhone, find or create one folder per Portal group. An existing folder
 * with the same name is reused. Android has no contacts-group API in this
 * SDK, so this returns an empty set and the caller tags the contact instead.
 */
export async function openAddressBookGroups(): Promise<PortalGroupSet> {
  if (Platform.OS !== "ios") return EMPTY_GROUPS;
  try {
    const listed = await Group.getAll();
    const named: NamedGroup[] = [];
    const byId = new Map<string, GroupInstance>();
    for (const group of listed) {
      const name = (await group.getName())?.trim() ?? "";
      if (!name || !group.id) continue;
      named.push({ id: group.id, name });
      byId.set(group.id, group);
    }
    const folders: PortalGroupSet["folders"] = {};
    const managed = named
      .filter((group) => isPortalAddressBookGroup(group.name))
      .map((group) => ({ name: group.name, group: byId.get(group.id)! }));
    for (const contactGroup of CONTACT_GROUPS) {
      const folderName = addressBookGroupName(contactGroup);
      const existingId = resolveGroupId(folderName, named);
      if (existingId && byId.has(existingId)) {
        folders[contactGroup] = byId.get(existingId) ?? null;
        continue;
      }
      try {
        const created = await Group.create(folderName);
        folders[contactGroup] = created;
        if (created.id) {
          named.push({ id: created.id, name: folderName });
          managed.push({ name: folderName, group: created });
        }
      } catch {
        folders[contactGroup] = null;
      }
    }
    return { folders, managed };
  } catch {
    return EMPTY_GROUPS;
  }
}

/** Deletes Portal folders. iOS leaves the people in the address book; callers delete those first. */
export async function deletePortalAddressBookGroups(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const listed = await Group.getAll();
    for (const group of listed) {
      const name = await group.getName();
      if (!isPortalAddressBookGroup(name)) continue;
      try {
        await group.delete();
      } catch {
        // A folder that is already gone does not stop the rest of the clear.
      }
    }
  } catch {
    // Android, or a phone that cannot list groups.
  }
}

export async function createDeviceContact(draft: DeviceDraft, groups: PortalGroupSet): Promise<string> {
  const contact = await createWithOptionalNote(draft);
  await tagContact(contact, draft, groups);
  if (!contact.id) throw new Error("The phone did not return a contact id.");
  return contact.id;
}

export async function updateDeviceContact(
  deviceContactId: string,
  draft: DeviceDraft,
  groups: PortalGroupSet,
): Promise<void> {
  const contact = new Contact(deviceContactId);
  const label = addressBookGroupName(draft.contactGroup);
  const [phones, emails] = await Promise.all([contact.getPhones(), contact.getEmails()]);
  await contact.patch({
    givenName: draft.givenName,
    familyName: draft.familyName || null,
    middleName: draft.middleName,
    company: draft.organisation,
    jobTitle: draft.jobTitle,
    department: label,
    ...(Platform.OS === "ios" ? { nickname: draft.contactKey } : {}),
    phones: mergePhones(phones, draft.phone, label),
    emails: mergeEmails(emails, draft.email, label),
  });
  await tagContact(contact, draft, groups);
}

export async function deleteDeviceContact(deviceContactId: string): Promise<void> {
  await new Contact(deviceContactId).delete();
}

async function createWithOptionalNote(draft: DeviceDraft): Promise<ContactInstance> {
  const record = {
    givenName: draft.givenName,
    ...(draft.familyName ? { familyName: draft.familyName } : {}),
    ...(draft.middleName ? { middleName: draft.middleName } : {}),
    ...(draft.organisation ? { company: draft.organisation } : {}),
    ...(draft.jobTitle ? { jobTitle: draft.jobTitle } : {}),
    department: addressBookGroupName(draft.contactGroup),
    ...(draft.phone
      ? { phones: [{ label: addressBookGroupName(draft.contactGroup), number: draft.phone }] }
      : {}),
    ...(draft.email
      ? { emails: [{ label: addressBookGroupName(draft.contactGroup), address: draft.email }] }
      : {}),
    ...(Platform.OS === "ios" ? { nickname: draft.contactKey } : {}),
    ...(Platform.OS === "android"
      ? { extraNames: [{ label: "nickname", name: draft.contactKey }] }
      : {}),
    note: draft.note,
  };
  try {
    return await Contact.create(record);
  } catch (error) {
    if (!record.note) throw error;
    const { note, ...withoutNote } = record;
    return Contact.create(withoutNote);
  }
}

async function tagContact(
  contact: ContactInstance,
  draft: DeviceDraft,
  groups: PortalGroupSet,
): Promise<void> {
  try {
    await contact.setNote(draft.note);
  } catch {
    // iOS notes need an entitlement Expo Go does not have. The id map and nickname still dedupe.
  }
  if (Platform.OS === "android") {
    try {
      const extras = await contact.getExtraNames();
      const ours = extras.find((extra) => contactKeyFromTag(extra.name) || extra.label === "nickname");
      if (ours) await contact.updateExtraName({ ...ours, label: "nickname", name: draft.contactKey });
      else await contact.addExtraName({ label: "nickname", name: draft.contactKey });
    } catch {
      // The local id map still updates this contact on the next sync.
    }
  }
  await placeInAddressBookGroup(contact, draft, groups);
}

/** iPhone folders. On Android the Group class throws, so this does nothing. */
async function placeInAddressBookGroup(
  contact: ContactInstance,
  draft: DeviceDraft,
  groups: PortalGroupSet,
): Promise<void> {
  if (Platform.OS !== "ios") return;
  const destinationName = addressBookGroupName(draft.contactGroup);
  for (const entry of groups.managed) {
    if (entry.name === destinationName) continue;
    try {
      await entry.group.removeContact(contact);
    } catch {
      // The contact was not in that folder.
    }
  }
  const destination = groups.folders[draft.contactGroup];
  if (!destination) return;
  try {
    await destination.addContact(contact);
  } catch {
    // Already in the folder, or this container cannot take group members.
  }
}

function mergePhones(
  existing: { id?: string; label?: string | null; number?: string | null; isPrimary?: boolean }[],
  next: string | null,
  label: string,
) {
  const kept = existing
    .filter((item) => !ownedByPortal(item.label, item.number ?? null, next))
    .map((item) => ({ ...item, label: item.label ?? undefined, number: item.number ?? undefined }));
  if (!next) return kept;
  return [...kept, { label, number: next }];
}

function mergeEmails(
  existing: { id?: string; label?: string | null; address?: string | null; isPrimary?: boolean }[],
  next: string | null,
  label: string,
) {
  const kept = existing
    .filter((item) => !ownedByPortal(item.label, item.address ?? null, next))
    .map((item) => ({ ...item, label: item.label ?? undefined, address: item.address ?? undefined }));
  if (!next) return kept;
  return [...kept, { label, address: next }];
}

function ownedByPortal(
  label: string | null | undefined,
  current: string | null,
  next: string | null,
): boolean {
  if (isPortalContactLabel(label)) return true;
  if (!next || !current) return false;
  if (current.trim().toLowerCase() === next.trim().toLowerCase()) return true;
  const currentDigits = current.replace(/\D/g, "");
  const nextDigits = next.replace(/\D/g, "");
  return currentDigits.length >= 7 && currentDigits === nextDigits;
}

async function loadPage(offset: number): Promise<TaggedContactSource[]> {
  const withNote = [ContactField.NICKNAME, ContactField.EXTRA_NAMES, ContactField.NOTE] as const;
  try {
    const page = await Contact.getAllDetails(withNote, { limit: PAGE, offset });
    return page.map((item) => ({
      id: item.id,
      nickname: item.nickname ?? null,
      note: item.note ?? null,
      extraNames: item.extraNames ?? null,
    }));
  } catch {
    const page = await Contact.getAllDetails(
      [ContactField.NICKNAME, ContactField.EXTRA_NAMES] as const,
      { limit: PAGE, offset },
    );
    return page.map((item) => ({
      id: item.id,
      nickname: item.nickname ?? null,
      note: null,
      extraNames: item.extraNames ?? null,
    }));
  }
}

function toPermission(
  status: string,
  canAskAgain: boolean,
  accessPrivileges?: string,
): ContactsPermission {
  if (status !== "granted") return { access: "denied", canAskAgain };
  if (accessPrivileges === "limited") return { access: "limited", canAskAgain };
  return { access: "granted", canAskAgain };
}
