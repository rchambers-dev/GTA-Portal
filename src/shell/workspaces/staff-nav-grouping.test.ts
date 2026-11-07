import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import type { EffectiveSession, WorkspaceId } from "@/lib/portal/types";
import { resolveNavigation } from "./resolve-navigation";

function session(workspace: WorkspaceId, permissions: string[]): EffectiveSession {
  return {
    account: {
      id: "example",
      name: "Example",
      initials: "EX",
      email: "example@example.test",
      baseRole: "Administrator",
      responsibilities: [],
      workspace,
      permissions,
    },
    permissions,
    activeTemporaryAssignments: [],
    temporaryAccessLabels: [],
  };
}

function labels(workspace: "administration" | "management") {
  return resolveNavigation(
    session(workspace, [
      PERMISSIONS.ADMIN_WORKSPACE_VIEW,
      PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW,
      PERMISSIONS.ADMIN_RECORDS_MANAGE,
      PERMISSIONS.ADMIN_USERS_MANAGE,
      PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP,
      PERMISSIONS.MESSAGES_VIEW,
    ]),
  );
}

describe("sidebar grouping", () => {
  it("places Staff Records under a Staff heading and keeps Onboarding and Marketing", () => {
    for (const workspace of ["administration", "management"] as const) {
      const sections = labels(workspace);
      const staff = sections.find((section) => section.title === "Staff");
      const onboarding = sections.find((section) => section.title === "Onboarding");
      const marketing = sections.find((section) => section.title === "Marketing");
      expect(staff?.items.map((item) => item.label)).toEqual(["Staff Records"]);
      expect(staff?.items[0]?.href).toBe(`/staff-records?from=${workspace}`);
      expect(staff?.items[0]?.permission).toBe(PERMISSIONS.ADMIN_USERS_MANAGE);
      expect(onboarding?.items.map((item) => item.label)).toEqual([
        "Overview",
        "Add apprentice",
        "Add employer",
        "Directory",
      ]);
      expect(marketing?.items.map((item) => item.label)).toEqual(["Overview"]);
      const apprenticeship = sections.find((section) => section.title === "Apprenticeship Management");
      const expected =
        workspace === "administration"
          ? ["Apprenticeships", "Cohorts", "Teaching Groups", "Apprentice Enrolments"]
          : [
              "Apprenticeships",
              "Cohorts",
              "Teaching Groups",
              "Apprentice Enrolments",
              "Programme Builder",
              "Course Builder",
              "Apprentice funding (RPL / KSB)",
              "Apprentice TNP1",
            ];
      expect(apprenticeship?.items.map((item) => item.label)).toEqual(expected);
      expect(apprenticeship?.items.map((item) => item.permission)).toEqual(
        workspace === "administration"
          ? Array(4).fill(PERMISSIONS.ADMIN_RECORDS_MANAGE)
          : [
              PERMISSIONS.ADMIN_RECORDS_MANAGE,
              PERMISSIONS.ADMIN_RECORDS_MANAGE,
              PERMISSIONS.ADMIN_RECORDS_MANAGE,
              PERMISSIONS.ADMIN_RECORDS_MANAGE,
              PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP,
              PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP,
              PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP,
              PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP,
            ],
      );
      const leaves = sections.flatMap((section) => section.items.map((item) => item.href));
      expect(leaves.filter((href) => href === `/${workspace}/staff`)).toEqual([]);
      expect(new Set(leaves).size).toBe(leaves.length);
    }
  });

  it("hides the Staff group when the child permission is absent", () => {
    const sections = resolveNavigation(
      session("administration", [PERMISSIONS.ADMIN_WORKSPACE_VIEW, PERMISSIONS.ADMIN_RECORDS_MANAGE]),
    );
    expect(sections.some((section) => section.title === "Staff")).toBe(false);
    expect(sections.some((section) => section.title === "Onboarding")).toBe(true);
    const recordsOnly = resolveNavigation(
      session("management", [PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW, PERMISSIONS.ADMIN_RECORDS_MANAGE]),
    );
    expect(
      recordsOnly.find((section) => section.title === "Apprenticeship Management")?.items.map((item) => item.label),
    ).toEqual(["Apprenticeships", "Cohorts", "Teaching Groups", "Apprentice Enrolments"]);
    const setupOnly = resolveNavigation(
      session("management", [PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW, PERMISSIONS.MANAGEMENT_PROGRAMME_SETUP]),
    );
    expect(
      setupOnly.find((section) => section.title === "Apprenticeship Management")?.items.map((item) => item.label),
    ).toEqual([
      "Programme Builder",
      "Course Builder",
      "Apprentice funding (RPL / KSB)",
      "Apprentice TNP1",
    ]);
    const neither = resolveNavigation(session("management", [PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW]));
    expect(neither.some((section) => section.title === "Apprenticeship Management")).toBe(false);
  });

  it("keeps the Staff page route and renders headings as text, not links", () => {
    const routes = readFileSync(
      path.join(process.cwd(), "src/shell/workspaces/render-workspace-page.tsx"),
      "utf8",
    );
    expect(routes).toContain('case "staff"');
    expect(routes).toContain("return <AdminStaffScreen");
    const sidebar = readFileSync(
      path.join(process.cwd(), "src/shell/SidebarNavigation.tsx"),
      "utf8",
    );
    expect(sidebar).toContain("<p className={styles.sectionTitle}>{section.title}</p>");
    expect(sidebar).not.toContain("drill");
  });
});
