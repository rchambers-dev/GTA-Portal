import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { getRedirectForDeniedRoute, getRequiredPermission } from "@/lib/permissions/route-access";
import type { EffectiveSession } from "@/lib/portal/types";

function session(workspace: EffectiveSession["account"]["workspace"], permissions: string[]): EffectiveSession {
  return {
    account: {
      id: "reiss",
      name: "Reiss Chambers",
      initials: "RC",
      email: "reisschambers@doncastergta.co.uk",
      baseRole: "Management",
      responsibilities: [],
      workspace,
      permissions,
    },
    permissions,
    activeTemporaryAssignments: [],
    temporaryAccessLabels: [],
  };
}

describe("reviews routes across workspaces", () => {
  it("leaves the public tutor review link outside the portal login rules", () => {
    expect(getRequiredPermission("/tutor-review/one-time-token")).toBeNull();
  });

  it("sends a Management account from the administration plan URL to the management plan page", () => {
    const management = session("management", [PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW, PERMISSIONS.ADMIN_RECORDS_MANAGE]);
    expect(getRedirectForDeniedRoute(management, "/administration/reviews/plan")).toBe("/management/reviews/plan");
    expect(getRedirectForDeniedRoute(management, "/administration/reviews/settings")).toBe("/management/reviews/settings");
  });

  it("sends an Administration account from the management plan URL to the administration plan page", () => {
    const administration = session("administration", [PERMISSIONS.ADMIN_WORKSPACE_VIEW, PERMISSIONS.ADMIN_RECORDS_MANAGE]);
    expect(getRedirectForDeniedRoute(administration, "/management/reviews/plan")).toBe("/administration/reviews/plan");
  });
});