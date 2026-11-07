import { createElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApprenticesVisualPreview } from "./apprentices-visual-preview";
import { EmployersVisualPreview } from "./employers-visual-preview";
import { MarketingOverview } from "./MarketingOverview";
import { RecruitmentGapScreen } from "./RecruitmentGapScreen";
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
    expect(routes).toContain("return renderMarketing(\"administration\", segment);");
    expect(routes).toContain("return renderMarketing(\"management\", segment);");
    const page = readFileSync(path.join(process.cwd(), "src/app/apprentices/page.tsx"), "utf8");
    expect(page).toContain("requireApprenticeWorkspaceAccess");
  });

  it("splits Onboarding and Marketing & Recruitment without a second employer list", () => {
    const nav = readFileSync(
      path.join(process.cwd(), "src/shell/workspaces/resolve-navigation.ts"),
      "utf8",
    );
    expect(nav).toContain('title: "Marketing & Recruitment"');
    expect(nav).toContain("const base = `/${workspace}/marketing`");
    expect(nav).toContain('label: "Employers & vacancies"');
    expect(nav).toContain("PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW");
    expect(nav).toContain("PERMISSIONS.ADMIN_USERS_MANAGE");
    const html = renderToStaticMarkup(
      createElement(MarketingOverview, { workspace: "administration" }),
    );
    expect(html).toContain("Marketing &amp; Recruitment");
    expect(html).toContain("EXAMPLE DATA");
    expect(html).toContain("Saving is disabled");
    expect(html).toContain("not built");
    expect(html).not.toContain("supabase");
    const employers = renderToStaticMarkup(
      createElement(OnboardingDirectory, {
        initialView: "employers",
        lockView: true,
        title: "Employers & vacancies",
      }),
    );
    expect(employers).toContain("Example Motors");
    expect(employers).not.toContain(">Apprentices<");
    const interviews = renderToStaticMarkup(
      createElement(RecruitmentGapScreen, {
        eyebrow: "Onboarding",
        title: "Interviews",
        description: "Interview groups are not built.",
        gaps: ["A pass does not open Stage 2."],
      }),
    );
    expect(interviews).toContain("NOT BUILT");
    expect(interviews).toContain("A pass does not open Stage 2.");
    expect(interviews).not.toContain("supabase");
  });
});
