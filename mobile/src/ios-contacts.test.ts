import { describe, expect, it } from "vitest";
import { contactNotesEnabled, contactScanFields, contactWriteBody } from "./ios-contacts";

const draft = {
  contactKey: "learner:GTA-000042",
  givenName: "Sam",
  familyName: "Taylor",
  middleName: null,
  organisation: "North Garage",
  jobTitle: "Apprentice",
  email: "sam@example.com",
  phone: "+447700900123",
  note: "GTA Portal id: learner:GTA-000042",
  department: "GTA Learners",
};

describe("iOS contact notes", () => {
  it("never includes note on iOS field lists or drafts unless a custom build opts in", () => {
    expect(contactNotesEnabled({ platform: "ios", expoGo: true, flag: "true" })).toBe(false);
    expect(contactNotesEnabled({ platform: "ios", expoGo: false })).toBe(false);

    const fields = contactScanFields(false);
    const body = contactWriteBody(draft, { platform: "ios", notesEnabled: false });

    expect(fields).not.toContain("note");
    expect(body).not.toHaveProperty("note");
    expect(body.nickname).toBe(draft.contactKey);
  });

  it("writes a note only when a non-Expo-Go iOS build opts in", () => {
    expect(contactNotesEnabled({ platform: "ios", expoGo: false, flag: "true" })).toBe(true);
    const body = contactWriteBody(draft, { platform: "ios", notesEnabled: true });
    expect(contactScanFields(true)).toContain("note");
    expect(body.note).toBe(draft.note);
  });

  it("still allows notes on Android, where the entitlement does not apply", () => {
    expect(contactNotesEnabled({ platform: "android", expoGo: false })).toBe(true);
    expect(contactWriteBody(draft, { platform: "android", notesEnabled: true }).note).toBe(draft.note);
  });
});
