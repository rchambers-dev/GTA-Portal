import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canManageTemporaryPassword, canReadProfile } from "./profile-access";

const root = join(process.cwd(), "src/app/api/admin/store/staff-handlers.ts");
const migration = join(
  process.cwd(),
  "supabase/migrations/20261126130000_portal_001_profile_credentials.sql",
);

describe("profile read rules", () => {
  const apprentice = { baseRole: "Apprentice", workspace: "apprentice" };
  const employer = { baseRole: "Employer", workspace: "employer" };
  const tutor = { baseRole: "Tutor", workspace: "staff" };

  it("lets someone read their own row", () => {
    expect(canReadProfile({
      readerId: "me",
      targetId: "me",
      reader: apprentice,
      targetIsCurrentTutor: false,
    })).toBe(true);
  });

  it("lets staff read every row", () => {
    expect(canReadProfile({
      readerId: "tutor",
      targetId: "someone-else",
      reader: tutor,
      targetIsCurrentTutor: false,
    })).toBe(true);
  });

  it("lets an apprentice read only their current tutor besides themselves", () => {
    expect(canReadProfile({
      readerId: "learner",
      targetId: "tutor",
      reader: apprentice,
      targetIsCurrentTutor: true,
    })).toBe(true);
    expect(canReadProfile({
      readerId: "learner",
      targetId: "other-staff",
      reader: apprentice,
      targetIsCurrentTutor: false,
    })).toBe(false);
  });

  it("does not let an employer read other people", () => {
    expect(canReadProfile({
      readerId: "employer",
      targetId: "tutor",
      reader: employer,
      targetIsCurrentTutor: false,
    })).toBe(false);
  });
});

describe("temporary password access", () => {
  it("requires admin.users.manage", () => {
    expect(canManageTemporaryPassword(["admin.records.manage"])).toBe(false);
    expect(canManageTemporaryPassword(["admin.users.manage"])).toBe(true);
    expect(canManageTemporaryPassword(undefined)).toBe(false);
  });

  it("stores the password on profile_credentials, not profiles", () => {
    const source = readFileSync(root, "utf8");
    expect(source).toContain('.from("profile_credentials")');
    expect(source).not.toContain("temporary_password: temporaryPassword");
    expect(source).not.toContain('.update({ temporary_password: password })');
    expect(source).not.toContain("temporary_password,");
    const sql = readFileSync(migration, "utf8");
    expect(sql).toContain("revoke all on table public.profiles from public, anon");
    expect(sql).toContain("grant select on table public.profiles to authenticated");
    expect(sql).toContain("drop policy if exists profiles_select_authenticated");
    expect(sql).toContain("revoke all on table public.profile_credentials from public, anon, authenticated");
  });
});
