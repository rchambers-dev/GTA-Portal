import { describe, expect, it } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import type { PortalAccount } from "@/lib/portal/types";
import { canAuthorProgramme } from "./curriculum-authoring-access";
import { canUseTutorDeliveryApi } from "@/features/programme-delivery/domain/staff-delivery-access";

function account(input: {
  workspace: PortalAccount["workspace"];
  permissions: string[];
  baseRole?: string;
}): PortalAccount {
  return {
    id: "u1",
    name: "Test",
    initials: "T",
    email: "test@example.invalid",
    baseRole: input.baseRole || "Staff",
    responsibilities: [],
    workspace: input.workspace,
    permissions: input.permissions,
  };
}

const owner = buildEffectiveSession(
  account({
    workspace: "management",
    baseRole: "Management",
    permissions: ["management.workspace.view", "management.programme.setup"],
  }),
  [],
);

const tutor = buildEffectiveSession(
  account({
    workspace: "staff",
    baseRole: "Tutor",
    permissions: [
      "staff.workspace.view",
      "modules.deliver",
      "apprentices.assigned.view",
      "apprentice.workspace.view",
      "messages.view",
      "ai.use",
      "lifecycle.kanban.view",
    ],
  }),
  [],
);

const apprentice = buildEffectiveSession(
  account({
    workspace: "apprentice",
    baseRole: "Apprentice",
    permissions: ["apprentice.workspace.own", "apprentice.modules.view"],
  }),
  [],
);

describe("curriculum authoring access", () => {
  it("allows curriculum owners with both management permissions", () => {
    expect(canAuthorProgramme(owner)).toBe(true);
    expect(canUseTutorDeliveryApi(owner)).toBe(true);
  });

  it("denies tutors who only have delivery permissions", () => {
    expect(canAuthorProgramme(tutor)).toBe(false);
    expect(canUseTutorDeliveryApi(tutor)).toBe(true);
  });

  it("denies apprentices from authoring and tutor delivery APIs", () => {
    expect(canAuthorProgramme(apprentice)).toBe(false);
    expect(canUseTutorDeliveryApi(apprentice)).toBe(false);
  });

  it("does not treat workspace.view alone as authoring rights", () => {
    const viewOnly = buildEffectiveSession(
      account({
        workspace: "management",
        permissions: ["management.workspace.view"],
      }),
      [],
    );
    expect(canAuthorProgramme(viewOnly)).toBe(false);
  });

  it("does not treat programme.setup alone as authoring rights", () => {
    const setupOnly = buildEffectiveSession(
      account({
        workspace: "management",
        permissions: ["management.programme.setup"],
      }),
      [],
    );
    expect(canAuthorProgramme(setupOnly)).toBe(false);
  });
});
