import { describe, expect, it } from "vitest";
import { CURRICULUM_EDITOR_PACK, PERMISSIONS, STANDARD_TUTOR_PACK } from "@/lib/permissions/capabilities";
import {
  buildEffectiveSession,
  getActiveAssignments,
  hasPermission,
  hasProgrammeScope,
  isAssignmentActive,
} from "@/lib/permissions/effective-permissions";
import { canAccessRoute } from "@/lib/permissions/route-access";
import { resolveNavigation } from "@/shell/workspaces/resolve-navigation";
import type { PortalAccount, TemporaryAssignment } from "@/lib/portal/types";

const daniel: PortalAccount = {
  id: "daniel-turner",
  name: "Daniel Turner",
  initials: "DT",
  email: "daniel.turner@example.test",
  baseRole: "Tutor",
  responsibilities: [],
  department: "Automotive",
  workspace: "staff",
  permissions: [...STANDARD_TUTOR_PACK],
  departmentScope: ["Automotive"],
};

const sarah: PortalAccount = {
  id: "sarah-patel",
  name: "Sarah Patel",
  initials: "SP",
  email: "sarah.patel@example.test",
  baseRole: "Tutor",
  responsibilities: ["Curriculum Editor"],
  department: "Automotive",
  workspace: "staff",
  permissions: [...STANDARD_TUTOR_PACK, ...CURRICULUM_EDITOR_PACK],
  departmentScope: ["Automotive"],
  programmeScope: ["Accident Repair Technician"],
};

const mentor: PortalAccount = {
  id: "reiss-chambers",
  name: "Reiss Chambers",
  initials: "RC",
  email: "reiss.chambers@example.test",
  baseRole: "Learning and Progress Mentor",
  responsibilities: [],
  workspace: "staff",
  permissions: [
    PERMISSIONS.STAFF_WORKSPACE_VIEW,
    PERMISSIONS.APPRENTICE_CASELOAD_VIEW,
    PERMISSIONS.PROGRESS_MONITOR,
    PERMISSIONS.REVIEWS_MANAGE,
    PERMISSIONS.EMPLOYER_CONTACTS_VIEW,
    PERMISSIONS.EMPLOYER_CONCERNS_MANAGE,
    PERMISSIONS.INTERVENTIONS_MANAGE,
    PERMISSIONS.SUPPORT_PLANS_MANAGE,
    PERMISSIONS.ATTENDANCE_CONCERNS_VIEW,
    PERMISSIONS.ACTIONS_MANAGE,
    PERMISSIONS.MESSAGES_VIEW,
    PERMISSIONS.LIFECYCLE_KANBAN_VIEW,
    PERMISSIONS.APPRENTICE_WORKSPACE_VIEW,
    PERMISSIONS.AI_USE,
  ],
};

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

  it("does not treat /apprentices routes as apprentice-own workspace", () => {
    const session = buildEffectiveSession(daniel, []);
    expect(canAccessRoute(session, "/apprentices/lifecycle")).toBe(true);
    expect(canAccessRoute(session, "/apprentice/dashboard")).toBe(false);
  });

  it("does not treat /employer-concerns as employer workspace", () => {
    const session = buildEffectiveSession(daniel, []);
    expect(canAccessRoute(session, "/employer-concerns")).toBe(false);
    const mentorSession = buildEffectiveSession(mentor, []);
    expect(canAccessRoute(mentorSession, "/employer-concerns")).toBe(true);
    expect(canAccessRoute(mentorSession, "/employer/dashboard")).toBe(false);
  });
});
