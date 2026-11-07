import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApprenticesVisualPreview } from "./apprentices-visual-preview";
import { EmployersVisualPreview } from "./employers-visual-preview";
import {
  apprenticePreviewReducer,
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
    state = employerPreviewReducer(state, { type: "set-site", site: "Example bay" });
    state = employerPreviewReducer(state, { type: "set-manager", manager: "Example Lead" });
    const cancelled = employerPreviewReducer(state, { type: "cancel-add" });
    expect(cancelled.addOpen).toBe(false);
    expect(cancelled.phone).toBe("");
    expect(cancelled.rows.some((row) => row.name === "Example Workshop")).toBe(false);
    const savedLocally = employerPreviewReducer(state, { type: "add-local" });
    const added = savedLocally.rows.find((row) => row.name === "Example Workshop");
    expect(added).toMatchObject({
      phone: "00000 300300",
      postcode: "EX3 3EX",
      site: "Example bay",
      manager: "Example Lead",
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
    expect(html).not.toContain("Add apprentice");
    expect(html).not.toContain("garage");
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
