import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import type { PortalAccount, WorkspaceId } from "@/lib/portal/types";
import { saveDirectAssignment, savePageBundle, saveWorkspaceDefault, clearWorkspaceDefault, deletePageBundle } from "./commands";
import { decidePageAccess, pageApiAllowed, pageGrantSnapshot, pageNavAllowed } from "./enforce";
import { pageById } from "./registry";
import { emptyPageAccessConfig, effectivePages } from "./model";
import { readPageAccessConfig, writePageAccessConfig } from "./store";
import { writeFileSync } from "node:fs";
import { includeStaffDirectory } from "@/app/api/admin/store/record-access";
import { pageGrantsFromStore } from "./enforce";

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

const owner = buildEffectiveSession(
  account({
    id: "owner-1",
    name: "Example Owner",
    workspace: "administration",
    baseRole: "Owner",
    permissions: [
      PERMISSIONS.ADMIN_USERS_MANAGE,
      PERMISSIONS.ADMIN_RECORDS_MANAGE,
      PERMISSIONS.ADMIN_WORKSPACE_VIEW,
      PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW,
      PERMISSIONS.REVIEWS_MANAGE,
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
  delete owner.pageGrants;
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
    const bundleId = config.bundles[0]?.id || "";
    config = deletePageBundle(config, admin, bundleId, directory);
    tutor.pageGrants = pageGrantSnapshot(config, tutor.account);
    expect(decidePageAccess(tutor, "/staff/programme-delivery").edit).toBe(true);
    expect(effectivePages(config, { id: "tutor-1", workspace: "staff" }).find((item) => item.page.id === "staff.delivery")?.origins).toEqual([
      "direct assignment",
    ]);
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
    const saved = saveWorkspaceDefault(emptyPageAccessConfig(), owner, "administration", [
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
    let config = saveWorkspaceDefault(emptyPageAccessConfig(), owner, "administration", [
      { pageId: "records.store", level: "read" },
    ]);
    writePageAccessConfig(config);
    owner.pageGrants = pageGrantSnapshot(config, owner.account);
    expect(pageApiAllowed(owner, "/api/admin/store", "edit")).toEqual({
      ok: false,
      error: "Page access does not allow this action.",
    });
    expect(() => clearWorkspaceDefault(config, owner, "administration")).toThrow(/widen access/);
    config = clearWorkspaceDefault(config, owner, "administration", true);
    writePageAccessConfig(config);
    owner.pageGrants = pageGrantSnapshot(config, owner.account);
    expect(pageApiAllowed(owner, "/api/admin/store", "edit").ok).toBe(true);
    expect(decidePageAccess(admin, "/staff-permissions").enforced).toBe(false);
    expect(decidePageAccess(admin, "/api/staff-page-access").enforced).toBe(false);
  });

  it("denies an unregistered route once the workspace map is on, and refuses a peer", () => {
    const config = saveWorkspaceDefault(emptyPageAccessConfig(), owner, "administration", [
      { pageId: "administration.dashboard", level: "read" },
    ]);
    owner.pageGrants = pageGrantSnapshot(config, owner.account);
    expect(decidePageAccess(owner, "/administration/not-a-real-page")).toMatchObject({
      enforced: true,
      read: false,
      edit: false,
    });
    expect(() =>
      saveDirectAssignment(
        emptyPageAccessConfig(),
        buildEffectiveSession(
          account({
            id: "manager-1",
            workspace: "management",
            baseRole: "Management",
            permissions: [PERMISSIONS.ADMIN_USERS_MANAGE, PERMISSIONS.ADMIN_RECORDS_MANAGE],
          }),
          [],
        ),
        "peer-1",
        [],
        [{ id: "peer-1", name: "Other Manager", role: "Management", workspace: "management" }],
      ),
    ).toThrow(/rank/);
    expect(() =>
      saveWorkspaceDefault(emptyPageAccessConfig(), admin, "administration", [
        { pageId: "administration.dashboard", level: "read" },
      ]),
    ).toThrow(/own workspace/);
  });

  it("keeps Reviews saves behind page Edit and does not treat records.manage as Edit", () => {
    const config = saveWorkspaceDefault(emptyPageAccessConfig(), owner, "administration", [
      { pageId: "reviews.assistant", level: "read" },
      { pageId: "reviews.api.state", level: "read" },
    ]);
    const reader = buildEffectiveSession(
      account({
        id: "office-1",
        workspace: "administration",
        baseRole: "Administrator",
        permissions: [PERMISSIONS.ADMIN_RECORDS_MANAGE, PERMISSIONS.REVIEWS_MANAGE],
      }),
      [],
    );
    reader.pageGrants = pageGrantSnapshot(config, reader.account);
    expect(pageApiAllowed(reader, "/api/reviews-assistant/state", "read").ok).toBe(true);
    expect(pageApiAllowed(reader, "/api/reviews-assistant/state", "edit")).toEqual({
      ok: false,
      error: "Page access does not allow this action.",
    });
    expect(pageApiAllowed(reader, "/reviews/assistant", "edit").ok).toBe(false);
    expect(pageApiAllowed(reader, "/api/reviews-assistant/state", "edit").ok).toBe(false);
    expect(pageApiAllowed(reader, "/api/reviews-assistant/review-attachment", "read").ok).toBe(true);
    const queueOnly = buildEffectiveSession(
      account({
        id: "office-2",
        workspace: "administration",
        baseRole: "Administrator",
        permissions: [PERMISSIONS.ADMIN_RECORDS_MANAGE, PERMISSIONS.REVIEWS_MANAGE, PERMISSIONS.ADMIN_USERS_MANAGE],
      }),
      [],
    );
    queueOnly.pageGrants = pageGrantSnapshot(
      saveWorkspaceDefault(emptyPageAccessConfig(), owner, "administration", [
        { pageId: "reviews.queue", level: "edit" },
        { pageId: "records.store", level: "read" },
      ]),
      queueOnly.account,
    );
    expect(pageApiAllowed(queueOnly, "/api/reviews-assistant/state", "edit").ok).toBe(false);
    expect(includeStaffDirectory(queueOnly)).toBe(false);
    expect(pageById("reviews.api.state")).toBeUndefined();
  });

  it("treats a missing page-access file as unconfigured and a corrupt file as closed", async () => {
    expect(readPageAccessConfig().workspaceDefaults).toEqual([]);
    expect((await pageGrantsFromStore(admin.account)).configured).toBe(false);
    writeFileSync(process.env.STAFF_PAGE_ACCESS_FILE || "", "{");
    expect(await pageGrantsFromStore(admin.account)).toEqual({
      configured: true,
      readable: [],
      editable: [],
    });
    expect(decidePageAccess({ ...admin, pageGrants: await pageGrantsFromStore(admin.account) }, "/administration/dashboard").read).toBe(false);
  });

  it("closes access when production has no durable page-access store", async () => {
    const previousDatabase = process.env.REVIEW_DATABASE_URL;
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.VERCEL = "1";
    process.env.STAFF_PAGE_ACCESS_STORE = "file";
    delete process.env.REVIEW_DATABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(await pageGrantsFromStore(admin.account)).toEqual({
      configured: true,
      readable: [],
      editable: [],
    });
    const learner = buildEffectiveSession(
      account({ workspace: "apprentice", baseRole: "Apprentice", permissions: [] }),
      [],
    );
    expect((await pageGrantsFromStore(learner.account)).configured).toBe(false);
    delete process.env.VERCEL;
    delete process.env.STAFF_PAGE_ACCESS_STORE;
    if (previousDatabase) process.env.REVIEW_DATABASE_URL = previousDatabase;
    if (previousUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey) process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
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
