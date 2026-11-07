import { describe, expect, it } from "vitest";
import { emptyDirectory, type DirectorySnapshot } from "./model";
import {
  companiesForSite,
  learnersForCompany,
  reduceDirectory,
  rolesForCompany,
  sitesForCompany,
} from "./reduce";

const ids = ["c1", "c2", "s1", "s2", "m1", "m2", "r1", "r2", "l1"];
let cursor = 0;
function createId(): string {
  const id = ids[cursor] ?? `id-${cursor}`;
  cursor += 1;
  return id;
}

function resetIds(): void {
  cursor = 0;
}

function okSnapshot(result: ReturnType<typeof reduceDirectory>): DirectorySnapshot {
  if (!result.ok) throw new Error(result.error);
  return result.snapshot;
}

describe("employer directory", () => {
  it("keeps two companies at one physical site without merging them", () => {
    resetIds();
    let snapshot = emptyDirectory();
    snapshot = okSnapshot(
      reduceDirectory(snapshot, { action: "createCompany", input: { name: "North Motors" } }, createId),
    );
    snapshot = okSnapshot(
      reduceDirectory(snapshot, { action: "createCompany", input: { name: "South Motors" } }, createId),
    );
    snapshot = okSnapshot(
      reduceDirectory(
        snapshot,
        {
          action: "createSite",
          input: { label: "Shared yard", addressLine1: "1 Yard Street", postcode: "DN1 1AA" },
        },
        createId,
      ),
    );
    const siteId = snapshot.sites[0].id;
    snapshot = okSnapshot(
      reduceDirectory(snapshot, {
        action: "linkCompanySite",
        companyId: snapshot.companies[0].id,
        siteId,
      }),
    );
    snapshot = okSnapshot(
      reduceDirectory(snapshot, {
        action: "linkCompanySite",
        companyId: snapshot.companies[1].id,
        siteId,
      }),
    );
    expect(companiesForSite(snapshot, siteId).map((company) => company.name)).toEqual([
      "North Motors",
      "South Motors",
    ]);
    expect(snapshot.companies).toHaveLength(2);
    expect(snapshot.sites).toHaveLength(1);
  });

  it("lets one company use two sites and two managers", () => {
    resetIds();
    let snapshot = emptyDirectory();
    snapshot = okSnapshot(
      reduceDirectory(snapshot, { action: "createCompany", input: { name: "Harbour Autos" } }, createId),
    );
    const companyId = snapshot.companies[0].id;
    snapshot = okSnapshot(
      reduceDirectory(snapshot, { action: "createSite", input: { label: "Quay" } }, createId),
    );
    snapshot = okSnapshot(
      reduceDirectory(snapshot, { action: "createSite", input: { label: "Depot" } }, createId),
    );
    for (const site of snapshot.sites) {
      snapshot = okSnapshot(
        reduceDirectory(snapshot, { action: "linkCompanySite", companyId, siteId: site.id }),
      );
    }
    snapshot = okSnapshot(
      reduceDirectory(snapshot, { action: "createManager", input: { fullName: "Alex Manager" } }, createId),
    );
    snapshot = okSnapshot(
      reduceDirectory(
        snapshot,
        { action: "createManager", input: { fullName: "Blair Manager", confirmDistinct: true } },
        createId,
      ),
    );
    const quay = snapshot.sites[0];
    const [alex, blair] = snapshot.managers;
    snapshot = okSnapshot(
      reduceDirectory(
        snapshot,
        {
          action: "assignManagerRole",
          input: { managerId: alex.id, companyId, siteId: quay.id, responsibility: "Quay lead" },
        },
        createId,
      ),
    );
    snapshot = okSnapshot(
      reduceDirectory(
        snapshot,
        {
          action: "assignManagerRole",
          input: { managerId: blair.id, companyId, responsibility: "Company contact" },
        },
        createId,
      ),
    );
    expect(sitesForCompany(snapshot, companyId)).toHaveLength(2);
    expect(rolesForCompany(snapshot, companyId)).toHaveLength(2);
    expect(rolesForCompany(snapshot, companyId).filter((role) => role.siteId === null)).toHaveLength(1);
  });

  it("does not merge a repeated company, site, or manager name", () => {
    resetIds();
    let snapshot = okSnapshot(
      reduceDirectory(emptyDirectory(), { action: "createCompany", input: { name: "Same Name Ltd" } }, createId),
    );
    const blocked = reduceDirectory(snapshot, {
      action: "createCompany",
      input: { name: "same   name ltd" },
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.status).toBe(409);
      expect(blocked.candidates?.[0]?.id).toBe(snapshot.companies[0].id);
    }
    snapshot = okSnapshot(
      reduceDirectory(
        snapshot,
        { action: "createCompany", input: { name: "Same Name Ltd", confirmDistinct: true } },
        createId,
      ),
    );
    expect(snapshot.companies).toHaveLength(2);

    snapshot = okSnapshot(
      reduceDirectory(snapshot, { action: "createManager", input: { fullName: "Jo Smith", email: "jo.a@example.invalid" } }, createId),
    );
    const person = reduceDirectory(snapshot, {
      action: "createManager",
      input: { fullName: "Jo Smith", email: "jo.b@example.invalid" },
    });
    expect(person.ok).toBe(false);
    if (!person.ok) expect(person.candidates?.[0]?.detail).toContain("jo.a@example.invalid");
  });

  it("rejects a manager site that belongs to another company", () => {
    resetIds();
    let snapshot = emptyDirectory();
    snapshot = okSnapshot(reduceDirectory(snapshot, { action: "createCompany", input: { name: "A" } }, createId));
    snapshot = okSnapshot(reduceDirectory(snapshot, { action: "createCompany", input: { name: "B" } }, createId));
    snapshot = okSnapshot(reduceDirectory(snapshot, { action: "createSite", input: { label: "B yard" } }, createId));
    snapshot = okSnapshot(
      reduceDirectory(snapshot, {
        action: "linkCompanySite",
        companyId: snapshot.companies[1].id,
        siteId: snapshot.sites[0].id,
      }),
    );
    snapshot = okSnapshot(
      reduceDirectory(snapshot, { action: "createManager", input: { fullName: "Pat" } }, createId),
    );
    const denied = reduceDirectory(snapshot, {
      action: "assignManagerRole",
      input: {
        managerId: snapshot.managers[0].id,
        companyId: snapshot.companies[0].id,
        siteId: snapshot.sites[0].id,
      },
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error).toMatch(/not linked to the company/i);
  });
});

describe("review learners", () => {
  it("creates a learner with only a full name and no employer, account, or enrolment", () => {
    resetIds();
    const result = reduceDirectory(
      emptyDirectory(),
      { action: "createReviewLearner", input: { fullName: "  Alex Patel  " } },
      createId,
      () => 0,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.writes.map((write) => write.table)).toEqual(["review_learners"]);
    const learner = result.snapshot.learners[0];
    expect(learner.fullName).toBe("Alex Patel");
    expect(learner.portalReference).toBe(`GTA-${new Date().getFullYear()}-01000`);
    expect(learner.companyId).toBeNull();
    expect(learner.siteId).toBeNull();
    expect(learner.managerRoleId).toBeNull();
    expect(learner.sourceCompanyName).toBe("");
    expect(learner.sourcePostcode).toBe("");
    expect(learner.apprenticeshipStartDate).toBeNull();
    expect(learner.apprenticeshipEndDate).toBeNull();
    expect(JSON.stringify(result.writes)).not.toMatch(/apprentice_programmes|profiles|employers"|auth/);
  });

  it("retries a portal reference that is already used", () => {
    resetIds();
    const year = new Date().getFullYear();
    const first = reduceDirectory(
      emptyDirectory(),
      { action: "createReviewLearner", input: { fullName: "First Person" } },
      createId,
      () => 0,
    );
    if (!first.ok) throw new Error(first.error);
    let calls = 0;
    const second = reduceDirectory(
      first.snapshot,
      { action: "createReviewLearner", input: { fullName: "Second Person" } },
      createId,
      () => {
        calls += 1;
        return calls === 1 ? 0 : 0.5;
      },
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.snapshot.learners.map((learner) => learner.portalReference)).toEqual([
      `GTA-${year}-01000`,
      `GTA-${year}-05500`,
    ]);
  });

  it("keeps a recorded company name unresolved until someone attaches a company", () => {
    resetIds();
    let snapshot = okSnapshot(
      reduceDirectory(emptyDirectory(), { action: "createCompany", input: { name: "Polypipe" } }, createId),
    );
    snapshot = okSnapshot(
      reduceDirectory(
        snapshot,
        {
          action: "createReviewLearner",
          input: { fullName: "Casey Learner", sourceCompanyName: "Polypipe", sourcePostcode: "dn2 5qj" },
        },
        createId,
      ),
    );
    expect(snapshot.companies).toHaveLength(1);
    expect(snapshot.sites).toHaveLength(0);
    expect(snapshot.learners[0].companyId).toBeNull();
    expect(snapshot.learners[0].sourceCompanyName).toBe("Polypipe");
    expect(snapshot.learners[0].sourcePostcode).toBe("DN2 5QJ");
  });

  it("attaches, changes, and clears one company, site, and manager relationship", () => {
    resetIds();
    let snapshot = emptyDirectory();
    snapshot = okSnapshot(reduceDirectory(snapshot, { action: "createCompany", input: { name: "Alpha" } }, createId));
    snapshot = okSnapshot(reduceDirectory(snapshot, { action: "createCompany", input: { name: "Beta" } }, createId));
    snapshot = okSnapshot(reduceDirectory(snapshot, { action: "createSite", input: { label: "Alpha yard" } }, createId));
    snapshot = okSnapshot(reduceDirectory(snapshot, { action: "createSite", input: { label: "Beta yard" } }, createId));
    const [alpha, beta] = snapshot.companies;
    const [alphaYard, betaYard] = snapshot.sites;
    snapshot = okSnapshot(reduceDirectory(snapshot, { action: "linkCompanySite", companyId: alpha.id, siteId: alphaYard.id }));
    snapshot = okSnapshot(reduceDirectory(snapshot, { action: "linkCompanySite", companyId: beta.id, siteId: betaYard.id }));
    snapshot = okSnapshot(reduceDirectory(snapshot, { action: "createManager", input: { fullName: "Alpha Lead" } }, createId));
    snapshot = okSnapshot(reduceDirectory(snapshot, { action: "createManager", input: { fullName: "Beta Lead" } }, createId));
    snapshot = okSnapshot(
      reduceDirectory(snapshot, {
        action: "assignManagerRole",
        input: { managerId: snapshot.managers[0].id, companyId: alpha.id, siteId: alphaYard.id },
      }, createId),
    );
    snapshot = okSnapshot(
      reduceDirectory(snapshot, {
        action: "assignManagerRole",
        input: { managerId: snapshot.managers[1].id, companyId: beta.id, siteId: betaYard.id },
      }, createId),
    );
    snapshot = okSnapshot(
      reduceDirectory(snapshot, {
        action: "createReviewLearner",
        input: {
          fullName: "Riley Learner",
          sourceContactName: "Recorded contact",
          sourceContactEmail: "recorded@example.invalid",
        },
      }, createId),
    );
    const learnerId = snapshot.learners[0].id;
    const alphaRole = snapshot.roles[0].id;
    const betaRole = snapshot.roles[1].id;
    const mismatch = reduceDirectory(snapshot, {
      action: "linkReviewLearner",
      id: learnerId,
      link: { companyId: alpha.id, siteId: betaYard.id, managerRoleId: alphaRole },
    });
    expect(mismatch.ok).toBe(false);
    const wrongManager = reduceDirectory(snapshot, {
      action: "linkReviewLearner",
      id: learnerId,
      link: { companyId: alpha.id, siteId: alphaYard.id, managerRoleId: betaRole },
    });
    expect(wrongManager.ok).toBe(false);
    if (!wrongManager.ok) expect(wrongManager.error).toMatch(/not responsible for the selected company/i);

    snapshot = okSnapshot(
      reduceDirectory(snapshot, {
        action: "linkReviewLearner",
        id: learnerId,
        link: { companyId: alpha.id, siteId: alphaYard.id, managerRoleId: alphaRole },
      }),
    );
    expect(learnersForCompany(snapshot, alpha.id)).toHaveLength(1);
    expect(snapshot.learners[0].sourceContactEmail).toBe("recorded@example.invalid");
    expect(snapshot.managers[0].email).toBe("");
    const linked = reduceDirectory(snapshot, {
      action: "linkReviewLearner",
      id: learnerId,
      link: { companyId: alpha.id, siteId: alphaYard.id, managerRoleId: alphaRole },
    });
    if (!linked.ok) throw new Error(linked.error);
    expect(linked.writes.every((write) => write.table === "review_learners")).toBe(true);

    snapshot = okSnapshot(
      reduceDirectory(snapshot, {
        action: "linkReviewLearner",
        id: learnerId,
        link: { companyId: beta.id, siteId: betaYard.id, managerRoleId: betaRole },
      }),
    );
    expect(learnersForCompany(snapshot, alpha.id)).toHaveLength(0);
    expect(learnersForCompany(snapshot, beta.id)).toHaveLength(1);

    snapshot = okSnapshot(
      reduceDirectory(snapshot, {
        action: "linkReviewLearner",
        id: learnerId,
        link: { companyId: null, siteId: null, managerRoleId: null },
      }),
    );
    expect(snapshot.learners[0].companyId).toBeNull();
    expect(snapshot.learners[0].sourceContactName).toBe("Recorded contact");
    expect(snapshot.companies).toHaveLength(2);
  });

  it("rejects a blank name and does not split a full name", () => {
    const missing = reduceDirectory(emptyDirectory(), {
      action: "createReviewLearner",
      input: { fullName: "   " },
    });
    expect(missing.ok).toBe(false);
    const named = reduceDirectory(
      emptyDirectory(),
      { action: "createReviewLearner", input: { fullName: "Mary Ann Smith" } },
      () => "learner-1",
      () => 0.2,
    );
    if (!named.ok) throw new Error(named.error);
    expect(named.snapshot.learners[0].fullName).toBe("Mary Ann Smith");
  });
});
