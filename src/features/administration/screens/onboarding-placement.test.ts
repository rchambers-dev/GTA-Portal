import { createElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApprenticesVisualPreview } from "./apprentices-visual-preview";
import { EmployersVisualPreview } from "./employers-visual-preview";
import { OnboardingDirectory } from "./OnboardingDirectory";
import { OnboardingOverview } from "./OnboardingOverview";
import { LEARNER_FIELD_ORDER } from "./learner-entry-options";
import { initialApprenticePreviewState } from "./visual-preview-state";

describe("onboarding placement", () => {
  it("keeps the full apprentice form on the onboarding form and off the directory list", () => {
    const form = renderToStaticMarkup(
      createElement(ApprenticesVisualPreview, {
        mode: "form",
        initialState: { ...initialApprenticePreviewState(), addOpen: false },
      }),
    );
    const order = [...form.matchAll(/data-entry-field="([^"]+)"/g)].map((match) => match[1]);
    expect(order).toEqual([...LEARNER_FIELD_ORDER]);
    expect(form).toContain("Future reviews");
    expect(form).toContain("Enter the planned review date first");
    expect(form).not.toContain('data-directory-list="apprentices"');

    const list = renderToStaticMarkup(
      createElement(ApprenticesVisualPreview, {
        mode: "list",
        query: "Jordan",
        initialState: initialApprenticePreviewState(),
      }),
    );
    expect(list).toContain("Jordan Example");
    expect(list).not.toContain("Alex Example");
    expect(list).not.toContain("data-add-panel");
    expect(list).not.toContain("Add apprentice");
  });

  it("switches the directory between apprentice and employer example rows", () => {
    const apprentices = renderToStaticMarkup(
      createElement(OnboardingDirectory, { initialView: "apprentices" }),
    );
    expect(apprentices).toContain('data-directory-view="apprentices"');
    expect(apprentices).toContain("Alex Example");
    expect(apprentices).toContain("Search directory");
    expect(apprentices).not.toContain("data-add-panel");
    expect(apprentices).not.toContain(">Add apprentice<");

    const employers = renderToStaticMarkup(
      createElement(OnboardingDirectory, { initialView: "employers" }),
    );
    expect(employers).toContain('data-directory-view="employers"');
    expect(employers).toContain("Example Motors");
    expect(employers).not.toContain("data-add-panel");
    expect(employers).not.toContain("Add employer");
  });

  it("shows an empty onboarding overview with both entry links", () => {
    const html = renderToStaticMarkup(
      createElement(OnboardingOverview, { workspace: "administration" }),
    );
    expect(html).toContain("Your recruitment overview");
    expect(html).toContain("Stage 1");
    expect(html).toContain("Awaiting interview");
    expect(html).toContain("Needs your attention");
    expect(html).toContain("Recent updates");
    expect(html).toContain("Next interview group");
    expect(html).toContain("Upcoming activity");
    expect(html).toContain("Example preview. Nothing is loaded.");
    expect(html).toContain("—");
    expect(html).toContain('href="/administration/onboarding/apprentice"');
    expect(html).toContain('href="/administration/onboarding/employer"');
    expect(html).not.toContain("supabase");
  });

  it("keeps the employer form, including contact fields, on the form view", () => {
    const html = renderToStaticMarkup(
      createElement(EmployersVisualPreview, { mode: "form" }),
    );
    expect(html).toContain("data-add-panel");
    expect(html).toContain("Employer contact name");
    expect(html).toContain("A manager can also be the contact");
    expect(html).not.toContain('data-directory-list="employers"');
  });

  it("redirects the old directory routes and leaves enrolments in place", () => {
    const routes = readFileSync(
      path.join(process.cwd(), "src/shell/workspaces/render-workspace-page.tsx"),
      "utf8",
    );
    expect(routes).toContain('redirect("/administration/onboarding/directory/apprentices")');
    expect(routes).toContain('redirect("/administration/onboarding/directory/employers")');
    expect(routes).toContain('redirect("/management/onboarding/directory/apprentices")');
    expect(routes).toContain('redirect("/management/onboarding/directory/employers")');
    expect(routes).toContain("return <AdminEnrolmentsScreen />");
    const page = readFileSync(path.join(process.cwd(), "src/app/apprentices/page.tsx"), "utf8");
    expect(page).toContain("requireApprenticeWorkspaceAccess");
  });
});
