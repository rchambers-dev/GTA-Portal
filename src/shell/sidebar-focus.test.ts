import { createElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { NavSection } from "@/lib/portal/types";
import { SidebarSections } from "./SidebarNavigation";
import {
  activeHref,
  focusAfterNavigation,
  groupForPath,
  initialFocus,
  toggleHeading,
} from "./sidebar-focus";

const sections: NavSection[] = [
  {
    items: [
      { href: "/administration/dashboard", label: "Administration Dashboard", permission: "admin.workspace.view" },
      { href: "/administration/messages", label: "Messages", permission: "messages.view" },
    ],
  },
  {
    title: "Apprenticeship Management",
    items: [
      { href: "/administration/programmes", label: "Apprenticeships", permission: "admin.records.manage" },
      { href: "/administration/enrolments", label: "Apprentice Enrolments", permission: "admin.records.manage" },
    ],
  },
  {
    title: "Staff",
    items: [{ href: "/staff-records?from=administration", label: "Staff Records", permission: "admin.users.manage" }],
  },
  {
    title: "Marketing & Recruitment",
    items: [{ href: "/administration/marketing", label: "Overview", permission: "admin.records.manage" }],
  },
  {
    title: "Onboarding",
    items: [
      { href: "/administration/onboarding", label: "Overview", permission: "admin.records.manage" },
      { href: "/administration/onboarding/apprentice", label: "Add apprentice", permission: "admin.records.manage" },
      { href: "/administration/onboarding/directory", label: "Directory", permission: "admin.records.manage" },
    ],
  },
];

function renderNav(pathname: string, focused: string | null) {
  return renderToStaticMarkup(
    createElement(SidebarSections, {
      navigation: sections,
      pathname,
      focused,
      onToggle: () => undefined,
    }),
  );
}

describe("sidebar category toggle", () => {
  it("opens only the clicked group and the same heading restores the full nav", () => {
    const closed = { focused: null, dismissed: null };
    const opened = toggleHeading(closed, "Onboarding");
    expect(opened).toEqual({ focused: "Onboarding", dismissed: null });
    expect(toggleHeading(opened, "Onboarding")).toEqual({
      focused: null,
      dismissed: "Onboarding",
    });

    const normal = renderNav("/administration/dashboard", null);
    expect(normal).toContain(">Onboarding<");
    expect(normal).toContain(">Marketing &amp; Recruitment<");
    expect(normal).toContain(">Staff<");
    expect(normal).toContain(">Apprenticeship Management<");
    expect(normal).toContain("Administration Dashboard");
    expect(normal).not.toContain("Add apprentice");
    expect(normal).toContain('aria-expanded="false"');
    expect(normal).toContain('data-chevron="right"');
    expect(normal).not.toContain('data-chevron="left"');

    const focused = renderNav("/administration/onboarding/apprentice", "Onboarding");
    expect(focused).toContain(">Onboarding<");
    expect(focused).toContain("Add apprentice");
    expect(focused).toContain("Directory");
    expect(focused).not.toContain("Administration Dashboard");
    expect(focused).not.toContain(">Marketing &amp; Recruitment<");
    expect(focused).toContain('aria-expanded="true"');
    expect(focused).toContain('data-chevron="left"');
    expect(focused).not.toContain('data-chevron="right"');
    expect(focused).toContain('href="/administration/onboarding/apprentice"');
  });

  it("keeps one active leaf and stays focused across child routes", () => {
    const pathname = "/administration/onboarding/apprentice";
    expect(groupForPath(sections, pathname)).toBe("Onboarding");
    expect(activeHref(pathname, sections[4].items)).toBe("/administration/onboarding/apprentice");
    expect(initialFocus(sections, pathname).focused).toBe("Onboarding");
    const html = renderNav(pathname, "Onboarding");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('href="/administration/onboarding/apprentice"');
    const stayed = focusAfterNavigation(
      { focused: "Onboarding", dismissed: null },
      "Onboarding",
    );
    expect(stayed.focused).toBe("Onboarding");
    const dismissed = toggleHeading(stayed, "Onboarding");
    expect(focusAfterNavigation(dismissed, "Onboarding").focused).toBeNull();
    expect(focusAfterNavigation(dismissed, null)).toEqual({ focused: null, dismissed: null });
  });

  it("uses distinct category icons, wrapping labels, and a collapsed rail", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src/shell/SidebarNavigation.module.css"),
      "utf8",
    );
    expect(css).toMatch(/\.categoryButton[\s\S]*min-height:\s*2\.75rem/);
    expect(css).toMatch(/\.categoryButton[\s\S]*text-transform:\s*none/);
    expect(css).toMatch(/\.categoryLabel\s*\{[^}]*white-space:\s*normal/s);
    expect(css).not.toMatch(/\.categoryLabel\s*\{[^}]*text-overflow:\s*ellipsis/s);
    expect(css).toMatch(/\.chevronTrail\s*\{[^}]*display:\s*none/s);
    expect(css).toContain(".sidebarSlot:hover .chevronTrail");
    expect(css).toContain(".sidebarSlot:hover,");
    const html = renderNav("/administration/dashboard", null);
    const icons = [...html.matchAll(/data-category-icon="([^"]+)"([\s\S]*?)<\/span>/g)].map(
      (match) => [match[1], match[2]] as const,
    );
    expect(icons.map(([name]) => name)).toEqual([
      "Apprenticeship Management",
      "Staff",
      "Marketing &amp; Recruitment",
      "Onboarding",
    ]);
    expect(new Set(icons.map(([, svg]) => svg)).size).toBe(4);
    expect(html).toContain('title="Apprenticeship Management"');
    expect(html).toContain('aria-label="Onboarding, show pages"');
    const open = renderNav("/administration/onboarding", "Onboarding");
    expect(open).toContain('aria-label="Onboarding, return to main navigation"');
    expect(open).toContain('data-chevron="left"');
  });
});
