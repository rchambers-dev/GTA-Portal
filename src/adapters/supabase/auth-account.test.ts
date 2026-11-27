import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { asWorkspaceId, toPortalAccount } from "./auth";

const user = { id: "user-1", email: "ada@example.test", user_metadata: {} } as User;

const profile = {
  id: "user-1",
  email: "ada@example.test",
  username: null,
  display_name: "Ada",
  base_role: "Tutor",
  workspace: "staff",
  permissions: [],
  responsibilities: [],
  department: null,
  department_scope: null,
  programme_scope: null,
  module_scope: null,
  linked_apprentice_id: null,
};

describe("auth account fails closed (PORTAL-017)", () => {
  it("does not treat a missing role as Owner", () => {
    expect(toPortalAccount(user, { ...profile, base_role: null })).toBeNull();
    expect(toPortalAccount(user, { ...profile, base_role: "  " })).toBeNull();
  });

  it("does not treat an unknown workspace as management", () => {
    expect(asWorkspaceId(null)).toBeNull();
    expect(asWorkspaceId("billing")).toBeNull();
    expect(toPortalAccount(user, { ...profile, workspace: "billing" })).toBeNull();
    expect(toPortalAccount(user, profile)?.workspace).toBe("staff");
  });
});
