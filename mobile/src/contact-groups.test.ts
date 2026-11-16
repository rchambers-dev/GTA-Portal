import { describe, expect, it } from "vitest";
import {
  ADDRESS_BOOK_GROUP_NAMES,
  addressBookGroupName,
  groupsToLeave,
  isPortalContactLabel,
  portalGroupsToDelete,
  resolveGroupId,
} from "./contact-groups";

describe("address book folders", () => {
  it("gives each Portal group its own folder", () => {
    expect(addressBookGroupName("employer")).toBe("GTA Employers");
    expect(addressBookGroupName("learner")).toBe("GTA Learners");
    expect(addressBookGroupName("tutor")).toBe("GTA Tutors");
    expect(addressBookGroupName("staff")).toBe("GTA Staff");
    expect(new Set(Object.values(ADDRESS_BOOK_GROUP_NAMES)).size).toBe(4);
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

  it("moves a contact out of the old Portal folder and into the new one", () => {
    const memberships = [
      { id: "tutors", name: "GTA Tutors" },
      { id: "legacy", name: "GTA Portal" },
      { id: "family", name: "Family" },
    ];
    expect(groupsToLeave("GTA Staff", memberships).map((group) => group.name)).toEqual([
      "GTA Tutors",
      "GTA Portal",
    ]);
    expect(groupsToLeave("GTA Tutors", memberships).map((group) => group.id)).toEqual(["legacy"]);
  });

  it("removes only Portal folders", () => {
    expect(
      portalGroupsToDelete([
        { id: "1", name: "GTA Learners" },
        { id: "2", name: "Family" },
        { id: "3", name: "GTA Portal" },
        { id: "4", name: "GTA Learners club" },
      ]).map((group) => group.name),
    ).toEqual(["GTA Learners", "GTA Portal"]);
  });

  it("recognises labels this app writes on a phone number", () => {
    expect(isPortalContactLabel("GTA Learners")).toBe(true);
    expect(isPortalContactLabel("GTA Portal")).toBe(true);
    expect(isPortalContactLabel("mobile")).toBe(false);
    expect(isPortalContactLabel("Family")).toBe(false);
  });
});
