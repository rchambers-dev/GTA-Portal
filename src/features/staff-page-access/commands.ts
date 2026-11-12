import { randomUUID } from "node:crypto";
import type { WorkspaceId } from "@/lib/portal/types";
import type { EffectiveSession } from "@/lib/portal/types";
import { assignmentTargetError, canEditPageAccess, grantsActorMayAssign } from "./authority";
import {
  normaliseGrants,
  type DirectPageAssignment,
  type PageAccessConfig,
  type PageBundle,
  type PageGrant,
  type StaffPerson,
  type WorkspacePageDefault,
} from "./model";
import { pagesForWorkspace } from "./registry";
import { roleRank } from "@/features/administration/domain/account-access";

export class PageAccessCommandError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function assertEditor(session: EffectiveSession) {
  if (!canEditPageAccess(session)) {
    throw new PageAccessCommandError("Access denied.", 403);
  }
}

const WORKSPACE_RANK: Record<string, number> = {
  staff: 35,
  quality: 40,
  safeguarding: 40,
  administration: 60,
  management: 80,
};

function assertWorkspaceMapAuthority(session: EffectiveSession, workspaceId: WorkspaceId) {
  if (roleRank(session.account.baseRole) >= 100) return;
  if (session.account.workspace === workspaceId) {
    throw new PageAccessCommandError(
      "You cannot change the page map for your own workspace.",
      403,
    );
  }
  if ((WORKSPACE_RANK[workspaceId] ?? 100) >= roleRank(session.account.baseRole)) {
    throw new PageAccessCommandError(
      "You cannot change a page map that applies to your rank or higher.",
      403,
    );
  }
}

function assertGrants(session: EffectiveSession, grants: PageGrant[]) {
  const refusal = grantsActorMayAssign(session, grants);
  if (refusal) throw new PageAccessCommandError(refusal, 403);
}

function assertTargets(session: EffectiveSession, staffIds: string[], directory: StaffPerson[]) {
  for (const staffId of staffIds) {
    const refusal = assignmentTargetError(
      session,
      directory.find((person) => person.id === staffId),
    );
    if (refusal) throw new PageAccessCommandError(refusal, 403);
  }
}

export function saveWorkspaceDefault(
  config: PageAccessConfig,
  session: EffectiveSession,
  workspaceId: WorkspaceId,
  grants: PageGrant[],
): PageAccessConfig {
  assertEditor(session);
  if (workspaceId === "apprentice" || workspaceId === "employer") {
    throw new PageAccessCommandError("Apprentice and Employer workspaces are not configured here.", 403);
  }
  const cleaned = normaliseGrants(grants);
  assertGrants(session, cleaned);
  assertWorkspaceMapAuthority(session, workspaceId);
  const next: WorkspacePageDefault = {
    workspaceId,
    configured: true,
    grants: cleaned,
    updatedAt: new Date().toISOString(),
    updatedBy: session.account.id,
  };
  return {
    ...config,
    workspaceDefaults: [
      ...config.workspaceDefaults.filter((item) => item.workspaceId !== workspaceId),
      next,
    ],
  };
}

export function pagesRestoredByClear(config: PageAccessConfig, workspaceId: WorkspaceId) {
  const saved = config.workspaceDefaults.find((item) => item.workspaceId === workspaceId);
  if (!saved) return [];
  const granted = new Set(saved.grants.map((grant) => grant.pageId));
  return pagesForWorkspace(workspaceId)
    .filter((page) => !granted.has(page.id))
    .map((page) => page.label);
}

export function clearWorkspaceDefault(
  config: PageAccessConfig,
  session: EffectiveSession,
  workspaceId: WorkspaceId,
  confirmWiden = false,
): PageAccessConfig {
  assertEditor(session);
  assertWorkspaceMapAuthority(session, workspaceId);
  const restored = pagesRestoredByClear(config, workspaceId);
  if (restored.length > 0 && !confirmWiden) {
    throw new PageAccessCommandError(
      `Clear deletes only this workspace page map and restores role-baseline access. It can widen access to: ${restored.join(", ")}. Confirm that widening before clearing. Page bundles and direct assignments stay.`,
    );
  }
  return {
    ...config,
    workspaceDefaults: config.workspaceDefaults.filter((item) => item.workspaceId !== workspaceId),
  };
}

export function savePageBundle(
  config: PageAccessConfig,
  session: EffectiveSession,
  input: { id?: string; name: string; grants: PageGrant[]; staffIds: string[] },
  directory: StaffPerson[],
): PageAccessConfig {
  assertEditor(session);
  const name = input.name.trim();
  if (!name) throw new PageAccessCommandError("A page bundle needs a name.");
  const grants = normaliseGrants(input.grants);
  assertGrants(session, grants);
  const staffIds = [...new Set(input.staffIds)];
  const previous = config.bundles.find((item) => item.id === input.id);
  assertTargets(session, [...new Set([...(previous?.staffIds ?? []), ...staffIds])], directory);
  const bundle: PageBundle = {
    id: input.id || randomUUID(),
    name,
    grants,
    staffIds,
  };
  const exists = config.bundles.some((item) => item.id === bundle.id);
  return {
    ...config,
    bundles: exists
      ? config.bundles.map((item) => (item.id === bundle.id ? bundle : item))
      : [...config.bundles, bundle],
  };
}

export function deletePageBundle(
  config: PageAccessConfig,
  session: EffectiveSession,
  bundleId: string,
  directory: StaffPerson[],
): PageAccessConfig {
  assertEditor(session);
  const previous = config.bundles.find((item) => item.id === bundleId);
  assertTargets(session, previous?.staffIds ?? [], directory);
  return { ...config, bundles: config.bundles.filter((item) => item.id !== bundleId) };
}

export function saveDirectAssignment(
  config: PageAccessConfig,
  session: EffectiveSession,
  staffId: string,
  grants: PageGrant[],
  directory: StaffPerson[],
): PageAccessConfig {
  assertEditor(session);
  const cleaned = normaliseGrants(grants);
  assertGrants(session, cleaned);
  assertTargets(session, [staffId], directory);
  const next: DirectPageAssignment = { staffId, grants: cleaned };
  return {
    ...config,
    direct: [...config.direct.filter((item) => item.staffId !== staffId), next],
  };
}

export function clearDirectAssignment(
  config: PageAccessConfig,
  session: EffectiveSession,
  staffId: string,
  directory: StaffPerson[],
): PageAccessConfig {
  assertEditor(session);
  assertTargets(session, [staffId], directory);
  return { ...config, direct: config.direct.filter((item) => item.staffId !== staffId) };
}
