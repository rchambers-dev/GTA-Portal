import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import type { EffectiveSession } from "@/lib/portal/types";
import { canReadReviewMasterState, reviewAssistantAccess } from "./access";

function session(partial: {
  workspace?: EffectiveSession["account"]["workspace"];
  baseRole?: string;
  permissions?: string[];
}): EffectiveSession {
  const permissions = partial.permissions ?? [];
  return {
    account: {
      id: "user-1",
      name: "Example",
      initials: "EX",
      email: "example@example.test",
      baseRole: partial.baseRole ?? "Tutor",
      responsibilities: [],
      workspace: partial.workspace ?? "staff",
      permissions,
    },
    permissions,
    activeTemporaryAssignments: [],
    temporaryAccessLabels: [],
  };
}

describe("review assistant access", () => {
  it("gives the full review store only to staff with admin.records.manage", () => {
    expect(
      reviewAssistantAccess(
        session({
          workspace: "administration",
          baseRole: "Administrator",
          permissions: [PERMISSIONS.ADMIN_RECORDS_MANAGE],
        }),
      ),
    ).toBe("office");
    expect(
      canReadReviewMasterState(
        session({ permissions: [PERMISSIONS.REVIEWS_MANAGE] }),
      ),
    ).toBe(false);
    expect(
      reviewAssistantAccess(
        session({ permissions: [PERMISSIONS.REVIEWS_MANAGE] }),
      ),
    ).toBe("tutor");
  });

  it("does not let apprentice or employer logins in, even with both permissions", () => {
    expect(
      reviewAssistantAccess(
        session({
          workspace: "apprentice",
          baseRole: "Apprentice",
          permissions: [
            PERMISSIONS.ADMIN_RECORDS_MANAGE,
            PERMISSIONS.REVIEWS_MANAGE,
          ],
        }),
      ),
    ).toBe("denied");
    expect(
      reviewAssistantAccess(
        session({
          workspace: "employer",
          baseRole: "Employer",
          permissions: [PERMISSIONS.REVIEWS_MANAGE],
        }),
      ),
    ).toBe("denied");
  });

  it("keeps the original version conflict rule in the vendored server", () => {
    const source = readFileSync(
      path.join(process.cwd(), "integrations/gta-reviews/server/app-state.js"),
      "utf8",
    );
    expect(source).toContain("export function versionOf");
    expect(source).toContain("export function conflictBody");
    expect(source).toContain("save_app_state_if_version");
    for (const missing of [
      "integrations/gta-reviews/server/runtime.js",
      "integrations/gta-reviews/shared/log-error.js",
      "integrations/gta-reviews/shared/app-build.js",
      "integrations/gta-reviews/server/build.js",
      "integrations/gta-reviews/public/appearance.js",
    ]) {
      expect(() => readFileSync(path.join(process.cwd(), missing), "utf8")).toThrow();
    }
  });
});
