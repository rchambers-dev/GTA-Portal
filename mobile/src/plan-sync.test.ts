import { describe, expect, it } from "vitest";
import { indexTaggedContacts, toDeviceDraft } from "./map-contact";
import { formatSyncedAt, planSync, summarisePlan } from "./plan-sync";
import type { AddressBookRow } from "./types";

function employer(id: string, name: string, phone: string | null = "07700 900123"): AddressBookRow {
  const [givenName, familyName] = name.split(" ");
  return {
    contactGroup: "employer",
    sourceId: id,
    contactKey: `employer:${id}`,
    givenName: givenName ?? "",
    middleName: null,
    familyName: familyName ?? "",
    displayName: name,
    email: `${givenName}@garage.example`,
    phone,
    organisation: "North Garage",
    jobTitle: "Employer contact",
    detail: null,
  };
}

function draft(row: AddressBookRow) {
  const result = toDeviceDraft(row);
  if (!result.ok) throw new Error(`expected a draft for ${row.contactKey}`);
  return result;
}

describe("sync dedupe", () => {
  it("adds a contact that is not on the phone yet", () => {
    const plan = planSync({
      drafts: [draft(employer("6f1c2a40-7a1e-4d2a-9c3b-1a2b3c4d5e6f", "Alex Morgan"))],
      mapping: {},
      existingDeviceIds: new Set(),
      taggedDeviceIds: new Map(),
    });
    expect(plan.add).toHaveLength(1);
    expect(plan.update).toHaveLength(0);
    expect(summarisePlan(plan)).toMatchObject({ added: 1, updated: 0, skipped: 0, missingPhone: 0 });
  });

  it("updates the mapped device contact instead of adding another", () => {
    const key = "employer:6f1c2a40-7a1e-4d2a-9c3b-1a2b3c4d5e6f";
    const plan = planSync({
      drafts: [draft(employer("6f1c2a40-7a1e-4d2a-9c3b-1a2b3c4d5e6f", "Alex Morgan", "01302 893277"))],
      mapping: { [key]: "device-7" },
      existingDeviceIds: new Set(["device-7", "someone-else"]),
      taggedDeviceIds: new Map(),
    });
    expect(plan.add).toHaveLength(0);
    expect(plan.update).toEqual([
      expect.objectContaining({ deviceContactId: "device-7" }),
    ]);
    expect(plan.update[0]?.draft.phone).toBe("+441302893277");
  });

  it("recovers the existing contact from its tag when the local map is stale", () => {
    const row = employer("6f1c2a40-7a1e-4d2a-9c3b-1a2b3c4d5e6f", "Alex Morgan");
    const prepared = draft(row);
    const tagged = indexTaggedContacts([{ id: "device-4", note: prepared.draft.note }]);
    const plan = planSync({
      drafts: [prepared],
      mapping: { [row.contactKey]: "deleted-device" },
      existingDeviceIds: new Set(["device-4"]),
      taggedDeviceIds: tagged,
    });
    expect(plan.update.map((item) => item.deviceContactId)).toEqual(["device-4"]);
  });

  it("adds again when both the map and the tag point at a deleted contact", () => {
    const row = employer("6f1c2a40-7a1e-4d2a-9c3b-1a2b3c4d5e6f", "Alex Morgan");
    const plan = planSync({
      drafts: [draft(row)],
      mapping: { [row.contactKey]: "gone" },
      existingDeviceIds: new Set(["unrelated"]),
      taggedDeviceIds: new Map([[row.contactKey, "also-gone"]]),
    });
    expect(plan.add).toHaveLength(1);
    expect(plan.update).toHaveLength(0);
  });

  it("does not merge two people who share a name", () => {
    const plan = planSync({
      drafts: [
        draft(employer("6f1c2a40-7a1e-4d2a-9c3b-1a2b3c4d5e6f", "Alex Morgan")),
        draft(employer("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", "Alex Morgan")),
      ],
      mapping: {},
      existingDeviceIds: new Set(),
      taggedDeviceIds: new Map(),
    });
    expect(plan.add.map((item) => item.contactKey)).toEqual([
      "employer:6f1c2a40-7a1e-4d2a-9c3b-1a2b3c4d5e6f",
      "employer:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    ]);
  });

  it("skips a repeated Portal id and a blank name", () => {
    const person = employer("6f1c2a40-7a1e-4d2a-9c3b-1a2b3c4d5e6f", "Alex Morgan");
    const blank = toDeviceDraft({
      ...person,
      contactKey: "learner:GTA-000007",
      givenName: "",
      familyName: "",
      displayName: "",
    });
    const plan = planSync({
      drafts: [draft(person), draft(person), blank],
      mapping: {},
      existingDeviceIds: new Set(),
      taggedDeviceIds: new Map(),
    });
    expect(plan.add).toHaveLength(1);
    expect(plan.skipped).toEqual([
      { contactKey: person.contactKey, reason: "duplicate" },
      { contactKey: "learner:GTA-000007", reason: "blank-name" },
    ]);
    expect(summarisePlan(plan).skipped).toBe(2);
  });

  it("counts learners saved with no phone or email", () => {
    const learner = draft({
      ...employer("not-used", "Sam Taylor", null),
      contactGroup: "learner",
      sourceId: "GTA-000042",
      contactKey: "learner:GTA-000042",
      email: null,
      phone: null,
    });
    const summary = summarisePlan(
      planSync({
        drafts: [learner],
        mapping: {},
        existingDeviceIds: new Set(),
        taggedDeviceIds: new Map(),
      }),
    );
    expect(summary).toMatchObject({ added: 1, missingPhone: 1, missingEmail: 1 });
  });

  it("formats the last synced time for the UK", () => {
    expect(formatSyncedAt(null)).toBe("Not synced yet");
    expect(formatSyncedAt("not-a-date")).toBe("Not synced yet");
    expect(formatSyncedAt("2026-11-16T18:04:00.000Z")).toContain("2026");
  });
});
