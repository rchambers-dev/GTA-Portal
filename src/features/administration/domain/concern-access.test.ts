import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import {
  canReadAllLearnerConcerns,
  concernGtaIdsForReader,
  tutorCountsForConcerns,
  visibleConcerns,
} from "./concern-access";

const tutor = { baseRole: "Tutor", permissions: [PERMISSIONS.STAFF_WORKSPACE_VIEW, PERMISSIONS.REVIEWS_TUTOR] };

describe("learner concern read access", () => {
  it("lets managers, administrators and safeguarding or concerns permissions see every concern", () => {
    expect(canReadAllLearnerConcerns({ baseRole: "Management", permissions: [] })).toBe(true);
    expect(canReadAllLearnerConcerns({ baseRole: "Administrator", permissions: [] })).toBe(true);
    expect(canReadAllLearnerConcerns({ baseRole: "Tutor", permissions: [PERMISSIONS.SAFEGUARDING_CASES_VIEW] })).toBe(true);
    expect(canReadAllLearnerConcerns({ baseRole: "Staff", permissions: [PERMISSIONS.EMPLOYER_CONCERNS_MANAGE] })).toBe(true);
    expect(canReadAllLearnerConcerns({ baseRole: "Staff", permissions: [PERMISSIONS.MANAGEMENT_EMPLOYER_CONCERNS] })).toBe(true);
    expect(canReadAllLearnerConcerns({ baseRole: "Staff", permissions: [PERMISSIONS.SAFEGUARDING_WORKSPACE_VIEW] })).toBe(true);
  });

  it("limits a tutor whose only access is being a tutor", () => {
    expect(canReadAllLearnerConcerns(tutor)).toBe(false);
    expect(concernGtaIdsForReader({ canReadAll: false, tutorCounted: true, assignedGtaIds: ["GTA-1", "GTA-2"] })).toEqual(
      new Set(["GTA-1", "GTA-2"]),
    );
    expect(visibleConcerns(
      [{ gta_id: "GTA-1" }, { gta_id: "GTA-9" }],
      concernGtaIdsForReader({ canReadAll: false, tutorCounted: true, assignedGtaIds: ["GTA-1"] }),
    )).toEqual([{ gta_id: "GTA-1" }]);
  });

  it("counts invited tutors and leaves disabled or archived tutors with no concerns", () => {
    expect(tutorCountsForConcerns({ portalStatus: "invited", archivedAt: null })).toBe(true);
    expect(tutorCountsForConcerns({ portalStatus: "active", archivedAt: null })).toBe(true);
    expect(tutorCountsForConcerns({ portalStatus: "disabled", archivedAt: null })).toBe(false);
    expect(tutorCountsForConcerns({ portalStatus: "active", archivedAt: "2026-01-01" })).toBe(false);
    expect(concernGtaIdsForReader({ canReadAll: false, tutorCounted: false, assignedGtaIds: ["GTA-1"] })).toEqual(new Set());
  });

  it("does not hide concerns from someone who can read them all", () => {
    expect(visibleConcerns(
      [{ gta_id: "GTA-1" }, { gta_id: "GTA-9" }],
      concernGtaIdsForReader({ canReadAll: true, tutorCounted: false, assignedGtaIds: [] }),
    )).toEqual([{ gta_id: "GTA-1" }, { gta_id: "GTA-9" }]);
  });

  it("pins the database read to the tutor's own apprentices and writes an audit row", () => {
    const sql = readFileSync(
      new URL("../../../../supabase/migrations/20261127100111_portal_009_tutor_concern_reads.sql", import.meta.url),
      "utf8",
    );
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("portal_status is distinct from 'disabled'");
    expect(sql).toContain("archived_at is null");
    expect(sql).toContain("end_date is null");
    expect(sql).toContain("start_date <= (now() at time zone 'Europe/London')::date");
    expect(sql).not.toContain("learner_concerns_select_reader");
    expect(sql).not.toContain("drop policy if exists learner_concerns_select_admin_mgmt");
    expect(sql).toContain("grant execute on function public.get_learner_concerns(text) to authenticated, service_role");
    expect(sql).toContain("when others then");
    expect(sql).not.toContain("to anon");
    expect(sql).toContain("select distinct v_uid, 'learner_concern'");
    expect(sql).toContain("insert into public.audit_events");
    expect(sql).toContain("'learner_concern'");
    expect(sql).toContain("safeguarding.cases.view");
    expect(sql).toContain("employer.concerns.manage");
  });
});
