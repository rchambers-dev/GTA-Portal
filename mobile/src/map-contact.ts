import { phoneToStore } from "./phone";
import {
  isContactGroup,
  type AddressBookRow,
  type ContactGroup,
  type RawAddressBookRow,
} from "./types";

export const PORTAL_FIELD_LABEL = "GTA Portal";
export const PORTAL_DEPARTMENT = "GTA Portal";
export const PORTAL_GROUP_NAME = "GTA Portal";
export const PORTAL_ID_PREFIX = "GTA Portal id: ";

const CONTACT_KEY = /^(learner|employer|profile):[A-Za-z0-9._-]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DeviceDraft = {
  contactKey: string;
  contactGroup: ContactGroup;
  givenName: string;
  middleName: string | null;
  familyName: string;
  organisation: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  note: string;
  missingPhone: boolean;
  missingEmail: boolean;
};

export type DraftResult =
  | { ok: true; draft: DeviceDraft }
  | { ok: false; contactKey: string; reason: "blank-name" };

export type GroupCount = {
  total: number;
  withPhone: number;
  withEmail: number;
};

export function mapAddressBookRow(row: RawAddressBookRow): AddressBookRow | null {
  const group = (row.contact_group ?? "").trim();
  const contactKey = (row.contact_key ?? "").trim();
  const sourceId = (row.source_id ?? "").trim();
  if (!isContactGroup(group) || !CONTACT_KEY.test(contactKey) || !sourceId) return null;
  return {
    contactGroup: group,
    sourceId,
    contactKey,
    givenName: text(row.given_name),
    middleName: optional(row.middle_name),
    familyName: text(row.family_name),
    displayName: text(row.display_name),
    email: optional(row.email),
    phone: optional(row.phone),
    organisation: optional(row.organisation),
    jobTitle: optional(row.job_title),
    detail: optional(row.detail),
  };
}

export function toDeviceDraft(row: AddressBookRow): DraftResult {
  const names = resolveNames(row);
  if (!names || !CONTACT_KEY.test(row.contactKey)) {
    return { ok: false, contactKey: row.contactKey, reason: "blank-name" };
  }
  const email = cleanEmail(row.email);
  const phone = phoneToStore(row.phone);
  return {
    ok: true,
    draft: {
      contactKey: row.contactKey,
      contactGroup: row.contactGroup,
      givenName: names.givenName,
      middleName: optional(row.middleName),
      familyName: names.familyName,
      organisation: optional(row.organisation),
      jobTitle: optional(row.jobTitle),
      email,
      phone,
      note: portalNote(row.contactKey, row.detail),
      missingPhone: !phone,
      missingEmail: !email,
    },
  };
}

export function portalNote(contactKey: string, detail: string | null): string {
  const lines = [`${PORTAL_ID_PREFIX}${contactKey}`];
  const extra = optional(detail);
  if (extra) lines.push(extra);
  return lines.join("\n");
}

/** Pull a Portal contact key out of a nickname or a note the app wrote. */
export function contactKeyFromTag(value: string | null | undefined): string | null {
  if (!value) return null;
  const direct = value.trim();
  if (CONTACT_KEY.test(direct)) return direct;
  for (const line of direct.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(PORTAL_ID_PREFIX)) continue;
    const key = trimmed.slice(PORTAL_ID_PREFIX.length).trim();
    if (CONTACT_KEY.test(key)) return key;
  }
  return null;
}

export type TaggedContactSource = {
  id: string;
  nickname?: string | null;
  note?: string | null;
  extraNames?: { name?: string | null }[] | null;
};

/** First matching device contact for each Portal key. Later duplicates are ignored. */
export function indexTaggedContacts(sources: readonly TaggedContactSource[]): Map<string, string> {
  const tagged = new Map<string, string>();
  for (const source of sources) {
    if (!source.id) continue;
    const candidates = [
      source.nickname,
      source.note,
      ...(source.extraNames ?? []).map((extra) => extra.name),
    ];
    for (const candidate of candidates) {
      const key = contactKeyFromTag(candidate);
      if (!key || tagged.has(key)) continue;
      tagged.set(key, source.id);
      break;
    }
  }
  return tagged;
}

export function deviceIdsToRemove(
  mapping: Readonly<Record<string, string>>,
  tagged: ReadonlyMap<string, string>,
): string[] {
  return [...new Set([...Object.values(mapping), ...tagged.values()].filter((id) => id.trim()))];
}

export function summariseGroups(rows: readonly AddressBookRow[]): Record<ContactGroup, GroupCount> {
  const counts: Record<ContactGroup, GroupCount> = {
    learner: { total: 0, withPhone: 0, withEmail: 0 },
    employer: { total: 0, withPhone: 0, withEmail: 0 },
    tutor: { total: 0, withPhone: 0, withEmail: 0 },
    staff: { total: 0, withPhone: 0, withEmail: 0 },
  };
  for (const row of rows) {
    const bucket = counts[row.contactGroup];
    bucket.total += 1;
    if (optional(row.phone)) bucket.withPhone += 1;
    if (cleanEmail(row.email)) bucket.withEmail += 1;
  }
  return counts;
}

export function groupPreview(count: GroupCount): string {
  if (count.total === 0) return "None on your account";
  const noun = count.total === 1 ? "contact" : "contacts";
  if (count.withPhone === 0 && count.withEmail === 0) {
    return `${count.total} ${noun} · name only, no phone or email on file`;
  }
  if (count.withPhone === 0) return `${count.total} ${noun} · no phone number on file`;
  const phone = `${count.withPhone} with a phone`;
  return `${count.total} ${noun} · ${phone}`;
}

function resolveNames(row: AddressBookRow): { givenName: string; familyName: string } | null {
  let givenName = row.givenName.trim();
  let familyName = row.familyName.trim();
  if (!givenName && !familyName) {
    const parts = row.displayName.trim().split(/\s+/).filter(Boolean);
    givenName = parts[0] ?? "";
    familyName = parts.slice(1).join(" ");
  }
  if (!givenName && familyName) {
    givenName = familyName;
    familyName = "";
  }
  if (!givenName) return null;
  return { givenName, familyName };
}

function cleanEmail(value: string | null): string | null {
  const email = (value ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return null;
  return email;
}

function text(value: string | null): string {
  return (value ?? "").trim();
}

function optional(value: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}
