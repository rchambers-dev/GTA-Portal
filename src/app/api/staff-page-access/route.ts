import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { canEditPageAccess } from "@/features/staff-page-access/authority";
import {
  clearDirectAssignment,
  clearWorkspaceDefault,
  deletePageBundle,
  PageAccessCommandError,
  saveDirectAssignment,
  savePageBundle,
  saveWorkspaceDefault,
} from "@/features/staff-page-access/commands";
import { loadStaffDirectory } from "@/features/staff-page-access/directory";
import { effectivePages } from "@/features/staff-page-access/model";
import { PORTAL_PAGES, pagesForWorkspace } from "@/features/staff-page-access/registry";
import { readPageAccessConfig, writePageAccessConfig } from "@/features/staff-page-access/store";
import type { WorkspaceId } from "@/lib/portal/types";

export const runtime = "nodejs";

async function editorOrResponse() {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!canEditPageAccess(session)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  return session;
}

function publicPages() {
  return PORTAL_PAGES.map((page) => ({
    id: page.id,
    label: page.label,
    workspaces: page.workspaces,
    editable: page.editable,
    requiredPermission: page.requiredPermission,
    sensitivity: page.sensitivity ?? null,
  }));
}

export async function GET() {
  const session = await editorOrResponse();
  if (session instanceof NextResponse) return session;
  const config = readPageAccessConfig();
  const directory = await loadStaffDirectory();
  return NextResponse.json({
    config,
    pages: publicPages(),
    directory,
    actorId: session.account.id,
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
      administration: pagesForWorkspace("administration").map((page) => page.id),
      management: pagesForWorkspace("management").map((page) => page.id),
      staff: pagesForWorkspace("staff").map((page) => page.id),
      quality: pagesForWorkspace("quality").map((page) => page.id),
      safeguarding: pagesForWorkspace("safeguarding").map((page) => page.id),
    },
  });
}

export async function POST(request: Request) {
  const session = await editorOrResponse();
  if (session instanceof NextResponse) return session;
  const body = (await request.json()) as {
    action?: string;
    workspaceId?: WorkspaceId;
    grants?: { pageId: string; level: "read" | "edit" }[];
    bundleId?: string;
    name?: string;
    staffIds?: string[];
    staffId?: string;
  };
  const directory = await loadStaffDirectory();
  const config = readPageAccessConfig();
  try {
    let next = config;
    if (body.action === "saveWorkspace" && body.workspaceId) {
      next = saveWorkspaceDefault(config, session, body.workspaceId, body.grants ?? []);
    } else if (body.action === "clearWorkspace" && body.workspaceId) {
      next = clearWorkspaceDefault(config, session, body.workspaceId);
    } else if (body.action === "saveBundle") {
      next = savePageBundle(
        config,
        session,
        {
          id: body.bundleId,
          name: body.name || "",
          grants: body.grants ?? [],
          staffIds: body.staffIds ?? [],
        },
        directory,
      );
    } else if (body.action === "deleteBundle" && body.bundleId) {
      next = deletePageBundle(config, session, body.bundleId);
    } else if (body.action === "saveDirect" && body.staffId) {
      next = saveDirectAssignment(config, session, body.staffId, body.grants ?? [], directory);
    } else if (body.action === "clearDirect" && body.staffId) {
      next = clearDirectAssignment(config, session, body.staffId, directory);
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    writePageAccessConfig(next);
    return NextResponse.json({ ok: true, config: next });
  } catch (error) {
    if (error instanceof PageAccessCommandError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "An error occurred." }, { status: 500 });
  }
}
