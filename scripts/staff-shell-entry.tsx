import { createRoot } from "react-dom/client";
import "../src/styles/globals.css";
import shell from "../src/shell/PortalShell.module.css";
import { StaffPermissionsScreen } from "../src/features/staff-page-access/StaffPermissionsScreen";

const editorId = "11111111-1111-4111-8111-111111111111";
const tutorId = "22222222-2222-4222-8222-222222222222";
const payload = {
  version: 1,
  actorId: editorId,
  config: {
    workspaceDefaults: [],
    bundles: [],
    direct: [],
  },
  pages: [
    {
      id: "staff.dashboard",
      label: "Staff dashboard",
      workspaces: ["staff", "administration"],
      editable: false,
      requiredPermission: "staff.workspace.view",
      sensitivity: null,
    },
    {
      id: "reviews.assistant",
      label: "Review Assistant",
      workspaces: ["staff", "administration"],
      editable: true,
      requiredPermission: "reviews.manage",
      sensitivity: null,
    },
  ],
  directory: [
    { id: editorId, name: "Synthetic Editor", role: "Owner", workspace: "administration" },
    { id: tutorId, name: "Synthetic Tutor", role: "Tutor", workspace: "staff" },
  ],
  effective: [
    { staffId: editorId, configured: false, pages: [] },
    { staffId: tutorId, configured: false, pages: [] },
  ],
};

window.fetch = async (input, init) => {
  const url = String(input);
  if (!url.includes("/api/staff-page-access")) return new Response("missing", { status: 404 });
  if (init?.method === "POST") {
    const body = JSON.parse(String(init.body || "{}")) as { action?: string; grants?: unknown[]; name?: string };
    if (body.action === "saveWorkspace") {
      payload.config.workspaceDefaults = [{ workspaceId: "staff", grants: body.grants as [] }];
      payload.effective[1].configured = true;
      payload.effective[1].pages = [
        { pageId: "reviews.assistant", label: "Review Assistant", level: "read", origins: ["workspace default"] },
      ];
    }
    if (body.action === "saveBundle") {
      payload.config.bundles = [{ id: "bundle-1", name: body.name || "Bundle", grants: body.grants as [], staffIds: [tutorId] }];
    }
    payload.version += 1;
    return Response.json({ ok: true, version: payload.version, config: payload.config });
  }
  return Response.json(payload);
};

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <div className={shell.shell}>
      <aside className="shell-rail" aria-label="Portal navigation">Portal</aside>
      <div className={shell.main}>
        <div className={shell.content}>
          <StaffPermissionsScreen />
        </div>
      </div>
    </div>
  );
}
