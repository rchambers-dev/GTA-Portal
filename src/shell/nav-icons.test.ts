import { createElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NavIcon, navGlyphForHref, type NavGlyph } from "./nav-icons";

const expected: Record<string, NavGlyph> = {
  "/category/onboarding": "person-plus",
  "/category/marketing": "megaphone",
  "/category/staff": "staff",
  "/category/apprenticeship": "cap",
  "/apprentice/dashboard": "dashboard",
  "/apprentice/learning": "book",
  "/apprentice/progress": "chart",
  "/apprentice/tracking": "tasks",
  "/apprentice/otj": "clock",
  "/apprentice/documents": "document",
  "/apprentice/attendance": "calendar-check",
  "/apprentice/reviews": "reviews",
  "/apprentice/cv": "id-card",
  "/apprentice/messages": "messages",
  "/apprentice/support": "support",
  "/employer/dashboard": "dashboard",
  "/employer/apprentice": "person",
  "/employer/progress": "chart",
  "/employer/attendance": "calendar-check",
  "/employer/otj": "clock",
  "/employer/reviews": "reviews",
  "/employer/documents": "document",
  "/employer/messages": "messages",
  "/employer/support": "support",
  "/staff/dashboard": "dashboard",
  "/apprentices/lifecycle": "kanban",
  "/staff/schedule": "calendar",
  "/staff/programme-delivery": "delivery",
  "/staff/otj-approvals": "clock",
  "/reviews?from=tutor": "reviews",
  "/staff/shared-drive": "folder",
  "/staff/messages": "messages",
  "/apprentices": "person",
  "/workspaces/progress-mentor/progress-monitoring": "chart",
  "/workspaces/progress-mentor/reviews": "reviews",
  "/workspaces/progress-mentor/actions": "tasks",
  "/workspaces/progress-mentor/training-plans": "clipboard",
  "/workspaces/progress-mentor/employers": "workplace",
  "/workspaces/progress-mentor/employer-concerns": "alert",
  "/workspaces/progress-mentor/interventions": "flag",
  "/workspaces/progress-mentor/messages": "messages",
  "/curriculum/overview": "dashboard",
  "/curriculum/course-builder": "builder-grid",
  "/curriculum/programme": "cap",
  "/curriculum/modules": "modules",
  "/curriculum/resources": "package",
  "/curriculum/assessments": "pencil",
  "/curriculum/ksb": "mapping",
  "/curriculum/feedback": "comment",
  "/curriculum/versions": "layers",
  "/curriculum/history": "history",
  "/quality/dashboard": "dashboard",
  "/quality/audits": "audit",
  "/quality/observations": "eye",
  "/quality/sampling": "funnel",
  "/quality/compliance": "badge",
  "/quality/findings": "alert",
  "/quality/improvements": "trend",
  "/quality/feedback-trends": "chart",
  "/quality/history": "history",
  "/quality/shared-drive": "folder",
  "/management/dashboard": "dashboard",
  "/management/apprentice-brag": "gauge",
  "/management/shared-drive": "folder",
  "/management/messages": "messages",
  "/management/safeguarding": "shield",
  "/management/programmes-records": "cap",
  "/management/cohorts": "people",
  "/management/teaching-groups": "teaching",
  "/management/enrolments": "clipboard",
  "/management/programme-builder": "builder-list",
  "/management/course-builder": "builder-grid",
  "/management/apprentice-funding": "coins",
  "/management/apprentice-tnp": "tag",
  "/administration/dashboard": "dashboard",
  "/administration/accounts": "key",
  "/administration/shared-drive": "folder",
  "/administration/messages": "messages",
  "/administration/safeguarding": "shield",
  "/administration/programmes": "cap",
  "/administration/cohorts": "people",
  "/administration/teaching-groups": "teaching",
  "/administration/enrolments": "clipboard",
  "/administration/marketing": "megaphone",
  "/administration/onboarding": "door",
  "/administration/onboarding/apprentice": "person-plus",
  "/administration/onboarding/candidates": "people",
  "/administration/reviews/plan": "calendar",
  "/administration/reviews/cycle": "clipboard",
  "/administration/reviews/out": "workplace",
  "/administration/reviews/archive": "folder",
  "/administration/reviews/analytics": "chart",
  "/administration/reviews/log": "history",
  "/administration/reviews/tutor-reviews": "comment",
  "/administration/reviews/settings": "gear",
  "/administration/onboarding/employer": "workplace-plus",
  "/administration/onboarding/directory": "directory",
  "/staff-records?from=administration": "staff",
  "/safeguarding/dashboard": "shield",
  "/administration/data-quality": "checklist",
  "/administration/system": "gear",
  "/administration/documents": "folder",
  "/evidence/pack": "paperclip",
};

describe("navigation icon meanings", () => {
  it("gives every current page a purposeful glyph and reuses one glyph per meaning", () => {
    const seen = new Map<string, NavGlyph>();
    for (const [href, glyph] of Object.entries(expected)) {
      expect(navGlyphForHref(href), href).toBe(glyph);
      seen.set(href, glyph);
    }
    expect([...seen.values()]).not.toContain("page");

    const markup = (href: string) =>
      renderToStaticMarkup(createElement(NavIcon, { href }));
    expect(markup("/apprentice/messages")).toBe(markup("/administration/messages"));
    expect(markup("/apprentice/otj")).toBe(markup("/staff/otj-approvals"));
    expect(markup("/administration/employers")).toBe(markup("/workspaces/progress-mentor/employers"));
    expect(markup("/workspaces/progress-mentor/employer-concerns")).not.toBe(
      markup("/workspaces/progress-mentor/employers"),
    );
    expect(markup("/administration/safeguarding")).not.toBe(markup("/administration/data-quality"));
    expect(markup("/apprentice/dashboard")).toBe(markup("/quality/dashboard"));
    expect(markup("/safeguarding/dashboard")).not.toBe(markup("/quality/dashboard"));
    expect(markup("/administration/cohorts")).not.toBe(markup("/administration/teaching-groups"));
    expect(markup("/administration/enrolments")).not.toBe(markup("/management/apprentice-funding"));
    expect(markup("/management/apprentice-funding")).not.toBe(markup("/management/apprentice-tnp"));
    const reviewIcons = [
      "/administration/reviews/plan",
      "/administration/reviews/cycle",
      "/administration/reviews/out",
      "/administration/reviews/archive",
      "/administration/reviews/analytics",
      "/administration/reviews/log",
      "/administration/reviews/tutor-reviews",
      "/administration/reviews/settings",
      "/reviews?from=tutor",
    ].map(markup);
    expect(new Set(reviewIcons).size).toBe(reviewIcons.length);
    expect(markup("/category/onboarding")).toBe(markup("/administration/onboarding/apprentice"));
    expect(markup("/category/onboarding")).not.toBe(markup("/administration/onboarding/employer"));

    const categories = [
      "/category/onboarding",
      "/category/marketing",
      "/category/staff",
      "/category/apprenticeship",
    ].map(markup);
    expect(new Set(categories).size).toBe(4);

    for (const html of categories) {
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('stroke="currentColor"');
    }

    const source = readFileSync(path.join(process.cwd(), "src/shell/nav-icons.tsx"), "utf8");
    expect(source).not.toContain("M4 11.5 12 4l8 7.5");
    const header = readFileSync(path.join(process.cwd(), "src/shell/GlobalHeader.tsx"), "utf8");
    expect(header).toContain('aria-label={');
    expect(header).toContain("M6 16V11a6 6 0 1 1 12 0v5");
    expect(header).toContain("⌕");
  });
});
