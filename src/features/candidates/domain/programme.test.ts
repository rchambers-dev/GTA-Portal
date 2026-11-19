import { describe, expect, it } from "vitest";
import { applicantEntryError, programmeChoiceId } from "./programme";

const programmeId = "80f06b62-c953-4acd-aacf-630db3a861c4";

describe("applicant programme choice", () => {
  it("accepts a programmes table id and rejects a display name", () => {
    expect(programmeChoiceId(programmeId)).toBe(programmeId);
    expect(programmeChoiceId(" Light Vehicle ")).toBeNull();
    expect(programmeChoiceId("Autocare")).toBeNull();
    expect(programmeChoiceId("")).toBeNull();
  });

  it("asks for the required entry fields and does not mention a missing programme name", () => {
    expect(
      applicantEntryError({
        firstName: "",
        lastName: "Colton",
        email: "h@example.com",
        phone: "07000000000",
        firstContact: "14/11/2026",
        programmeId,
        centreId: programmeId,
        sourceId: programmeId,
      }),
    ).toMatch(/First name/);
    expect(
      applicantEntryError({
        firstName: "Hannah",
        lastName: "Colton",
        email: "h@example.com",
        phone: "07000000000",
        firstContact: "14/11/2026",
        programmeId: null,
        centreId: programmeId,
        sourceId: programmeId,
      }),
    ).toBe("Choose a programme.");
    expect(
      applicantEntryError({
        firstName: "Hannah",
        lastName: "Colton",
        email: "h@example.com",
        phone: "07000000000",
        firstContact: "14/11/2026",
        programmeId,
        centreId: programmeId,
        sourceId: programmeId,
      }),
    ).toBeNull();
  });
});
