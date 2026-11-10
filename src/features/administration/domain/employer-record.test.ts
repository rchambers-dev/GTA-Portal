import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmployerWithSiteRecord, renameEmployerRecord } from "./employer-repository";
import {
  DUPLICATE_COMPANY_NAME,
  DUPLICATE_POSTCODE,
  LAST_SITE_MESSAGE,
  POSTCODE_FORMAT_MESSAGE,
  assembleEmployers,
  canDeactivateSite,
  canManageEmployers,
  employerMatchesQuery,
  managerChoiceLabel,
  placementSiteName,
  placementsForSite,
  explainEmployerWriteError,
  toManagerInsert,
  toSiteInsert,
  validateCompanyName,
  validateManagerInput,
  validateSiteInput,
  type EmployerListItem,
  type ValidatedManager,
} from "./employer-record";

const siteId = "80f06b62-c953-4acd-aacf-630db3a861c4";
const otherSiteId = "90f06b62-c953-4acd-aacf-630db3a861c4";

function actor(baseRole: string, permissions: string[]) {
  return { account: { baseRole }, permissions };
}

const savedEmployer = {
  employer_id: "GTA-EMP-000001",
  company_name: "Example Motors",
  created_at: "2026-11-09T12:00:00.000Z",
  updated_at: "2026-11-09T12:00:00.000Z",
};

const doncasterSite = {
  id: siteId,
  postcode: "DN4 8DE",
  areaName: "Doncaster",
  siteName: null,
  isActive: true,
};

function sampleEmployer(): EmployerListItem {
  return {
    employerId: "GTA-EMP-000001",
    companyName: "Example Motors",
    createdAt: savedEmployer.created_at,
    updatedAt: savedEmployer.updated_at,
    sites: [
      doncasterSite,
      {
        id: otherSiteId,
        postcode: "LS9 0PS",
        areaName: "Leeds",
        siteName: "North yard",
        isActive: true,
      },
    ],
    managers: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        siteId,
        firstName: "Jane",
        middleNames: "Ann",
        lastName: "Smith",
        phone: "01302 000000",
        email: "jane@example.test",
      },
    ],
    placements: [
      {
        id: "placement-1",
        gtaId: "GTA-000002",
        name: "Jack Elliot",
        status: "in_learning",
        statusLabel: "In learning",
        siteId,
        managerId: "11111111-1111-4111-8111-111111111111",
        startDate: "2024-09-02",
        endDate: null,
        endReason: null,
      },
    ],
    pastPlacements: [],
  };
}

describe("employer record", () => {
  it("requires a company name and leaves the employer ID to the database", () => {
    const missing = validateCompanyName("  ");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.fieldErrors.companyName).toBe("Enter a company name.");

    const saved = validateCompanyName("  Example Motors  ");
    expect(saved.ok).toBe(true);
  });

  it("requires a UK postcode and area, and rejects a duplicate postcode", () => {
    const missing = validateSiteInput({ postcode: " ", areaName: "", siteName: "  " }, []);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.fieldErrors.postcode).toBe("Enter a postcode.");
      expect(missing.fieldErrors.areaName).toBe("Enter an area.");
    }

    const bad = validateSiteInput({ postcode: "S25", areaName: "Dinnington", siteName: "" }, []);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.fieldErrors.postcode).toBe(POSTCODE_FORMAT_MESSAGE);

    const duplicate = validateSiteInput(
      { postcode: "dn4 8de", areaName: "Doncaster", siteName: "" },
      ["DN4 8DE"],
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.fieldErrors.postcode).toBe(DUPLICATE_POSTCODE);

    const saved = validateSiteInput(
      { postcode: " s1 1aa ", areaName: " Sheffield ", siteName: "  " },
      ["DN4 8DE"],
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(toSiteInsert("GTA-EMP-000001", saved.value)).toEqual({
      employer_id: "GTA-EMP-000001",
      postcode: "S1 1AA",
      area_name: "Sheffield",
      site_name: null,
    });
    expect(toSiteInsert("GTA-EMP-000001", saved.value)).not.toHaveProperty("employer_id_assigned");
  });

  it("refuses to deactivate the last active site", () => {
    expect(canDeactivateSite([doncasterSite], siteId)).toBe(false);
    expect(canDeactivateSite(sampleEmployer().sites, siteId)).toBe(true);
    expect(canDeactivateSite([{ id: siteId, isActive: false }], siteId)).toBe(false);
  });

  it("requires a manager name and keeps middle name, phone, email, and site optional", () => {
    const missing = validateManagerInput(
      {
        firstName: " ",
        middleNames: "",
        lastName: "",
        phone: "",
        email: "not-an-email",
        siteId: "other",
      },
      [siteId],
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.fieldErrors.firstName).toMatch(/first name/i);
      expect(missing.fieldErrors.lastName).toMatch(/last name/i);
      expect(missing.fieldErrors.email).toMatch(/email/i);
      expect(missing.fieldErrors.siteId).toMatch(/site/i);
    }

    const saved = validateManagerInput(
      {
        firstName: " Jane ",
        middleNames: " Ann ",
        lastName: " Smith ",
        phone: "",
        email: "",
        siteId: "",
      },
      [],
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const value: ValidatedManager = saved.value;
    expect(toManagerInsert("GTA-EMP-000001", value)).toEqual({
      employer_id: "GTA-EMP-000001",
      site_id: null,
      first_name: "Jane",
      middle_names: "Ann",
      last_name: "Smith",
      phone: null,
      email: null,
    });
  });

  it("lets Administrator and Management write, and keeps Tutor read-only", () => {
    expect(canManageEmployers(actor("Administrator", ["admin.records.manage"]))).toBe(true);
    expect(canManageEmployers(actor("Management", ["admin.records.manage"]))).toBe(true);
    expect(canManageEmployers(actor("Tutor", ["admin.records.manage"]))).toBe(false);
    expect(canManageEmployers(actor("Tutor", ["staff.workspace.view"]))).toBe(false);
    expect(canManageEmployers(actor("Administrator", []))).toBe(false);
    expect(canManageEmployers(null)).toBe(false);
  });

  it("turns database constraints into field errors", () => {
    const duplicate = explainEmployerWriteError({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "employers_company_name_unique"',
      details: "Key (lower(btrim(company_name)))=(example motors) already exists.",
    });
    expect(duplicate.fieldErrors.companyName).toBe(DUPLICATE_COMPANY_NAME);
    expect(duplicate.formError).toBeNull();

    const site = explainEmployerWriteError({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "employer_sites_employer_postcode_unique"',
    });
    expect(site.fieldErrors.postcode).toBe(DUPLICATE_POSTCODE);

    expect(
      explainEmployerWriteError({
        code: "23514",
        message: 'violates check constraint "employer_sites_postcode_format"',
      }).fieldErrors.postcode,
    ).toBe(POSTCODE_FORMAT_MESSAGE);

    expect(
      explainEmployerWriteError({
        code: "23514",
        message: "Employer GTA-EMP-000001 must have at least one site (with a postcode)",
      }).formError,
    ).toBe(LAST_SITE_MESSAGE);

    expect(
      explainEmployerWriteError({
        code: "42501",
        message: 'new row violates row-level security policy for table "employers"',
      }).formError,
    ).toMatch(/Administrator and Management/);
  });

  it("searches company, postcode, site, apprentice, and manager", () => {
    const employer = sampleEmployer();
    expect(employerMatchesQuery(employer, "example motors")).toBe(true);
    expect(employerMatchesQuery(employer, "gta-emp-000001")).toBe(true);
    expect(employerMatchesQuery(employer, "dn4 8de")).toBe(true);
    expect(employerMatchesQuery(employer, "north yard")).toBe(true);
    expect(employerMatchesQuery(employer, "jane ann smith")).toBe(true);
    expect(employerMatchesQuery(employer, "jack elliot")).toBe(true);
    expect(employerMatchesQuery(employer, "01302")).toBe(true);
    expect(employerMatchesQuery(employer, "hull")).toBe(false);
  });

  it("joins sites, managers, and current apprentices onto their employer", () => {
    const rows = assembleEmployers(
      [savedEmployer],
      [
        {
          id: siteId,
          employer_id: "GTA-EMP-000001",
          postcode: "HU1 1AA",
          area_name: "Hull",
          site_name: null,
          is_active: true,
          created_at: savedEmployer.created_at,
          updated_at: savedEmployer.updated_at,
        },
      ],
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          employer_id: "GTA-EMP-000001",
          site_id: siteId,
          first_name: "Jane",
          middle_names: "Ann",
          last_name: "Smith",
          phone: null,
          email: null,
          created_at: savedEmployer.created_at,
          updated_at: savedEmployer.updated_at,
        },
      ],
      [
        {
          gta_id: "GTA-000002",
          employer_id: "GTA-EMP-000001",
          site_id: siteId,
          manager_id: "11111111-1111-4111-8111-111111111111",
          start_date: "2024-09-02",
        },
      ],
      [
        {
          gta_id: "GTA-000002",
          first_name: "Jack",
          middle_names: null,
          last_name: "Elliot",
        },
      ],
    );
    expect(rows[0]?.sites.map((site) => site.postcode)).toEqual(["HU1 1AA"]);
    expect(rows[0]?.managers[0]?.middleNames).toBe("Ann");
    expect(rows[0]?.placements[0]?.name).toBe("Jack Elliot");
    expect(rows[0]?.placements[0]?.statusLabel).toBe("Status unavailable");
    expect(rows[0]?.pastPlacements).toEqual([]);
    expect(placementSiteName(rows[0]!.placements[0]!, rows[0]!.sites)).toBe("No site name");
  });

  it("splits past apprentices and filters either list by site", () => {
    const rows = assembleEmployers(
      [savedEmployer],
      [],
      [],
      [
        {
          id: "current",
          gta_id: "GTA-000002",
          employer_id: "GTA-EMP-000001",
          site_id: siteId,
          manager_id: "11111111-1111-4111-8111-111111111111",
          start_date: "2024-09-02",
          end_date: null,
          end_reason: null,
        },
        {
          id: "past",
          gta_id: "GTA-000003",
          employer_id: "GTA-EMP-000001",
          site_id: otherSiteId,
          manager_id: "11111111-1111-4111-8111-111111111111",
          start_date: "2023-09-04",
          end_date: "2024-02-01",
          end_reason: "  Learner withdrew  ",
        },
      ],
      [
        {
          gta_id: "GTA-000003",
          first_name: "Pat",
          middle_names: null,
          last_name: "Lee",
          status: "withdrawn",
        },
      ],
    );
    expect(rows[0]?.placements.map((placement) => placement.gtaId)).toEqual(["GTA-000002"]);
    expect(rows[0]?.pastPlacements[0]).toMatchObject({
      gtaId: "GTA-000003",
      statusLabel: "Withdrawn",
      endReason: "Learner withdrew",
    });
    expect(placementsForSite(rows[0]!.placements, siteId)).toHaveLength(1);
    expect(placementsForSite(rows[0]!.pastPlacements, siteId)).toEqual([]);
    expect(placementsForSite(rows[0]!.pastPlacements, "")).toHaveLength(1);
    expect(
      managerChoiceLabel(
        { firstName: "Pat", middleNames: null, lastName: "Lee", siteId: null },
        [],
      ),
    ).toBe("Pat Lee — No site");
  });

  it("creates the employer and first site through the database function", async () => {
    let rpcName = "";
    let rpcArgs: Record<string, unknown> | null = null;
    const supabase = {
      async rpc(name: string, args: Record<string, unknown>) {
        rpcName = name;
        rpcArgs = args;
        return { data: "GTA-EMP-000001", error: null };
      },
      from(table: string) {
        return {
          select() {
            return {
              eq() {
                if (table === "employers") {
                  return { async single() { return { data: savedEmployer, error: null }; } };
                }
                return Promise.resolve({
                  data: [
                    {
                      id: siteId,
                      employer_id: "GTA-EMP-000001",
                      postcode: "S1 1AA",
                      area_name: "Sheffield",
                      site_name: null,
                      is_active: true,
                      created_at: savedEmployer.created_at,
                      updated_at: savedEmployer.updated_at,
                    },
                  ],
                  error: null,
                });
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const result = await createEmployerWithSiteRecord(supabase, "Example Motors", {
      postcode: "S1 1AA",
      areaName: "Sheffield",
      siteName: null,
    });
    expect(rpcName).toBe("create_employer_with_site");
    expect(rpcArgs).toEqual({
      p_company_name: "Example Motors",
      p_postcode: "S1 1AA",
      p_area_name: "Sheffield",
      p_site_name: null,
    });
    expect(rpcArgs).not.toHaveProperty("employer_id");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.employerId).toBe("GTA-EMP-000001");
    expect(result.value.sites.map((site) => site.postcode)).toEqual(["S1 1AA"]);
    expect(result.value.placements).toEqual([]);
  });

  it("renames by company name and does not send the employer ID", async () => {
    let updated: Record<string, unknown> | null = null;
    const supabase = {
      from() {
        return {
          update(values: Record<string, unknown>) {
            updated = values;
            return {
              eq() {
                return {
                  select() {
                    return {
                      async single() {
                        return {
                          data: { ...savedEmployer, company_name: "Example Garage" },
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const result = await renameEmployerRecord(supabase, "GTA-EMP-000001", "Example Garage");
    expect(updated).toEqual({ company_name: "Example Garage" });
    expect(updated).not.toHaveProperty("employer_id");
    expect(result.ok).toBe(true);
  });

  it("does not use the service role or invent an employer ID", () => {
    const root = process.cwd();
    const files = [
      "src/features/administration/domain/employer-record.ts",
      "src/features/administration/domain/employer-repository.ts",
      "src/features/administration/screens/employer-actions.ts",
      "src/features/administration/screens/EmployersForm.tsx",
      "src/features/administration/screens/EmployersScreen.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(path.join(root, file), "utf8");
      expect(source).not.toMatch(/createSupabaseAdminClient|GTA-EMP-\$\{/);
    }
    const action = readFileSync(
      path.join(root, "src/features/administration/screens/employer-actions.ts"),
      "utf8",
    );
    expect(action).toContain("createSupabaseServerClient");
    const repository = readFileSync(
      path.join(root, "src/features/administration/domain/employer-repository.ts"),
      "utf8",
    );
    expect(repository).toContain("create_employer_with_site");
    const route = readFileSync(
      path.join(root, "src/shell/workspaces/render-workspace-page.tsx"),
      "utf8",
    );
    expect(route).toContain('if (segment === "onboarding/employer") return <EmployersScreen />;');
    expect(route).toContain('redirect(`/${workspace}/onboarding/apprentice`)');
    expect(route).not.toContain('title="Apprentices"');
  });
});
