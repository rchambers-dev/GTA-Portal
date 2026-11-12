import type { WorkspaceId } from "@/lib/portal/types";
import { pageById, type PortalPage } from "./registry";

export type AccessLevel = "read" | "edit";

export type PageGrant = {
  pageId: string;
  level: AccessLevel;
};

export type WorkspacePageDefault = {
  workspaceId: WorkspaceId;
  configured: true;
  grants: PageGrant[];
  updatedAt: string;
  updatedBy: string;
};

export type PageBundle = {
  id: string;
  name: string;
  grants: PageGrant[];
  staffIds: string[];
};

export type DirectPageAssignment = {
  staffId: string;
  grants: PageGrant[];
};

export type PageAccessConfig = {
  workspaceDefaults: WorkspacePageDefault[];
  bundles: PageBundle[];
  direct: DirectPageAssignment[];
};

export type StaffPerson = {
  id: string;
  name: string;
  role: string;
  workspace: WorkspaceId;
};

export type EffectivePage = {
  page: PortalPage;
  level: AccessLevel;
  origins: string[];
};

export function emptyPageAccessConfig(): PageAccessConfig {
  return { workspaceDefaults: [], bundles: [], direct: [] };
}

export function stronger(left: AccessLevel | null, right: AccessLevel | null): AccessLevel | null {
  if (left === "edit" || right === "edit") return "edit";
  if (left === "read" || right === "read") return "read";
  return null;
}

function cleanGrants(grants: PageGrant[]): PageGrant[] {
  const byPage = new Map<string, AccessLevel>();
  for (const grant of grants) {
    const known = pageById(grant.pageId);
    if (!known) continue;
    const level: AccessLevel = grant.level === "edit" && known.editable ? "edit" : "read";
    byPage.set(grant.pageId, stronger(byPage.get(grant.pageId) ?? null, level) || "read");
  }
  return [...byPage.entries()].map(([pageId, level]) => ({ pageId, level }));
}

export function normaliseGrants(grants: PageGrant[]): PageGrant[] {
  return cleanGrants(grants);
}

export function isWorkspaceConfigured(config: PageAccessConfig, workspaceId: string): boolean {
  return config.workspaceDefaults.some((item) => item.workspaceId === workspaceId && item.configured);
}

export function effectivePages(
  config: PageAccessConfig,
  staff: { id: string; workspace: WorkspaceId },
): EffectivePage[] {
  if (!isWorkspaceConfigured(config, staff.workspace)) return [];
  const origins = new Map<string, { level: AccessLevel; origins: string[] }>();
  const add = (grants: PageGrant[], origin: string) => {
    for (const grant of cleanGrants(grants)) {
      const page = pageById(grant.pageId);
      if (!page?.workspaces.includes(staff.workspace)) continue;
      const current = origins.get(grant.pageId);
      const level = stronger(current?.level ?? null, grant.level) || "read";
      const nextOrigins = [...(current?.origins ?? []), origin];
      origins.set(grant.pageId, { level, origins: nextOrigins });
    }
  };
  const workspace = config.workspaceDefaults.find((item) => item.workspaceId === staff.workspace);
  add(workspace?.grants ?? [], "workspace default");
  for (const bundle of config.bundles) {
    if (!bundle.staffIds.includes(staff.id)) continue;
    add(bundle.grants, `page bundle: ${bundle.name}`);
  }
  const direct = config.direct.find((item) => item.staffId === staff.id);
  add(direct?.grants ?? [], "direct assignment");
  return [...origins.entries()].flatMap(([pageId, value]) => {
    const page = pageById(pageId);
    if (!page) return [];
    return [{ page, level: value.level, origins: value.origins }];
  });
}

export function levelForPage(
  config: PageAccessConfig,
  staff: { id: string; workspace: WorkspaceId },
  pageId: string,
): AccessLevel | null {
  return effectivePages(config, staff).find((item) => item.page.id === pageId)?.level ?? null;
}
