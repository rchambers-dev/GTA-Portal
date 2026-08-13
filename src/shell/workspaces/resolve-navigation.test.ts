import { describe, expect, it } from "vitest";
import { resolveNavigation } from "./resolve-navigation";
import type { EffectiveSession } from "@/lib/portal/types";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

function apprenticeSession(): EffectiveSession {
  return {
    account: {
      id: "acc",
      name: "TEST",
      initials: "T",
      email: "test@example.invalid",
      baseRole: "apprentice",
      responsibilities: [],
      workspace: "apprentice",
      permissions: [
        PERMISSIONS.APPRENTICE_WORKSPACE_OWN,
        PERMISSIONS.APPRENTICE_MODULES_VIEW,
        PERMISSIONS.APPRENTICE_OTJ_VIEW,
        PERMISSIONS.MESSAGES_VIEW,
      ],
      linkedApprenticeId: "apprentice-1",
    },
    permissions: [
      PERMISSIONS.APPRENTICE_WORKSPACE_OWN,
      PERMISSIONS.APPRENTICE_MODULES_VIEW,
      PERMISSIONS.APPRENTICE_OTJ_VIEW,
      PERMISSIONS.MESSAGES_VIEW,
    ],
    activeTemporaryAssignments: [],
    temporaryAccessLabels: [],
  };
}

describe("apprentice navigation", () => {
  it("does not depend on a groups delivery spine and includes My Learning", () => {
    const items = resolveNavigation(apprenticeSession()).flatMap((s) => s.items);
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toContain("/apprentice/learning");
    expect(hrefs).toContain("/apprentice/progress");
    expect(hrefs).toContain("/apprentice/tracking");
    expect(items.find((i) => i.href === "/apprentice/tracking")?.label).toBe(
      "Tasks & evidence",
    );
    expect(hrefs.join(" ")).not.toMatch(/cea-sign-offs/);
  });
});
