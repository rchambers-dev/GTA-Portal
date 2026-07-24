import { describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS } from "@/adapters/fictional/demo-accounts";
import { CURRICULUM_EDITOR_PACK, PERMISSIONS } from "@/lib/permissions/capabilities";
import {
  buildEffectiveSession,
  getActiveAssignments,
  hasPermission,
  hasProgrammeScope,
  isAssignmentActive,
} from "@/lib/permissions/effective-permissions";
import { canAccessRoute } from "@/lib/permissions/route-access";
import { resolveNavigation } from "@/shell/workspaces/resolve-navigation";
import type { TemporaryAssignment } from "@/lib/portal/types";

const daniel = DEMO_ACCOUNTS.find((a) => a.id === "daniel-turner")!;
const sarah = DEMO_ACCOUNTS.find((a) => a.id === "sarah-patel")!;
const james = DEMO_ACCOUNTS.find((a) => a.id === "james-wilson")!;

function makeAssignment(
  partial: Partial<TemporaryAssignment> & Pick<TemporaryAssignment, "userId">,
): TemporaryAssignment {
  return {
    id: "assign-test",
    responsibility: "Curriculum Editor",
    permissions: [...CURRICULUM_EDITOR_PACK],
    programmeScope: ["Accident Repair Technician"],
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    grantedBy: "jon-harrison",
    grantedByName: "Jon Harrison",
    ...partial,
  };
}

describe("effective permissions", () => {
  it("gives Sarah curriculum management without publish", () => {
    const session = buildEffectiveSession(sarah, []);
    expect(hasPermission(session, PERMISSIONS.CURRICULUM_MANAGEMENT_VIEW)).toBe(true);
    expect(hasPermission(session, PERMISSIONS.CURRICULUM_PUBLISH)).toBe(false);
    expect(hasProgrammeScope(session, "Accident Repair Technician")).toBe(true);
  });

  it("blocks Daniel from curriculum routes until temporary pack is granted", () => {
    const session = buildEffectiveSession(daniel, []);
    expect(hasPermission(session, PERMISSIONS.CURRICULUM_MANAGEMENT_VIEW)).toBe(false);
    expect(canAccessRoute(session, "/curriculum/overview")).toBe(false);
    expect(resolveNavigation(session).some((s) => s.title === "Curriculum Management")).toBe(
      false,
    );
  });

  it("reveals curriculum navigation for Daniel with active temporary assignment", () => {
    const assignment = makeAssignment({ userId: daniel.id });
    const session = buildEffectiveSession(daniel, [assignment]);
    expect(hasPermission(session, PERMISSIONS.CURRICULUM_EDIT)).toBe(true);
    expect(canAccessRoute(session, "/curriculum/overview")).toBe(true);
    expect(resolveNavigation(session).some((s) => s.title === "Curriculum Management")).toBe(
      true,
    );
  });

  it("ignores expired and revoked assignments", () => {
    const expired = makeAssignment({
      userId: daniel.id,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(isAssignmentActive(expired)).toBe(false);
    expect(getActiveAssignments([expired], daniel.id)).toHaveLength(0);

    const revoked = makeAssignment({
      userId: daniel.id,
      revokedAt: new Date().toISOString(),
    });
    expect(isAssignmentActive(revoked)).toBe(false);
  });

  it("does not treat /learners routes as learner-own workspace", () => {
    const session = buildEffectiveSession(daniel, []);
    expect(canAccessRoute(session, "/learners/lifecycle")).toBe(true);
    expect(canAccessRoute(session, "/learner/dashboard")).toBe(false);
  });

  it("does not treat /employer-concerns as employer workspace", () => {
    const session = buildEffectiveSession(daniel, []);
    expect(canAccessRoute(session, "/employer-concerns")).toBe(false);
    const mentor = DEMO_ACCOUNTS.find((a) => a.id === "reiss-chambers")!;
    const mentorSession = buildEffectiveSession(mentor, []);
    expect(canAccessRoute(mentorSession, "/employer-concerns")).toBe(true);
    expect(canAccessRoute(mentorSession, "/employer/dashboard")).toBe(false);
  });
});
