import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import styles from "./admin-pages.module.css";
import { ApprenticesVisualPreview } from "./apprentices-visual-preview";
import { EmployersVisualPreview } from "./employers-visual-preview";
import {
  APPRENTICESHIPS,
  EMPLOYER_STATUSES,
  ENQUIRY_SOURCES,
  LEARNER_FIELD_ORDER,
  PREVIEW_STAFF_OPTIONS,
  RELEASE_DAYS,
  RESPONSIVENESS_OPTIONS,
  TRAINING_SITES,
} from "./learner-entry-options";
import {
  apprenticePreviewReducer,
  confirmationKey,
  employerPreviewReducer,
  initialApprenticePreviewState,
  initialEmployerPreviewState,
  nextModalFocus,
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
      type: "set-entry",
      field: "employerId",
      value: "example-motors",
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
    state = apprenticePreviewReducer(state, { type: "set-entry", field: "firstName", value: "Sam" });
    state = apprenticePreviewReducer(state, { type: "set-entry", field: "lastName", value: "Example" });
    state = apprenticePreviewReducer(state, { type: "set-entry", field: "employerId", value: "example-yard-co" });
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
    expect(html).toContain("First name");
    expect(html).toContain("Last name");
    expect(html).toContain("Manual entry");
    expect(html).toContain("Add apprentice");
    expect(html).toContain("Notes");
    expect(html).toContain("<textarea");
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain("Not linked");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Phone number");
    expect(html).not.toContain("Postcode");
    expect(html).toContain("Cancel");
    expect(html).not.toContain("createLearner");
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

  it("allows the manager or a different person as the employer contact", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    let state = employerPreviewReducer(initialEmployerPreviewState(), { type: "toggle-add" });
    state = employerPreviewReducer(state, { type: "set-name", name: "Example Workshop" });
    state = employerPreviewReducer(state, { type: "set-postcode", postcode: "EX4 4EX" });
    state = employerPreviewReducer(state, { type: "set-phone", phone: "00000 400400" });
    state = employerPreviewReducer(state, {
      type: "set-manager",
      id: state.managers[0].id,
      label: "Example Manager",
    });
    state = employerPreviewReducer(state, { type: "set-contact-name", contactName: "Jo Example" });
    state = employerPreviewReducer(state, {
      type: "set-contact-email",
      contactEmail: "jo@example.test",
    });
    state = employerPreviewReducer(state, {
      type: "set-contact-phone",
      contactPhone: "00000 500500",
    });
    const saved = employerPreviewReducer(state, { type: "add-local" });
    const added = saved.rows.find((row) => row.name === "Example Workshop");
    expect(added).toMatchObject({
      postcode: "EX4 4EX",
      phone: "00000 400400",
      contactName: "Jo Example",
      contactEmail: "jo@example.test",
      contactPhone: "00000 500500",
      managers: ["Example Manager"],
    });
    expect(added?.contactName).not.toBe(added?.managers[0]);
    let samePerson = employerPreviewReducer(initialEmployerPreviewState(), { type: "toggle-add" });
    samePerson = employerPreviewReducer(samePerson, { type: "set-name", name: "Example Yard Contact" });
    samePerson = employerPreviewReducer(samePerson, {
      type: "set-manager",
      id: samePerson.managers[0].id,
      label: "Example Manager",
    });
    samePerson = employerPreviewReducer(samePerson, {
      type: "set-contact-name",
      contactName: "Example Manager",
    });
    const reused = employerPreviewReducer(samePerson, { type: "add-local" });
    const reusedRow = reused.rows.find((row) => row.name === "Example Yard Contact");
    expect(reusedRow?.contactName).toBe("Example Manager");
    expect(reusedRow?.managers).toEqual(["Example Manager"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    const html = renderToStaticMarkup(
      createElement(EmployersVisualPreview, {
        initialState: { ...initialEmployerPreviewState(), addOpen: true },
      }),
    );
    expect(html).toContain("Postcode");
    expect(html).toContain("Phone number");
    expect(html).toContain("Employer contact name");
    expect(html).toContain("Employer contact email");
    expect(html).toContain("Employer contact phone");
    expect(html).toContain("A manager can also be the contact");
    expect(html.indexOf("Employer contact name")).toBeGreaterThan(html.indexOf("Postcode"));
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
    expect(html).toContain('aria-label="Add site"');
    expect(html).toContain('aria-label="Add manager"');
    expect(html).toContain(">Add site<");
    expect(html).toContain(">Add manager<");
    expect(addPillsSitBesideHeadings(html)).toBe(true);
    expect(readFileSync(path.join(process.cwd(), "src/features/administration/screens/admin-pages.module.css"), "utf8")).toMatch(
      /\.entryAdd\s*\{[^}]*width:\s*auto;[^}]*height:\s*1\.35rem;/s,
    );
    expect(html).not.toContain('aria-label="Remove site 1"');
    expect(html).not.toContain('aria-label="Remove manager 1"');
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
    const protectedManager = employerPreviewReducer(state, {
      type: "remove-manager",
      id: state.managers[0].id,
    });
    expect(protectedManager.managers.map((entry) => entry.label)).toEqual([
      "Example Lead",
      "Example Deputy",
    ]);
    state = employerPreviewReducer(state, { type: "remove-manager", id: state.managers[1].id });
    const saved = employerPreviewReducer(state, { type: "add-local" });
    const added = saved.rows.find((row) => row.name === "Example Workshop");
    expect(added?.sites).toEqual(["Example bay edited", "Example store"]);
    expect(added?.managers).toEqual(["Example Lead"]);
    expect(added?.sites).not.toContain("Example ramp");
    expect(added?.managers).not.toContain("Example Deputy");
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
          managers: [
            { id: "manager-1", label: "Example Lead" },
            { id: "manager-2", label: "Example Deputy" },
          ],
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
    expect(html).toContain('aria-label="Add site"');
    expect(html).toContain('aria-label="Add manager"');
    expect(html).toContain("Example bay edited, Example store");
    expect(html).toContain("Example Deputy");
    expect(html).toContain('aria-label="Remove site 2"');
    expect(html).toContain('aria-label="Remove manager 2"');
    expect(html).not.toContain('aria-label="Remove site 1"');
    expect(html).not.toContain('aria-label="Remove manager 1"');
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
    const blocked = employerPreviewReducer(state, {
      type: "request-remove",
      kind: "site",
      id: state.sites[0].id,
    });
    expect(blocked.pendingRemove).toBeNull();
    expect(blocked.sites.map((entry) => entry.label)).toEqual(["Example bay", "Example ramp"]);
    const blockedManager = employerPreviewReducer(blocked, {
      type: "request-remove",
      kind: "manager",
      id: blocked.managers[0].id,
    });
    expect(blockedManager.pendingRemove).toBeNull();
    expect(blockedManager.managers.map((entry) => entry.label)).toEqual([
      "Example Lead",
      "Example Deputy",
    ]);
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
    expect(nextModalFocus(1, 2, false)).toBe(0);
    expect(nextModalFocus(0, 2, true)).toBe(1);
    const askedAgain = employerPreviewReducer(kept, {
      type: "request-remove",
      kind: "site",
      id: kept.sites[1].id,
    });
    const removed = employerPreviewReducer(askedAgain, { type: "confirm-remove" });
    expect(removed.pendingRemove).toBeNull();
    expect(removed.sites.map((entry) => entry.label)).toEqual(["Example bay"]);
    expect(removed.managers.map((entry) => entry.label)).toEqual(["Example Lead", "Example Deputy"]);
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
    expect(html).toContain('data-modal-backdrop="entry-remove"');
    const form = html.split('data-add-panel="employer"')[1]?.split("</form>")[0] ?? "";
    expect(form).not.toContain('role="dialog"');
    expect(form).not.toContain("data-modal-backdrop");
    expect(html).toContain('value="Example bay"');
    expect(html).toContain('value="Example ramp"');
    expect(html).toContain('value="Example Lead"');
    expect(html).toContain('value="Example Deputy"');
  });
});

describe("employer list row corners", () => {
  it("uses the same 8px rounded rectangle for employer and apprentice rows", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src/features/administration/screens/admin-pages.module.css"),
      "utf8",
    );
    expect(css).toMatch(/\.employerRow\s*\{\s*border-radius:\s*8px;\s*\}/);
    const employerHtml = renderToStaticMarkup(createElement(EmployersVisualPreview));
    const apprenticeHtml = renderToStaticMarkup(createElement(ApprenticesVisualPreview));
    expect(employerHtml).toContain(styles.employerRow);
    expect(employerHtml).toContain("Example Motors");
    expect(apprenticeHtml).toContain(styles.employerRow);
    expect(apprenticeHtml).toContain("Alex Example");
  });
});

describe("apprentice employer dropdown", () => {
  const selectSource = readFileSync(
    path.join(process.cwd(), "src/components/ui/Select.tsx"),
    "utf8",
  );

  it("shows Not linked, Example Motors, and Example Yard Co through the app listbox", () => {
    const preview = readFileSync(
      path.join(process.cwd(), "src/features/administration/screens/apprentices-visual-preview.tsx"),
      "utf8",
    );
    expect(preview).toContain('from "@/components/ui"');
    expect(preview).toContain("Employer, if known");
    expect(preview).toContain('label: "None"');
    expect(preview).not.toContain("<select");
    for (const employerId of ["", "example-motors", "example-yard-co"]) {
      const html = renderToStaticMarkup(
        createElement(ApprenticesVisualPreview, {
          initialState: { ...initialApprenticePreviewState(), addOpen: true, employerId },
        }),
      );
      const label =
        employerId === "example-motors"
          ? "Example Motors"
          : employerId === "example-yard-co"
            ? "Example Yard Co"
            : "None";
      expect(html).toContain('aria-haspopup="listbox"');
      expect(html).toContain(label);
    }
  });

  it("keeps a chosen employer in local state and does not write", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    let state = apprenticePreviewReducer(initialApprenticePreviewState(), { type: "toggle-add" });
    state = apprenticePreviewReducer(state, { type: "set-entry", field: "firstName", value: "Sam" });
    state = apprenticePreviewReducer(state, { type: "set-entry", field: "lastName", value: "Example" });
    state = apprenticePreviewReducer(state, { type: "set-entry", field: "employerId", value: "example-motors" });
    state = apprenticePreviewReducer(state, { type: "add-local" });
    expect(state.rows.find((row) => row.fullName === "Sam Example")?.employerId).toBe(
      "example-motors",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("matches the sales add-learner card and keeps notes local", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src/features/administration/screens/admin-pages.module.css"),
      "utf8",
    );
    expect(css).toMatch(/\.learnerCard\s*\{[^}]*border-radius:\s*22px;/s);
    expect(css).toMatch(/\.learnerGrid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[^}]*gap:\s*12px;/s);
    expect(css).toMatch(/\.learnerField span\s*\{[^}]*font-size:\s*14px;/s);
    expect(css).toMatch(/\.learnerActions \.primaryBtn[\s\S]*border-radius:\s*999px;/);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    let state = apprenticePreviewReducer(initialApprenticePreviewState(), { type: "toggle-add" });
    state = apprenticePreviewReducer(state, { type: "set-entry", field: "notes", value: "Left blank on purpose" });
    state = apprenticePreviewReducer(state, { type: "add-local" });
    expect(state.notice).toBe("First name and last name are required.");
    expect(state.notes).toBe("Left blank on purpose");
    expect(state.rows).toHaveLength(initialApprenticePreviewState().rows.length);
    state = apprenticePreviewReducer(state, { type: "set-entry", field: "firstName", value: "Sam" });
    state = apprenticePreviewReducer(state, { type: "set-entry", field: "lastName", value: "Example" });
    state = apprenticePreviewReducer(state, { type: "add-local" });
    expect(state.notes).toBe("");
    expect(state.rows.some((row) => row.fullName === "Sam Example")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("shows every sales form field in order and keeps the entered values locally", () => {
    const html = renderToStaticMarkup(
      createElement(ApprenticesVisualPreview, {
        initialState: { ...initialApprenticePreviewState(), addOpen: true },
      }),
    );
    const order = [...html.matchAll(/data-entry-field="([^"]+)"/g)].map((match) => match[1]);
    expect(order).toEqual([...LEARNER_FIELD_ORDER]);
    expect(html.match(/aria-haspopup="listbox"/g)?.length).toBe(10);
    expect(PREVIEW_STAFF_OPTIONS).toEqual([]);
    expect(html).toContain('aria-label="GTA tutor"');
    expect(html).toContain('aria-label="GTA reviewer"');
    expect(html).not.toContain("<select");
    expect(html).toContain(">None<");
    expect(html).not.toContain(">Doncaster<");
    expect(html).not.toContain(">Autocare<");
    expect(html).not.toContain(">Responsive<");
    expect(html).toContain("Release day");
    expect(html).toContain("GTA tutor");
    expect(html).toContain("Apprenticeship start date");
    expect(html).toContain("Apprenticeship planned end date");
    expect(html).toContain("GTA reviewer");
    expect(html).toContain("Planned review date");
    expect(html).toContain("Future reviews");
    expect(html).toContain("Enter the planned review date first");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("Reiss Chambers");
    expect(html).not.toContain("standard / route");
    expect(RELEASE_DAYS.map((item) => item.label)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ]);
    expect(html).not.toContain("Phone number");
    expect(TRAINING_SITES.map((item) => item.label)).toEqual(["Doncaster", "Sheffield"]);
    expect(APPRENTICESHIPS.map((item) => item.label)).toEqual([
      "Autocare",
      "Light Vehicle",
      "Heavy Vehicle",
      "Vehicle Paint",
      "Vehicle Panel",
      "Business Admin",
      "Customer Service",
    ]);
    expect(ENQUIRY_SOURCES.map((item) => item.label)).toEqual([
      "Website",
      "Social media",
      "School event",
      "Google",
      "Word of mouth",
      "Leaflet",
      "Flyer",
      "GTA prospectus",
      "Other",
    ]);
    expect(RESPONSIVENESS_OPTIONS.map((item) => item.label)).toEqual(["Responsive", "Unresponsive"]);
    expect(EMPLOYER_STATUSES.map((item) => item.label)).toEqual([
      "Employer needed",
      "Identified but unconfirmed",
      "Confirmed",
    ]);

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    let state = apprenticePreviewReducer(initialApprenticePreviewState(), { type: "toggle-add" });
    const entered = {
      firstName: "Sam",
      lastName: "Example",
      externalLearnerId: "EX-44",
      site: "sheffield",
      apprenticeship: "light_vehicle",
      originalEntryDate: "2026-01-15",
      enquirySource: "website",
      responsiveness: "responsive",
      employerStatus: "confirmed",
      employerId: "example-motors",
      intendedIntakeDate: "2026-09-01",
      releaseDay: "Tuesday",
      gtaTutor: "same-person",
      apprenticeshipStartDate: "2026-09-07",
      apprenticeshipPlannedEndDate: "2028-09-06",
      gtaReviewer: "same-person",
      plannedReviewDate: "2026-12-01",
      notes: "Preview note",
    } as const;
    for (const [field, value] of Object.entries(entered)) {
      state = apprenticePreviewReducer(state, {
        type: "set-entry",
        field: field as keyof typeof entered,
        value,
      });
    }
    state = apprenticePreviewReducer(state, { type: "add-local" });
    const added = state.rows.find((row) => row.fullName === "Sam Example");
    expect(added).toMatchObject({
      ...entered,
      releaseDay: "Tuesday",
      gtaTutor: "same-person",
      apprenticeshipStartDate: "2026-09-07",
      apprenticeshipPlannedEndDate: "2028-09-06",
      gtaReviewer: "same-person",
      plannedReviewDate: "2026-12-01",
    });
    expect(state.site).toBe("");
    expect(state.originalEntryDate).toBe("");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("reuses the app dropdown keyboard and outside-click behaviour", () => {
    expect(selectSource).toContain('aria-haspopup="listbox"');
    expect(selectSource).toContain("ArrowDown");
    expect(selectSource).toContain("ArrowUp");
    expect(selectSource).toContain('event.key === "Enter"');
    expect(selectSource).toContain('event.key === "Escape"');
    expect(selectSource).toContain('document.addEventListener("mousedown"');
    expect(selectSource).toContain("rootRef.current?.contains");
    expect(selectSource).toContain("data-selected");
  });
});

describe("lookup route and menu", () => {
  const root = process.cwd();
  const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

  it("redirects the old lookup URL after the existing session guard", () => {
    const page = read("src/app/apprentices/page.tsx");
    expect(page).toContain("requireApprenticeWorkspaceAccess");
    expect(page).toContain('redirect("/administration/onboarding/directory/apprentices")');
    expect(page).toContain('redirect("/management/onboarding/directory/apprentices")');
    expect(page).not.toContain("ApprenticePackSearchScreen");
  });

  it("keeps one Apprentices label in each staff menu and names Employers", () => {
    const nav = read("src/shell/workspaces/resolve-navigation.ts");
    expect(nav).not.toContain("/apprentices?from=");
    expect(nav).toContain('title: "Onboarding"');
    expect(nav).toContain('label: "Add apprentice"');
    expect(nav).toContain('label: "Add employer"');
    expect(nav).toContain('label: "Directory"');
    expect(nav).not.toContain('label: "Employers"');
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
