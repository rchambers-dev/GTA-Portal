import { describe, expect, it } from "vitest";
import {
  ADDRESS_BOOK_GROUP_NAMES,
  addressBookGroupName,
  collapseTutorAndStaff,
  groupsToLeave,
  isPortalContactLabel,
  portalGroupsToDelete,
  resolveGroupId,
} from "./contact-groups";

const profileId = "profile:11111111-1111-4111-8111-111111111111";

describe("address book folders", () => {
  it("uses three folders and files tutors with staff", () => {
    expect(addressBookGroupName("employer")).toBe("GTA Employers");
    expect(addressBookGroupName("learner")).toBe("GTA Learners");
    expect(addressBookGroupName("tutor")).toBe("GTA Staff");
    expect(addressBookGroupName("staff")).toBe("GTA Staff");
    expect(new Set(Object.values(ADDRESS_BOOK_GROUP_NAMES))).toEqual(
      new Set(["GTA Employers", "GTA Learners", "GTA Staff"]),
    );
  });

  it("reuses a folder with the same name and does not invent a second one", () => {
    const existing = [
      { id: "family", name: "Family" },
      { id: "employers-1", name: "GTA Employers" },
      { id: "employers-2", name: "GTA Employers" },
    ];
    expect(resolveGroupId("GTA Employers", existing)).toBe("employers-1");
    expect(resolveGroupId("GTA Learners", existing)).toBeNull();
    expect(resolveGroupId("GTA employers", existing)).toBeNull();
  });

  it("moves a tutor out of a leftover tutors folder into staff", () => {
    const memberships = [
      { id: "tutors", name: "GTA Tutors" },
      { id: "legacy", name: "GTA Portal" },
      { id: "family", name: "Family" },
      { id: "staff", name: "GTA Staff" },
    ];
    expect(groupsToLeave("GTA Staff", memberships).map((group) => group.name)).toEqual([
      "GTA Tutors",
      "GTA Portal",
    ]);
  });

  it("keeps one staff contact when the same person is a tutor and staff", () => {
    const tutor = { contactKey: profileId, contactGroup: "tutor" as const, jobTitle: "Apprenticeship Tutor" };
    const staff = { contactKey: profileId, contactGroup: "staff" as const, jobTitle: "Administrator" };
    const learner = { contactKey: "learner:GTA-000042", contactGroup: "learner" as const, jobTitle: "Apprentice" };

    expect(collapseTutorAndStaff([tutor, staff, learner])).toEqual([staff, learner]);
    expect(collapseTutorAndStaff([staff, tutor])).toEqual([staff]);
    expect(collapseTutorAndStaff([tutor])).toEqual([tutor]);
    expect(addressBookGroupName(collapseTutorAndStaff([tutor, staff])[0].contactGroup)).toBe("GTA Staff");
  });

  it("removes only Portal folders, including a retired tutors folder", () => {
    expect(
      portalGroupsToDelete([
        { id: "1", name: "GTA Learners" },
        { id: "2", name: "Family" },
        { id: "3", name: "GTA Portal" },
        { id: "4", name: "GTA Learners club" },
        { id: "5", name: "GTA Tutors" },
      ]).map((group) => group.name),
    ).toEqual(["GTA Learners", "GTA Portal", "GTA Tutors"]);
  });

  it("recognises labels this app writes on a phone number", () => {
    expect(isPortalContactLabel("GTA Learners")).toBe(true);
    expect(isPortalContactLabel("GTA Portal")).toBe(true);
    expect(isPortalContactLabel("mobile")).toBe(false);
    expect(isPortalContactLabel("Family")).toBe(false);
  });
});
