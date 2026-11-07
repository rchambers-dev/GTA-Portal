import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import type { PortalAccount, WorkspaceId } from "@/lib/portal/types";
import { saveDirectAssignment, savePageBundle, saveWorkspaceDefault, clearWorkspaceDefault } from "./commands";
import { decidePageAccess, pageApiAllowed, pageGrantSnapshot, pageNavAllowed } from "./enforce";
import { emptyPageAccessConfig, effectivePages } from "./model";
import { readPageAccessConfig, writePageAccessConfig } from "./store";

function account(input: {
  id?: string;
  name?: string;
  workspace: WorkspaceId;
  baseRole: string;
  permissions: string[];
}): PortalAccount {
  return {
    id: input.id ?? "actor-1",
    name: input.name ?? "Admin Example",
    initials: "AE",
    email: "admin@example.test",
    baseRole: input.baseRole,
    responsibilities: [],
    workspace: input.workspace,
    permissions: input.permissions,
  };
}

const admin = buildEffectiveSession(
  account({
    workspace: "administration",
    baseRole: "Administrator",
    permissions: [
      PERMISSIONS.ADMIN_USERS_MANAGE,
      PERMISSIONS.ADMIN_RECORDS_MANAGE,
      PERMISSIONS.ADMIN_WORKSPACE_VIEW,
      PERMISSIONS.RECORDS_PROXY_WRITE,
      PERMISSIONS.LIFECYCLE_KANBAN_VIEW,
      PERMISSIONS.MODULES_DELIVER,
    ],
  }),
  [],
);

const tutor = buildEffectiveSession(
  account({
    id: "tutor-1",
    name: "Example Tutor",
    workspace: "staff",
    baseRole: "Tutor",
    permissions: [PERMISSIONS.MODULES_DELIVER, PERMISSIONS.STAFF_WORKSPACE_VIEW, PERMISSIONS.REVIEWS_MANAGE],
  }),
  [],
);

const directory = [
  { id: "tutor-1", name: "Example Tutor", role: "Tutor", workspace: "staff" as const },
  { id: "actor-1", name: "Admin Example", role: "Administrator", workspace: "administration" as const },
];

let dir = "";

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "page-access-"));
  process.env.STAFF_PAGE_ACCESS_FILE = path.join(dir, "config.json");
  delete admin.pageGrants;
  delete tutor.pageGrants;
});

afterEach(() => {
  delete process.env.STAFF_PAGE_ACCESS_FILE;
  rmSync(dir, { recursive: true, force: true });
});

describe("staff page access", () => {
  it("leaves current access in place until a workspace default is saved", () => {
    expect(decidePageAccess(tutor, "/staff/programme-delivery").enforced).toBe(false);
    expect(pageNavAllowed(tutor, "/staff/programme-delivery")).toBe(true);
    expect(pageApiAllowed(admin, "/api/admin/store", "edit").ok).toBe(true);
  });

  it("adds workspace, bundle, and direct Read/Edit without a deny rule", () => {
    let config = emptyPageAccessConfig();
    config = saveWorkspaceDefault(config, admin, "staff", [
      { pageId: "staff.lifecycle", level: "read" },
      { pageId: "missing.page", level: "edit" },
    ]);
    config = savePageBundle(
      config,
      admin,
      { name: "Delivery readers", grants: [{ pageId: "staff.delivery", level: "read" }], staffIds: ["tutor-1"] },
      directory,
    );
    config = saveDirectAssignment(
      config,
      admin,
      "tutor-1",
      [{ pageId: "staff.delivery", level: "edit" }],
      directory,
    );
    writePageAccessConfig(config);
    tutor.pageGrants = pageGrantSnapshot(config, tutor.account);
    const pages = effectivePages(readPageAccessConfig(), { id: "tutor-1", workspace: "staff" });
    const delivery = pages.find((item) => item.page.id === "staff.delivery");
    expect(delivery?.level).toBe("edit");
    expect(delivery?.origins).toEqual(["page bundle: Delivery readers", "direct assignment"]);
    expect(pages.some((item) => item.page.id === "missing.page")).toBe(false);
    expect(decidePageAccess(tutor, "/staff/programme-delivery/block1")).toMatchObject({
      enforced: true,
      read: true,
      edit: true,
    });
    expect(decidePageAccess(tutor, "/reviews").read).toBe(false);
    expect(pageNavAllowed(tutor, "/reviews?from=tutor")).toBe(false);
  });

  it("refuses self assignment, apprentice targets, and edit on a read-only page", () => {
    expect(() =>
      saveDirectAssignment(emptyPageAccessConfig(), admin, "actor-1", [], directory),
    ).toThrow(/yourself/);
    expect(() =>
      savePageBundle(
        emptyPageAccessConfig(),
        admin,
        {
          name: "Learners",
          grants: [],
          staffIds: ["learner-1"],
        },
        [{ id: "learner-1", name: "Example Learner", role: "Apprentice", workspace: "apprentice" }],
      ),
    ).toThrow(/Apprentice/);
    const saved = saveWorkspaceDefault(emptyPageAccessConfig(), admin, "administration", [
      { pageId: "administration.dashboard", level: "edit" },
    ]);
    expect(saved.workspaceDefaults[0]?.grants).toEqual([
      { pageId: "administration.dashboard", level: "read" },
    ]);
  });

  it("does not let reviews.manage or proxy write edit the page map, and clearing restores legacy access", () => {
    const proxyOnly = buildEffectiveSession(
      account({
        workspace: "administration",
        baseRole: "Administrator",
        permissions: [PERMISSIONS.RECORDS_PROXY_WRITE, PERMISSIONS.REVIEWS_MANAGE],
      }),
      [],
    );
    expect(() => saveWorkspaceDefault(emptyPageAccessConfig(), proxyOnly, "administration", [])).toThrow(
      /Access denied/,
    );
    let config = saveWorkspaceDefault(emptyPageAccessConfig(), admin, "administration", [
      { pageId: "records.store", level: "read" },
    ]);
    writePageAccessConfig(config);
    admin.pageGrants = pageGrantSnapshot(config, admin.account);
    expect(pageApiAllowed(admin, "/api/admin/store", "edit")).toEqual({
      ok: false,
      error: "Page access does not allow this action.",
    });
    config = clearWorkspaceDefault(config, admin, "administration");
    writePageAccessConfig(config);
    admin.pageGrants = pageGrantSnapshot(config, admin.account);
    expect(pageApiAllowed(admin, "/api/admin/store", "edit").ok).toBe(true);
    expect(decidePageAccess(admin, "/staff-permissions").enforced).toBe(false);
  });

  it("refuses a records page from someone who does not hold that capability", () => {
    const usersOnly = buildEffectiveSession(
      account({
        workspace: "administration",
        baseRole: "Administrator",
        permissions: [PERMISSIONS.ADMIN_USERS_MANAGE, PERMISSIONS.ADMIN_WORKSPACE_VIEW],
      }),
      [],
    );
    expect(() =>
      saveWorkspaceDefault(emptyPageAccessConfig(), usersOnly, "administration", [
        { pageId: "records.store", level: "edit" },
      ]),
    ).toThrow(/admin\.records\.manage/);
  });
});
