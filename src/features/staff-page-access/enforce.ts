import type { EffectiveSession, PageGrantSnapshot } from "@/lib/portal/types";
import { effectivePages, isWorkspaceConfigured, type PageAccessConfig } from "./model";
import { matchPortalPage } from "./registry";

export type PageDecision = {
  enforced: boolean;
  read: boolean;
  edit: boolean;
  pageId: string | null;
};

export function pageGrantSnapshot(
  config: PageAccessConfig,
  account: { id: string; workspace: EffectiveSession["account"]["workspace"] },
): PageGrantSnapshot {
  if (!isWorkspaceConfigured(config, account.workspace)) {
    return { configured: false, readable: [], editable: [] };
  }
  const pages = effectivePages(config, account);
  return {
    configured: true,
    readable: pages.map((item) => item.page.id),
    editable: pages.filter((item) => item.level === "edit").map((item) => item.page.id),
  };
}

export function decidePageAccess(session: EffectiveSession, pathname: string): PageDecision {
  if (pathname.startsWith("/staff-permissions")) {
    return { enforced: false, read: true, edit: false, pageId: null };
  }
  const grants = session.pageGrants;
  if (!grants?.configured) {
    return { enforced: false, read: true, edit: true, pageId: null };
  }
  const page = matchPortalPage(pathname, session.account.workspace);
  if (!page) return { enforced: false, read: true, edit: true, pageId: null };
  return {
    enforced: true,
    read: grants.readable.includes(page.id),
    edit: grants.editable.includes(page.id),
    pageId: page.id,
  };
}

export function pageNavAllowed(session: EffectiveSession, href: string): boolean {
  const decision = decidePageAccess(session, href);
  return !decision.enforced || decision.read;
}

export function pageApiAllowed(
  session: EffectiveSession,
  pathname: string,
  mode: "read" | "edit",
): { ok: true } | { ok: false; error: string } {
  const decision = decidePageAccess(session, pathname);
  if (!decision.enforced) return { ok: true };
  const allowed = mode === "edit" ? decision.edit : decision.read;
  if (allowed) return { ok: true };
  return { ok: false, error: "Page access does not allow this action." };
}
