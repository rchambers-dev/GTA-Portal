import { describe, expect, it } from "vitest";
import {
  contactKeyFromTag,
  deviceIdsToRemove,
  groupPreview,
  indexTaggedContacts,
  mapAddressBookRow,
  summariseGroups,
  toDeviceDraft,
  PORTAL_ID_PREFIX,
} from "./map-contact";
import type { AddressBookRow, RawAddressBookRow } from "./types";

function row(overrides: Partial<AddressBookRow> = {}): AddressBookRow {
  return {
    contactGroup: "employer",
    sourceId: "6f1c2a40-7a1e-4d2a-9c3b-1a2b3c4d5e6f",
    contactKey: "employer:6f1c2a40-7a1e-4d2a-9c3b-1a2b3c4d5e6f",
    givenName: "Alex",
    middleName: null,
    familyName: "Morgan",
    displayName: "Alex Morgan",
    email: "Alex@Garage.example",
    phone: "(01302) 893277",
    organisation: "North Garage",
    jobTitle: "Employer contact",
    detail: "Doncaster, DN1 1AA",
    ...overrides,
  };
}

function raw(overrides: Partial<RawAddressBookRow> = {}): RawAddressBookRow {
  return {
    contact_group: "learner",
    source_id: "GTA-000042",
    contact_key: "learner:GTA-000042",
    given_name: "Sam",
    middle_name: "Jo",
    family_name: "Taylor",
    display_name: "Sam Jo Taylor",
    email: "",
    phone: null,
    organisation: "North Garage",
    job_title: "Apprentice",
    detail: "GTA-000042 · In learning",
    ...overrides,
  };
}

describe("mapping Portal rows onto device contacts", () => {
  it("normalises a workplace number and keeps the company", () => {
    const result = toDeviceDraft(row());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.phone).toBe("+441302893277");
    expect(result.draft.email).toBe("alex@garage.example");
    expect(result.draft.organisation).toBe("North Garage");
    expect(result.draft.givenName).toBe("Alex");
    expect(result.draft.familyName).toBe("Morgan");
    expect(result.draft.missingPhone).toBe(false);
    expect(result.draft.note.startsWith(`${PORTAL_ID_PREFIX}employer:`)).toBe(true);
  });

  it("keeps a learner who has a name but no phone or email", () => {
    const mapped = mapAddressBookRow(raw());
    expect(mapped?.middleName).toBe("Jo");
    const result = toDeviceDraft(mapped!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.phone).toBeNull();
    expect(result.draft.email).toBeNull();
    expect(result.draft.missingPhone).toBe(true);
    expect(result.draft.missingEmail).toBe(true);
    expect(result.draft.givenName).toBe("Sam");
    expect(result.draft.organisation).toBe("North Garage");
  });

  it("drops a phone that is not a number and still keeps the person", () => {
    const result = toDeviceDraft(row({ phone: "ask reception", email: "not-an-email" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.phone).toBeNull();
    expect(result.draft.email).toBeNull();
  });

  it("skips a row with no name", () => {
    const result = toDeviceDraft(
      row({ givenName: " ", familyName: "", displayName: "  ", contactKey: "learner:GTA-000001" }),
    );
    expect(result).toEqual({ ok: false, contactKey: "learner:GTA-000001", reason: "blank-name" });
  });

  it("uses the display name when the given and family names are blank", () => {
    const result = toDeviceDraft(
      row({
        givenName: "",
        familyName: "",
        displayName: "Riley Chen",
        contactGroup: "tutor",
        contactKey: "profile:11111111-1111-4111-8111-111111111111",
        sourceId: "11111111-1111-4111-8111-111111111111",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.givenName).toBe("Riley");
    expect(result.draft.familyName).toBe("Chen");
  });

  it("ignores a row from an unknown group", () => {
    expect(mapAddressBookRow(raw({ contact_group: "visitor" }))).toBeNull();
  });

  it("reads the Portal id back out of a note", () => {
    const result = toDeviceDraft(row());
    if (!result.ok) throw new Error("expected a draft");
    expect(contactKeyFromTag(result.draft.note)).toBe(result.draft.contactKey);
    expect(contactKeyFromTag(result.draft.contactKey)).toBe(result.draft.contactKey);
    expect(contactKeyFromTag("met at the garage")).toBeNull();
  });

  it("indexes tagged device contacts and lists the ids the app can remove", () => {
    const tagged = indexTaggedContacts([
      { id: "device-1", note: "GTA Portal id: learner:GTA-000042\nIn learning" },
      { id: "device-2", nickname: "profile:11111111-1111-4111-8111-111111111111" },
      { id: "", extraNames: [{ name: "employer:6f1c2a40-7a1e-4d2a-9c3b-1a2b3c4d5e6f" }] },
      {
        id: "device-3",
        extraNames: [{ name: "employer:6f1c2a40-7a1e-4d2a-9c3b-1a2b3c4d5e6f" }],
      },
    ]);
    expect(tagged.get("learner:GTA-000042")).toBe("device-1");
    expect(tagged.get("employer:6f1c2a40-7a1e-4d2a-9c3b-1a2b3c4d5e6f")).toBe("device-3");
    expect(deviceIdsToRemove({ "learner:GTA-000099": "device-9" }, tagged).sort()).toEqual([
      "device-1",
      "device-2",
      "device-3",
      "device-9",
    ]);
  });

  it("describes a group that has names but no numbers", () => {
    const counts = summariseGroups([
      row({ contactGroup: "learner", phone: null, email: null, contactKey: "learner:GTA-000001" }),
      row({ contactGroup: "learner", phone: null, email: null, contactKey: "learner:GTA-000002" }),
    ]);
    expect(groupPreview(counts.learner)).toBe("2 contacts · name only, no phone or email on file");
    expect(groupPreview(counts.employer)).toBe("None on your account");
  });
});
