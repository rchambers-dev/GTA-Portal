import { describe, expect, it } from "vitest";
import { emptyDirectory, type DirectorySnapshot } from "./model";
import {
  apprenticesForEmployer,
  employersForSite,
  reduceDirectory,
  rolesForEmployer,
  sitesForEmployer,
} from "./reduce";

const ids = ["e1", "e2", "s1", "s2", "m1", "m2", "r1", "r2", "a1", "a2"];
let cursor = 0;
function createId(): string {
  const id = ids[cursor] ?? `id-${cursor}`;
  cursor += 1;
  return id;
}
function resetIds(): void {
  cursor = 0;
}
function ok(result: ReturnType<typeof reduceDirectory>): DirectorySnapshot {
  if (!result.ok) throw new Error(result.error);
  return result.snapshot;
}

describe("canonical employers and sites", () => {
  it("keeps two employers at one site and does not create a second company table", () => {
    resetIds();
    let snapshot = emptyDirectory();
    snapshot = ok(reduceDirectory(snapshot, { action: "createEmployer", input: { name: "North Motors" } }, createId));
    snapshot = ok(reduceDirectory(snapshot, { action: "createEmployer", input: { name: "South Motors" } }, createId));
    snapshot = ok(
      reduceDirectory(snapshot, {
        action: "createSite",
        input: { label: "Shared yard", addressLine1: "1 Yard Street", postcode: "DN1 1AA" },
      }, createId),
    );
    const siteId = snapshot.sites[0].id;
    snapshot = ok(reduceDirectory(snapshot, { action: "linkEmployerSite", employerId: snapshot.employers[0].id, siteId }));
    snapshot = ok(reduceDirectory(snapshot, { action: "linkEmployerSite", employerId: snapshot.employers[1].id, siteId }));
    expect(employersForSite(snapshot, siteId).map((row) => row.name)).toEqual([
      "North Motors",
      "South Motors",
    ]);
    expect(snapshot.employers[0].addressLine1).toBe("");
  });

  it("lets one employer have two sites and two managers", () => {
    resetIds();
    let snapshot = ok(reduceDirectory(emptyDirectory(), { action: "createEmployer", input: { name: "Harbour Autos" } }, createId));
    const employerId = snapshot.employers[0].id;
    snapshot = ok(reduceDirectory(snapshot, { action: "createSite", input: { label: "Quay" } }, createId));
    snapshot = ok(reduceDirectory(snapshot, { action: "createSite", input: { label: "Depot" } }, createId));
    for (const site of snapshot.sites) {
      snapshot = ok(reduceDirectory(snapshot, { action: "linkEmployerSite", employerId, siteId: site.id }));
    }
    snapshot = ok(reduceDirectory(snapshot, { action: "createManager", input: { fullName: "Alex Manager" } }, createId));
    snapshot = ok(reduceDirectory(snapshot, { action: "createManager", input: { fullName: "Blair Manager" } }, createId));
    snapshot = ok(reduceDirectory(snapshot, {
      action: "assignManagerRole",
      input: { managerId: snapshot.managers[0].id, employerId, siteId: snapshot.sites[0].id },
    }, createId));
    snapshot = ok(reduceDirectory(snapshot, {
      action: "assignManagerRole",
      input: { managerId: snapshot.managers[1].id, employerId },
    }, createId));
    expect(sitesForEmployer(snapshot, employerId)).toHaveLength(2);
    expect(rolesForEmployer(snapshot, employerId)).toHaveLength(2);
  });

  it("does not merge a repeated employer or manager name", () => {
    resetIds();
    let snapshot = ok(reduceDirectory(emptyDirectory(), { action: "createEmployer", input: { name: "Same Name Ltd" } }, createId));
    const blocked = reduceDirectory(snapshot, { action: "createEmployer", input: { name: "same name ltd" } });
    expect(blocked.ok).toBe(false);
    snapshot = ok(reduceDirectory(snapshot, { action: "createEmployer", input: { name: "Same Name Ltd", confirmDistinct: true } }, createId));
    expect(snapshot.employers).toHaveLength(2);
  });
});

describe("apprentice register", () => {
  it("creates an apprentice row, not a second person master, and no enrolment or login", () => {
    resetIds();
    const result = reduceDirectory(
      emptyDirectory(),
      { action: "createReviewApprentice", input: { fullName: "  Alex Patel  " } },
      createId,
      () => 0,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.writes).toHaveLength(1);
    expect(result.writes[0].op).toBe("rpc");
    if (result.writes[0].op !== "rpc") return;
    expect(result.writes[0].fn).toBe("create_review_apprentice");
    expect(result.writes[0].args.p_row).toMatchObject({
      display_name: "Alex Patel",
      source_company_name: "",
    });
    expect(result.snapshot.apprentices[0]).toMatchObject({
      displayName: "Alex Patel",
      portalEntry: "reviews",
      apprenticeReference: `GTA-${new Date().getFullYear()}-01000`,
    });
    expect(result.snapshot.reviewDetails[0]).toMatchObject({
      apprenticeId: result.snapshot.apprentices[0].id,
      version: 1,
      employerId: null,
      sourceCompanyName: "",
    });
    const apprenticeWrite = result.writes[0];
    if (apprenticeWrite.op !== "rpc") throw new Error("expected one create call");
    expect(apprenticeWrite.args.p_row).toMatchObject({
      display_name: "Alex Patel",
      apprentice_reference: result.snapshot.apprentices[0].apprenticeReference,
    });
    expect(apprenticeWrite.args.p_row).not.toHaveProperty("email");
    expect(JSON.stringify(result.writes)).not.toMatch(/apprentice_programmes|profiles|auth/);
  });

  it("retries a colliding apprentice reference", () => {
    resetIds();
    const year = new Date().getFullYear();
    const first = reduceDirectory(emptyDirectory(), { action: "createReviewApprentice", input: { fullName: "First Person" } }, createId, () => 0);
    if (!first.ok) throw new Error(first.error);
    let calls = 0;
    const second = reduceDirectory(first.snapshot, { action: "createReviewApprentice", input: { fullName: "Second Person" } }, createId, () => {
      calls += 1;
      return calls === 1 ? 0 : 0.5;
    });
    if (!second.ok) throw new Error(second.error);
    expect(second.snapshot.apprentices.map((row) => row.apprenticeReference)).toEqual([
      `GTA-${year}-01000`,
      `GTA-${year}-05500`,
    ]);
  });

  it("keeps a recorded company name unresolved and does not invent a site from the postcode", () => {
    resetIds();
    let snapshot = ok(reduceDirectory(emptyDirectory(), { action: "createEmployer", input: { name: "Polypipe" } }, createId));
    snapshot = ok(reduceDirectory(snapshot, {
      action: "createReviewApprentice",
      input: { fullName: "Casey Learner", sourceCompanyName: "Polypipe", sourcePostcode: "dn2 5qj" },
    }, createId));
    expect(snapshot.sites).toHaveLength(0);
    expect(snapshot.reviewDetails[0].employerId).toBeNull();
    expect(snapshot.reviewDetails[0].sourceCompanyName).toBe("Polypipe");
    expect(snapshot.reviewDetails[0].sourcePostcode).toBe("DN2 5QJ");
  });

  it("updates only the sent fields and rejects a stale version before it can overwrite a link", () => {
    resetIds();
    let snapshot = ok(reduceDirectory(emptyDirectory(), { action: "createEmployer", input: { name: "Alpha" } }, createId));
    snapshot = ok(reduceDirectory(snapshot, { action: "createReviewApprentice", input: { fullName: "Riley Learner", tutorName: "Original tutor" } }, createId));
    const apprenticeId = snapshot.apprentices[0].id;
    const employerId = snapshot.employers[0].id;
    const linked = reduceDirectory(snapshot, {
      action: "linkReviewApprentice",
      apprenticeId,
      expectedVersion: 1,
      link: { employerId, siteId: null, managerRoleId: null },
    });
    if (!linked.ok) throw new Error(linked.error);
    expect(linked.writes).toHaveLength(1);
    expect(linked.writes[0]).toMatchObject({
      op: "rpc",
      fn: "apply_review_apprentice_change",
      args: {
        p_expected_version: 1,
        p_display_name: null,
        p_fields: {
          employer_id: employerId,
          site_id: null,
          manager_role_id: null,
        },
      },
    });
    const stale = reduceDirectory(linked.snapshot, {
      action: "updateReviewDetails",
      apprenticeId,
      expectedVersion: 1,
      patch: { tutorName: "Newer tutor", sourceContactEmail: "recorded@example.invalid" },
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("version_conflict");
    const fresh = reduceDirectory(linked.snapshot, {
      action: "updateReviewDetails",
      apprenticeId,
      expectedVersion: 2,
      patch: { tutorName: "Newer tutor" },
    });
    if (!fresh.ok) throw new Error(fresh.error);
    const detailWrite = fresh.writes[0];
    if (!detailWrite || detailWrite.op !== "rpc") throw new Error("missing update");
    expect(detailWrite.args.p_fields).toEqual({ tutor_name: "Newer tutor" });
    expect(detailWrite.args.p_display_name).toBeNull();
    expect(detailWrite.args.p_expected_version).toBe(2);
    expect(detailWrite.args.p_fields).not.toHaveProperty("employer_id");
    expect(fresh.snapshot.reviewDetails[0].employerId).toBe(employerId);
    expect(fresh.snapshot.reviewDetails[0].sourceContactEmail).toBe("");
    expect(apprenticesForEmployer(fresh.snapshot, employerId)).toHaveLength(1);
  });

  it("keeps a name change inside the same versioned call", () => {
    resetIds();
    const created = reduceDirectory(
      emptyDirectory(),
      { action: "createReviewApprentice", input: { fullName: "Riley Learner" } },
      createId,
    );
    if (!created.ok) throw new Error(created.error);
    expect(created.writes).toHaveLength(1);
    expect(created.writes[0].op).toBe("rpc");
    const renamed = reduceDirectory(created.snapshot, {
      action: "updateReviewDetails",
      apprenticeId: created.snapshot.apprentices[0].id,
      expectedVersion: 1,
      patch: { fullName: "Riley Learner Updated" },
    });
    if (!renamed.ok) throw new Error(renamed.error);
    expect(renamed.writes).toHaveLength(1);
    if (renamed.writes[0].op !== "rpc") throw new Error("expected one call");
    expect(renamed.writes[0].args.p_display_name).toBe("Riley Learner Updated");
    expect(renamed.writes[0].args.p_expected_version).toBe(1);
  });

  it("attaches review details to an existing apprentice who has none", () => {
    const snapshot = emptyDirectory();
    snapshot.apprentices.push({
      id: "person-1",
      displayName: "Existing Apprentice",
      apprenticeReference: "GTA-2026-00001",
      portalEntry: "onboarding",
    });
    const saved = reduceDirectory(snapshot, {
      action: "updateReviewDetails",
      apprenticeId: "person-1",
      expectedVersion: 0,
      patch: { tutorName: "Tutor Example" },
    });
    if (!saved.ok) throw new Error(saved.error);
    expect(saved.snapshot.apprentices).toHaveLength(1);
    expect(saved.snapshot.reviewDetails[0]).toMatchObject({
      apprenticeId: "person-1",
      version: 1,
      tutorName: "Tutor Example",
    });
  });

  it("rejects a manager from another employer", () => {
    resetIds();
    let snapshot = emptyDirectory();
    snapshot = ok(reduceDirectory(snapshot, { action: "createEmployer", input: { name: "Alpha" } }, createId));
    snapshot = ok(reduceDirectory(snapshot, { action: "createEmployer", input: { name: "Beta" } }, createId));
    snapshot = ok(reduceDirectory(snapshot, { action: "createSite", input: { label: "Beta yard" } }, createId));
    snapshot = ok(reduceDirectory(snapshot, { action: "linkEmployerSite", employerId: snapshot.employers[1].id, siteId: snapshot.sites[0].id }));
    snapshot = ok(reduceDirectory(snapshot, { action: "createManager", input: { fullName: "Beta Lead" } }, createId));
    snapshot = ok(reduceDirectory(snapshot, {
      action: "assignManagerRole",
      input: { managerId: snapshot.managers[0].id, employerId: snapshot.employers[1].id, siteId: snapshot.sites[0].id },
    }, createId));
    snapshot = ok(reduceDirectory(snapshot, { action: "createReviewApprentice", input: { fullName: "Riley Learner" } }, createId));
    const denied = reduceDirectory(snapshot, {
      action: "linkReviewApprentice",
      apprenticeId: snapshot.apprentices[0].id,
      expectedVersion: 1,
      link: {
        employerId: snapshot.employers[0].id,
        siteId: snapshot.sites[0].id,
        managerRoleId: snapshot.roles[0].id,
      },
    });
    expect(denied.ok).toBe(false);
  });
});
