import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import { canAccessRoute, isPublicPath } from "@/lib/permissions/route-access";
import { resolveWorkspaceStub } from "@/shell/workspaces/workspace-stubs";
import type { EffectiveSession } from "@/lib/portal/types";

function session(permissions: string[]): EffectiveSession {
  return {
    account: {
      id: "ada",
      name: "Ada",
      initials: "A",
      email: "ada@example.test",
      baseRole: "Tutor",
      responsibilities: [],
      workspace: "staff",
      permissions,
    },
    permissions,
    activeTemporaryAssignments: [],
    temporaryAccessLabels: [],
  };
}

describe("route access fails closed (DEV-227, DEV-234, DEV-235)", () => {
  const tutor = session([PERMISSIONS.STAFF_WORKSPACE_VIEW]);

  it("denies a path that is not in the route rules", () => {
    expect(canAccessRoute(tutor, "/somewhere-new")).toBe(false);
    expect(canAccessRoute(tutor, "/secret")).toBe(false);
  });

  it("still allows the login page and the public tutor-review form", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/tutor-review/one-time-token")).toBe(true);
    expect(canAccessRoute(tutor, "/login")).toBe(true);
  });

  it("keeps the stub pages behind their permissions", () => {
    expect(canAccessRoute(tutor, "/admin")).toBe(false);
    expect(canAccessRoute(tutor, "/reports")).toBe(false);
    expect(canAccessRoute(tutor, "/dashboard")).toBe(true);
    expect(canAccessRoute(session([PERMISSIONS.ADMIN_WORKSPACE_VIEW]), "/admin")).toBe(true);
    expect(canAccessRoute(session([PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW]), "/reports")).toBe(true);
  });

  it("returns no stub for an unknown workspace slug", () => {
    expect(resolveWorkspaceStub("staff", ["not-a-page"])).toBeNull();
    expect(resolveWorkspaceStub("staff", ["dashboard"])?.title).toBeTruthy();
  });
});
