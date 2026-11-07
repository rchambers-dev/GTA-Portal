import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApprenticesVisualPreview } from "./apprentices-visual-preview";
import { EmployersVisualPreview } from "./employers-visual-preview";
import {
  apprenticePreviewReducer,
  confirmationKey,
  employerPreviewReducer,
  initialApprenticePreviewState,
  initialEmployerPreviewState,
  visibleApprentices,
  visibleEmployers,
} from "./visual-preview-state";

describe("apprentices visual behaviour", () => {
  it("filters the list from the search box state and does not call fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const searched = apprenticePreviewReducer(initialApprenticePreviewState(), {
      type: "search",
      query: "jordan",
    });
    expect(visibleApprentices(searched).map((row) => row.fullName)).toEqual(["Jordan Example"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("opens and closes the add container and clears a local employer choice on cancel", () => {
    const opened = apprenticePreviewReducer(initialApprenticePreviewState(), { type: "toggle-add" });
    expect(opened.addOpen).toBe(true);
    const chosen = apprenticePreviewReducer(opened, {
      type: "set-employer",
      employerId: "example-motors",
    });
    expect(chosen.employerId).toBe("example-motors");
    const cancelled = apprenticePreviewReducer(chosen, { type: "cancel-add" });
    expect(cancelled.addOpen).toBe(false);
    expect(cancelled.employerId).toBe("");
    const closedByToggle = apprenticePreviewReducer(chosen, { type: "toggle-add" });
    expect(closedByToggle.addOpen).toBe(false);
  });

  it("keeps a chosen employer on the local row and still does not persist", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    let state = apprenticePreviewReducer(initialApprenticePreviewState(), { type: "toggle-add" });
    state = apprenticePreviewReducer(state, { type: "set-name", fullName: "Sam Example" });
    state = apprenticePreviewReducer(state, { type: "set-employer", employerId: "example-yard-co" });
    state = apprenticePreviewReducer(state, { type: "add-local" });
    const added = state.rows.find((row) => row.fullName === "Sam Example");
    expect(added?.employerId).toBe("example-yard-co");
    expect(state.notice).toBe("Not saved. Saving is disabled.");
    expect(state.addOpen).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("renders search, a closed add control, and apprentice rows without company phone or postcode", () => {
    const html = renderToStaticMarkup(createElement(ApprenticesVisualPreview));
    expect(html).toContain("EXAMPLE DATA");
    expect(html).toContain("Saving is disabled");
    expect(html).toContain("Search apprentices");
    expect(html).toContain("Add apprentice");
    expect(html).toContain("Alex Example");
    expect(html).toContain("Example Motors");
    expect(html).not.toContain("data-add-panel");
    expect(html).not.toContain("Phone number");
    expect(html).not.toContain(">Postcode<");
    expect(html).not.toContain("00000");
    expect(html).not.toContain("EX1 1EX");
  });

  it("renders the open add container with an employer selector and no company fields", () => {
    const html = renderToStaticMarkup(
      createElement(ApprenticesVisualPreview, {
        initialState: { ...initialApprenticePreviewState(), addOpen: true },
      }),
    );
    expect(html).toContain('data-add-panel="apprentice"');
    expect(html).toContain("Full name");
    expect(html).toContain("Example Yard Co");
    expect(html).toContain("Cancel");
    expect(html).not.toContain("Phone number");
    expect(html).not.toContain(">Postcode<");
  });
});

function addPillsSitBesideHeadings(html: string): boolean {
  const buttons = [...html.matchAll(/<button\b[^>]*data-entry-add="(site|manager)"[^>]*>/g)];
  if (buttons.length !== 2) return false;
  const classes = buttons.map((match) => match[0].match(/class="([^"]+)"/)?.[1]);
  if (!classes[0] || classes[0] !== classes[1]) return false;
  for (const kind of ["site", "manager"] as const) {
    const heading = html.split(`data-entry-heading="${kind}"`)[1]?.split(`data-entry-row="${kind}"`)[0] ?? "";
    if (!heading.includes(`data-entry-add="${kind}"`) || heading.includes("<input")) return false;
    const row = html.split(`data-entry-row="${kind}"`)[1]?.split(`data-entry-heading=`)[0] ?? "";
    if (row.includes(`data-entry-add="${kind}"`)) return false;
  }
  return true;
}

describe("employers visual behaviour", () => {
  it("searches by company postcode and keeps phone on the company", () => {
    const searched = employerPreviewReducer(initialEmployerPreviewState(), {
      type: "search",
      query: "EX2 2EX",
    });
    expect(visibleEmployers(searched).map((row) => row.name)).toEqual(["Example Yard Co"]);
    expect(searched.rows.every((row) => "phone" in row && "postcode" in row)).toBe(true);
  });

  it("opens, fills company phone and postcode, cancels, and does not write", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    let state = employerPreviewReducer(initialEmployerPreviewState(), { type: "toggle-add" });
    state = employerPreviewReducer(state, { type: "set-name", name: "Example Workshop" });
    state = employerPreviewReducer(state, { type: "set-phone", phone: "00000 300300" });
    state = employerPreviewReducer(state, { type: "set-postcode", postcode: "EX3 3EX" });
    state = employerPreviewReducer(state, {
      type: "set-site",
      id: state.sites[0].id,
      label: "Example bay",
    });
    state = employerPreviewReducer(state, {
      type: "set-manager",
      id: state.managers[0].id,
      label: "Example Lead",
    });
    const cancelled = employerPreviewReducer(state, { type: "cancel-add" });
    expect(cancelled.addOpen).toBe(false);
    expect(cancelled.phone).toBe("");
    expect(cancelled.sites.map((entry) => entry.label)).toEqual([""]);
    expect(cancelled.rows.some((row) => row.name === "Example Workshop")).toBe(false);
    const savedLocally = employerPreviewReducer(state, { type: "add-local" });
    const added = savedLocally.rows.find((row) => row.name === "Example Workshop");
    expect(added).toMatchObject({
      phone: "00000 300300",
      postcode: "EX3 3EX",
      sites: ["Example bay"],
      managers: ["Example Lead"],
    });
    expect(savedLocally.notice).toBe("Not saved. Saving is disabled.");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("renders company phone and postcode on the employer page only", () => {
    const html = renderToStaticMarkup(
      createElement(EmployersVisualPreview, {
        initialState: { ...initialEmployerPreviewState(), addOpen: true },
      }),
    );
    expect(html).toContain("EXAMPLE DATA");
    expect(html).toContain("Saving is disabled");
    expect(html).toContain("Add employer");
    expect(html).toContain("Phone number");
    expect(html).toContain("Postcode");
    expect(html).toContain("00000 100100");
    expect(html).toContain("EX1 1EX");
    expect(html).toContain("Example yard");
    expect(html).toContain("Example Manager");
    expect(html).toContain('aria-label="Add another site"');
    expect(html).toContain('aria-label="Add another manager"');
    expect(addPillsSitBesideHeadings(html)).toBe(true);
    expect(readFileSync(path.join(process.cwd(), "src/features/administration/screens/admin-pages.module.css"), "utf8")).toMatch(
      /\.entryAdd\s*\{[^}]*width:\s*1\.35rem;[^}]*height:\s*1\.35rem;/s,
    );
    expect(html).not.toContain("Are you sure?");
    expect(html).not.toContain("Add apprentice");
    expect(html).not.toContain("garage");
  });

  it("adds, edits, and removes extra sites and managers without a write", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    let state = employerPreviewReducer(initialEmployerPreviewState(), { type: "toggle-add" });
    state = employerPreviewReducer(state, { type: "set-name", name: "Example Workshop" });
    state = employerPreviewReducer(state, {
      type: "set-site",
      id: state.sites[0].id,
      label: "Example bay",
    });
    state = employerPreviewReducer(state, { type: "add-site" });
    state = employerPreviewReducer(state, {
      type: "set-site",
      id: state.sites[1].id,
      label: "Example ramp",
    });
    state = employerPreviewReducer(state, { type: "add-site" });
    state = employerPreviewReducer(state, {
      type: "set-site",
      id: state.sites[2].id,
      label: "Example store",
    });
    state = employerPreviewReducer(state, {
      type: "set-site",
      id: state.sites[0].id,
      label: "Example bay edited",
    });
    const removedSiteId = state.sites[1].id;
    state = employerPreviewReducer(state, { type: "remove-site", id: removedSiteId });
    state = employerPreviewReducer(state, {
      type: "set-manager",
      id: state.managers[0].id,
      label: "Example Lead",
    });
    state = employerPreviewReducer(state, { type: "add-manager" });
    state = employerPreviewReducer(state, {
      type: "set-manager",
      id: state.managers[1].id,
      label: "Example Deputy",
    });
    state = employerPreviewReducer(state, { type: "remove-manager", id: state.managers[0].id });
    const saved = employerPreviewReducer(state, { type: "add-local" });
    const added = saved.rows.find((row) => row.name === "Example Workshop");
    expect(added?.sites).toEqual(["Example bay edited", "Example store"]);
    expect(added?.managers).toEqual(["Example Deputy"]);
    expect(added?.sites).not.toContain("Example ramp");
    expect(added?.managers).not.toContain("Example Lead");
    expect(saved.notice).toBe("Not saved. Saving is disabled.");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    const html = renderToStaticMarkup(
      createElement(EmployersVisualPreview, {
        initialState: {
          ...initialEmployerPreviewState(),
          addOpen: true,
          sites: [
            { id: "site-1", label: "Example bay edited" },
            { id: "site-2", label: "Example store" },
          ],
          managers: [{ id: "manager-1", label: "Example Deputy" }],
          rows: [
            ...initialEmployerPreviewState().rows,
            {
              id: "local-employer-9",
              name: "Example Workshop",
              phone: "00000 300300",
              postcode: "EX3 3EX",
              sites: ["Example bay edited", "Example store"],
              managers: ["Example Deputy"],
            },
          ],
        },
      }),
    );
    expect(html).toContain('aria-label="Add another site"');
    expect(html).toContain('aria-label="Add another manager"');
    expect(html).toContain("Example bay edited, Example store");
    expect(html).toContain("Example Deputy");
    expect(html).toContain('aria-label="Remove site 2"');
    expect(html).toContain('aria-label="Remove manager 1"');
    expect(html).not.toContain("Example ramp");
    expect(html).toContain('value="Example bay edited"');
    expect(html).toContain('value="Example store"');
    expect(addPillsSitBesideHeadings(html)).toBe(true);
  });

  it("keeps every site and manager until removal is confirmed", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    let state = employerPreviewReducer(initialEmployerPreviewState(), { type: "toggle-add" });
    state = employerPreviewReducer(state, {
      type: "set-site",
      id: state.sites[0].id,
      label: "Example bay",
    });
    state = employerPreviewReducer(state, { type: "add-site" });
    state = employerPreviewReducer(state, {
      type: "set-site",
      id: state.sites[1].id,
      label: "Example ramp",
    });
    state = employerPreviewReducer(state, {
      type: "set-manager",
      id: state.managers[0].id,
      label: "Example Lead",
    });
    state = employerPreviewReducer(state, { type: "add-manager" });
    state = employerPreviewReducer(state, {
      type: "set-manager",
      id: state.managers[1].id,
      label: "Example Deputy",
    });
    const asked = employerPreviewReducer(state, {
      type: "request-remove",
      kind: "site",
      id: state.sites[1].id,
    });
    expect(asked.pendingRemove).toEqual({ kind: "site", id: state.sites[1].id });
    expect(asked.sites.map((entry) => entry.label)).toEqual(["Example bay", "Example ramp"]);
    expect(asked.managers.map((entry) => entry.label)).toEqual(["Example Lead", "Example Deputy"]);
    const kept = employerPreviewReducer(asked, { type: "cancel-remove" });
    expect(kept.pendingRemove).toBeNull();
    expect(kept.sites.map((entry) => entry.label)).toEqual(["Example bay", "Example ramp"]);
    expect(kept.managers.map((entry) => entry.label)).toEqual(["Example Lead", "Example Deputy"]);
    expect(confirmationKey("Escape")).toBe("cancel");
    expect(confirmationKey("Enter")).toBeNull();
    const askedAgain = employerPreviewReducer(kept, {
      type: "request-remove",
      kind: "manager",
      id: kept.managers[0].id,
    });
    const removed = employerPreviewReducer(askedAgain, { type: "confirm-remove" });
    expect(removed.pendingRemove).toBeNull();
    expect(removed.managers.map((entry) => entry.label)).toEqual(["Example Deputy"]);
    expect(removed.sites.map((entry) => entry.label)).toEqual(["Example bay", "Example ramp"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    const html = renderToStaticMarkup(
      createElement(EmployersVisualPreview, {
        initialState: {
          ...asked,
          addOpen: true,
        },
      }),
    );
    expect(html).toContain("Are you sure?");
    expect(html).toContain("Cancel");
    expect(html).toContain(">Remove<");
    expect(html).toContain('role="dialog"');
    expect(html).toContain('value="Example bay"');
    expect(html).toContain('value="Example ramp"');
    expect(html).toContain('value="Example Lead"');
    expect(html).toContain('value="Example Deputy"');
  });
});

describe("lookup route and menu", () => {
  const root = process.cwd();
  const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

  it("redirects the old lookup URL after the existing session guard", () => {
    const page = read("src/app/apprentices/page.tsx");
    expect(page).toContain("requireApprenticeWorkspaceAccess");
    expect(page).toContain('redirect("/administration/intake")');
    expect(page).toContain('redirect("/management/intake")');
    expect(page).not.toContain("ApprenticePackSearchScreen");
  });

  it("keeps one Apprentices label in each staff menu and names Employers", () => {
    const nav = read("src/shell/workspaces/resolve-navigation.ts");
    expect(nav).not.toContain("/apprentices?from=");
    expect(nav.match(/label: "Apprentices"/g)).toHaveLength(2);
    expect(nav).toContain('label: "Employers"');
    expect(nav).not.toContain("Employer Records");
    expect(nav).toContain('label: "Apprentice Enrolments"');
  });

  it("does not import a store or call the network from the preview screens", () => {
    const apprentice = read("src/features/administration/screens/apprentices-visual-preview.tsx");
    const employer = read("src/features/administration/screens/employers-visual-preview.tsx");
    for (const source of [apprentice, employer]) {
      expect(source).not.toMatch(/fetch\(|useAdminStore|supabase|createApprentice|createEmployer/);
    }
    expect(read("src/features/administration/screens/AdminEmployersScreen.tsx")).toContain(
      "export function AdminEmployersScreenLive",
    );
  });
});
