import { PERMISSIONS } from "../src/lib/permissions/capabilities";
import type { EffectiveSession, PortalAccount } from "../src/lib/portal/types";
import {
  saveDirectAssignment,
  savePageBundle,
  saveWorkspaceDefault,
} from "../src/features/staff-page-access/commands";
import { effectivePages, emptyPageAccessConfig, type PageAccessConfig } from "../src/features/staff-page-access/model";
import { PORTAL_PAGES, pagesForWorkspace } from "../src/features/staff-page-access/registry";
import type { WorkspaceId } from "../src/lib/portal/types";

const editorId = "11111111-1111-4111-8111-111111111111";
const tutorId = "22222222-2222-4222-8222-222222222222";

function account(input: Partial<PortalAccount> & Pick<PortalAccount, "id" | "name" | "baseRole" | "workspace" | "permissions">): PortalAccount {
  return {
    initials: "SF",
    email: "synthetic.fixture@example.test",
    responsibilities: [],
    ...input,
  };
}

const editorAccount = account({
  id: editorId,
  name: "Synthetic Editor",
  baseRole: "Owner",
  workspace: "administration",
  permissions: [
    PERMISSIONS.ADMIN_USERS_MANAGE,
    PERMISSIONS.ADMIN_RECORDS_MANAGE,
    PERMISSIONS.REVIEWS_MANAGE,
    PERMISSIONS.LIFECYCLE_KANBAN_VIEW,
    PERMISSIONS.MODULES_DELIVER,
    PERMISSIONS.STAFF_WORKSPACE_VIEW,
  ],
});

const tutorAccount = account({
  id: tutorId,
  name: "Synthetic Tutor",
  baseRole: "Tutor",
  workspace: "staff",
  permissions: [PERMISSIONS.REVIEWS_MANAGE, PERMISSIONS.STAFF_WORKSPACE_VIEW],
});

function session(person: PortalAccount, canEdit: boolean): EffectiveSession {
  return {
    account: canEdit ? person : { ...person, permissions: person.permissions.filter((item) => item !== PERMISSIONS.ADMIN_USERS_MANAGE) },
    permissions: canEdit ? person.permissions : person.permissions.filter((item) => item !== PERMISSIONS.ADMIN_USERS_MANAGE),
    activeTemporaryAssignments: [],
    temporaryAccessLabels: [],
  };
}

const directory = [
  { id: editorId, name: "Synthetic Editor", role: "Owner", workspace: "administration" as WorkspaceId },
  { id: tutorId, name: "Synthetic Tutor", role: "Tutor", workspace: "staff" as WorkspaceId },
];

let config: PageAccessConfig = emptyPageAccessConfig();
let version = 0;

function payload(actor: EffectiveSession) {
  return {
    version,
    actorId: actor.account.id,
    config,
    pages: PORTAL_PAGES.map((page) => ({
      id: page.id,
      label: page.label,
      workspaces: page.workspaces,
      editable: page.editable,
      requiredPermission: page.requiredPermission,
      sensitivity: page.sensitivity ?? null,
    })),
    directory,
    effective: directory.map((person) => ({
      staffId: person.id,
      configured: config.workspaceDefaults.some((item) => item.workspaceId === person.workspace),
      pages: effectivePages(config, person).map((item) => ({
        pageId: item.page.id,
        label: item.page.label,
        level: item.level,
        origins: item.origins,
      })),
    })),
    workspacePages: {
      staff: pagesForWorkspace("staff").map((page) => page.id),
      administration: pagesForWorkspace("administration").map((page) => page.id),
    },
  };
}

export function staffApi(method: string, body: Record<string, unknown>, canEdit: boolean) {
  const actor = session(editorAccount, canEdit);
  if (method === "GET") return { status: 200, body: payload(actor) };
  if (!canEdit) return { status: 403, body: { error: "Access denied." } };
  if (body.expectedVersion !== version) return { status: 409, body: { error: "Page access was saved by someone else. Reload and try again." } };
  try {
    if (body.action === "saveWorkspace") {
      config = saveWorkspaceDefault(config, actor, body.workspaceId as WorkspaceId, (body.grants as []) || []);
    } else if (body.action === "saveBundle") {
      config = savePageBundle(config, actor, {
        name: String(body.name || ""),
        grants: (body.grants as []) || [],
        staffIds: (body.staffIds as string[]) || [],
      }, directory);
    } else if (body.action === "saveDirect") {
      config = saveDirectAssignment(config, actor, String(body.staffId), (body.grants as []) || [], directory);
    } else {
      return { status: 400, body: { error: "Unknown action." } };
    }
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : "Could not save." } };
  }
  version += 1;
  return { status: 200, body: { ok: true, version, config } };
}
