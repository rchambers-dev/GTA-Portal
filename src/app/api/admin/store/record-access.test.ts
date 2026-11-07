import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import type { EffectiveSession } from "@/lib/portal/types";
import {
  canMutateStaffAccounts,
  canReadMasterRecords,
  enrolmentApprenticeSelect,
  isStaffAccountAction,
  proxyApprenticeSelect,
  redactApprenticeContacts,
  redactEnrolmentContacts,
  staffHierarchyError,
} from "./record-access";

function session(partial: {
  workspace?: EffectiveSession["account"]["workspace"];
  baseRole?: string;
  permissions?: string[];
}): EffectiveSession {
  const permissions = partial.permissions ?? [];
  return {
    account: {
      id: "user-1",
      name: "Example",
      initials: "EX",
      email: "example@example.test",
      baseRole: partial.baseRole ?? "Administrator",
      responsibilities: [],
      workspace: partial.workspace ?? "administration",
      permissions,
    },
    permissions,
    activeTemporaryAssignments: [],
    temporaryAccessLabels: [],
  };
}

const enrolment = {
  email: "learner@example.test",
  phone: "07000000000",
  dateOfBirth: "2008-01-02",
  uln: "1234567890",
  workplaceContact: "Pat Manager",
  displayName: "Learner Example",
};

describe("master record access", () => {
  it("allows staff with admin.records.manage and nobody else", () => {
    expect(
      canReadMasterRecords(
        session({ permissions: [PERMISSIONS.ADMIN_RECORDS_MANAGE] }),
      ),
    ).toBe(true);
    expect(
      canReadMasterRecords(
        session({ permissions: [PERMISSIONS.RECORDS_PROXY_WRITE] }),
      ),
    ).toBe(false);
    expect(
      canReadMasterRecords(
        session({ permissions: [PERMISSIONS.REVIEWS_MANAGE] }),
      ),
    ).toBe(false);
    expect(
      canReadMasterRecords(
        session({
          workspace: "apprentice",
          baseRole: "Apprentice",
          permissions: [PERMISSIONS.ADMIN_RECORDS_MANAGE],
        }),
      ),
    ).toBe(false);
    expect(
      canReadMasterRecords(
        session({
          workspace: "employer",
          baseRole: "Employer",
          permissions: [PERMISSIONS.ADMIN_RECORDS_MANAGE],
        }),
      ),
    ).toBe(false);
  });

  it("strips enrolment and apprentice contacts when access is denied", () => {
    expect(redactEnrolmentContacts(enrolment, false)).toEqual({
      ...enrolment,
      email: "",
      phone: "",
      dateOfBirth: "",
      uln: "",
      workplaceContact: "",
    });
    expect(redactEnrolmentContacts(enrolment, true).email).toBe(
      "learner@example.test",
    );
    expect(
      redactApprenticeContacts(
        {
          email: "learner@example.test",
          phone: "07000000000",
          dateOfBirth: "2008-01-02",
          uln: "123",
          addressLine1: "1 High Street",
          addressLine2: "",
          town: "Doncaster",
          postcode: "DN1 1AA",
          emergencyContactName: "Parent",
          emergencyContactPhone: "07000000001",
          emergencyContactRelationship: "Parent",
        },
        false,
      ).email,
    ).toBe("");
  });

  it("does not select apprentice email for proxy-only reads", () => {
    expect(enrolmentApprenticeSelect(false)).not.toContain("email");
    expect(proxyApprenticeSelect(false)).not.toContain("email");
    expect(proxyApprenticeSelect(true)).toContain("email");
  });

  it("requires admin.users.manage before staff role or workspace changes", () => {
    expect(isStaffAccountAction("updateStaffProfile")).toBe(true);
    expect(isStaffAccountAction("createEnrolment")).toBe(false);
    expect(
      canMutateStaffAccounts(
        session({ permissions: [PERMISSIONS.RECORDS_PROXY_WRITE] }),
      ),
    ).toBe(false);
    expect(
      canMutateStaffAccounts(
        session({ permissions: [PERMISSIONS.ADMIN_USERS_MANAGE] }),
      ),
    ).toBe(true);
    expect(
      canMutateStaffAccounts(
        session({
          workspace: "employer",
          baseRole: "Employer",
          permissions: [PERMISSIONS.ADMIN_USERS_MANAGE],
        }),
      ),
    ).toBe(false);
  });

  it("stops an administrator promoting themselves or a superior", () => {
    expect(
      staffHierarchyError({
        actorId: "admin-1",
        actorRole: "Administrator",
        targetId: "admin-1",
        targetRole: "Administrator",
        requestedRole: "Owner",
      }),
    ).toMatch(/own account/);
    expect(
      staffHierarchyError({
        actorId: "admin-1",
        actorRole: "Administrator",
        targetId: "owner-1",
        targetRole: "Owner",
        requestedRole: "Tutor",
      }),
    ).toMatch(/rank/);
    expect(
      staffHierarchyError({
        actorId: "admin-1",
        actorRole: "Administrator",
        requestedRole: "Management",
      }),
    ).toMatch(/rank/);
    expect(
      staffHierarchyError({
        actorId: "admin-1",
        actorRole: "Administrator",
        requestedRole: "Tutor",
      }),
    ).toBeNull();
    expect(
      staffHierarchyError({
        actorId: "manager-1",
        actorRole: "Management",
        requestedRole: "Management",
      }),
    ).toMatch(/rank/);
    expect(
      staffHierarchyError({
        actorId: "manager-1",
        actorRole: "Management",
        targetId: "manager-2",
        targetRole: "Management",
        requestedRole: "Tutor",
      }),
    ).toMatch(/rank/);
  });
});
