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
  PORTAL_DEPARTMENT,
  PORTAL_FIELD_LABEL,
  PORTAL_GROUP_NAME,
  contactKeyFromTag,
  indexTaggedContacts,
  type DeviceDraft,
  type TaggedContactSource,
} from "./map-contact";

export type ContactsAccess = "granted" | "limited" | "denied";

export type ContactsPermission = {
  access: ContactsAccess;
  canAskAgain: boolean;
};

export type DeviceIndex = {
  ids: Set<string>;
  tagged: Map<string, string>;
};

type PortalGroup = GroupInstance | null;

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

export async function openPortalGroup(): Promise<PortalGroup> {
  if (Platform.OS !== "ios") return null;
  try {
    const groups = await Group.getAll();
    for (const group of groups) {
      const name = await group.getName();
      if (name === PORTAL_GROUP_NAME) return group;
    }
    return await Group.create(PORTAL_GROUP_NAME);
  } catch {
    return null;
  }
}

export async function createDeviceContact(draft: DeviceDraft, group: PortalGroup): Promise<string> {
  const contact = await createWithOptionalNote(draft);
  await tagContact(contact, draft, group);
  if (!contact.id) throw new Error("The phone did not return a contact id.");
  return contact.id;
}

export async function updateDeviceContact(
  deviceContactId: string,
  draft: DeviceDraft,
  group: PortalGroup,
): Promise<void> {
  const contact = new Contact(deviceContactId);
  const [phones, emails] = await Promise.all([contact.getPhones(), contact.getEmails()]);
  await contact.patch({
    givenName: draft.givenName,
    familyName: draft.familyName || null,
    middleName: draft.middleName,
    company: draft.organisation,
    jobTitle: draft.jobTitle,
    department: PORTAL_DEPARTMENT,
    ...(Platform.OS === "ios" ? { nickname: draft.contactKey } : {}),
    phones: mergePhones(phones, draft.phone),
    emails: mergeEmails(emails, draft.email),
  });
  await tagContact(contact, draft, group);
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
    department: PORTAL_DEPARTMENT,
    ...(draft.phone ? { phones: [{ label: PORTAL_FIELD_LABEL, number: draft.phone }] } : {}),
    ...(draft.email ? { emails: [{ label: PORTAL_FIELD_LABEL, address: draft.email }] } : {}),
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
  group: PortalGroup,
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
  if (group) {
    try {
      await group.addContact(contact);
    } catch {
      // The contact is already in the group, or this container has no groups.
    }
  }
}

function mergePhones(
  existing: { id?: string; label?: string | null; number?: string | null; isPrimary?: boolean }[],
  next: string | null,
) {
  const kept = existing
    .filter((item) => !ownedByPortal(item.label, item.number ?? null, next))
    .map((item) => ({ ...item, label: item.label ?? undefined, number: item.number ?? undefined }));
  if (!next) return kept;
  return [...kept, { label: PORTAL_FIELD_LABEL, number: next }];
}

function mergeEmails(
  existing: { id?: string; label?: string | null; address?: string | null; isPrimary?: boolean }[],
  next: string | null,
) {
  const kept = existing
    .filter((item) => !ownedByPortal(item.label, item.address ?? null, next))
    .map((item) => ({ ...item, label: item.label ?? undefined, address: item.address ?? undefined }));
  if (!next) return kept;
  return [...kept, { label: PORTAL_FIELD_LABEL, address: next }];
}

function ownedByPortal(
  label: string | null | undefined,
  current: string | null,
  next: string | null,
): boolean {
  if ((label ?? "").trim().toLowerCase() === PORTAL_FIELD_LABEL.toLowerCase()) return true;
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
