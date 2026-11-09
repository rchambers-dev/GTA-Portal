import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertEmployerRecord, renameEmployerRecord } from "./employer-repository";
import {
  DUPLICATE_COMPANY_NAME,
  DUPLICATE_SITE,
  assembleEmployers,
  canManageEmployers,
  employerMatchesQuery,
  explainEmployerWriteError,
  toEmployerInsert,
  toManagerInsert,
  validateAreaName,
  validateCompanyName,
  validateManagerInput,
  withoutSite,
  type EmployerListItem,
  type ValidatedManager,
} from "./employer-record";

const siteId = "80f06b62-c953-4acd-aacf-630db3a861c4";

function actor(baseRole: string, permissions: string[]) {
  return { account: { baseRole }, permissions };
}

const savedEmployer = {
  employer_id: "GTA-EMP-000001",
  company_name: "Example Motors",
  created_at: "2026-11-09T12:00:00.000Z",
  updated_at: "2026-11-09T12:00:00.000Z",
};

function sampleEmployer(): EmployerListItem {
  return {
    employerId: "GTA-EMP-000001",
    companyName: "Example Motors",
    createdAt: savedEmployer.created_at,
    updatedAt: savedEmployer.updated_at,
    sites: [{ id: siteId, areaName: "Doncaster" }],
    managers: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        siteId,
        firstName: "Jane",
        lastName: "Smith",
        phone: "01302 000000",
        email: "jane@example.test",
      },
    ],
  };
}

describe("employer record", () => {
  it("saves a company name only and leaves the employer ID to the database", () => {
    const missing = validateCompanyName("  ");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.fieldErrors.companyName).toBe("Enter a company name.");

    const saved = validateCompanyName("  Example Motors  ");
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(toEmployerInsert(saved.companyName)).toEqual({ company_name: "Example Motors" });
    expect(toEmployerInsert(saved.companyName)).not.toHaveProperty("employer_id");
  });

  it("only accepts Doncaster, Hull, and Sheffield", () => {
    expect(validateAreaName("Leeds").ok).toBe(false);
    expect(validateAreaName("Hull").ok).toBe(true);
  });

  it("requires a manager name and keeps phone, email, and site optional", () => {
    const missing = validateManagerInput(
      { firstName: " ", lastName: "", phone: "", email: "not-an-email", siteId: "other" },
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
      { firstName: " Jane ", lastName: " Smith ", phone: "", email: "", siteId: "" },
      [],
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const value: ValidatedManager = saved.value;
    expect(toManagerInsert("GTA-EMP-000001", value)).toEqual({
      employer_id: "GTA-EMP-000001",
      site_id: null,
      first_name: "Jane",
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

  it("turns the company-name unique index into a duplicate-name error", () => {
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
        'duplicate key value violates unique constraint "employer_sites_employer_area_unique"',
    });
    expect(site.fieldErrors.areaName).toBe(DUPLICATE_SITE);

    expect(
      explainEmployerWriteError({
        code: "23514",
        message: 'violates check constraint "employer_sites_area_name_check"',
      }).fieldErrors.areaName,
    ).toMatch(/Doncaster, Hull, or Sheffield/);

    expect(
      explainEmployerWriteError({
        code: "42501",
        message: 'new row violates row-level security policy for table "employers"',
      }).formError,
    ).toMatch(/Administrator and Management/);
  });

  it("searches company, ID, site, and manager", () => {
    const employer = sampleEmployer();
    expect(employerMatchesQuery(employer, "example motors")).toBe(true);
    expect(employerMatchesQuery(employer, "gta-emp-000001")).toBe(true);
    expect(employerMatchesQuery(employer, "doncaster")).toBe(true);
    expect(employerMatchesQuery(employer, "jane smith")).toBe(true);
    expect(employerMatchesQuery(employer, "01302")).toBe(true);
    expect(employerMatchesQuery(employer, "hull")).toBe(false);
  });

  it("clears a manager site when that site is removed", () => {
    const next = withoutSite(sampleEmployer(), siteId);
    expect(next.sites).toEqual([]);
    expect(next.managers[0]?.siteId).toBeNull();
  });

  it("joins sites and managers onto their employer", () => {
    const rows = assembleEmployers(
      [savedEmployer],
      [
        {
          id: siteId,
          employer_id: "GTA-EMP-000001",
          area_name: "Hull",
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
          last_name: "Smith",
          phone: null,
          email: null,
          created_at: savedEmployer.created_at,
          updated_at: savedEmployer.updated_at,
        },
      ],
    );
    expect(rows[0]?.sites.map((site) => site.areaName)).toEqual(["Hull"]);
    expect(rows[0]?.managers[0]?.lastName).toBe("Smith");
  });

  it("inserts without an employer ID and returns the ID the database assigned", async () => {
    let inserted: Record<string, unknown> | null = null;
    let selected = "";
    const supabase = {
      from(table: string) {
        expect(table).toBe("employers");
        return {
          insert(values: Record<string, unknown>) {
            inserted = values;
            return {
              select(columns: string) {
                selected = columns;
                return {
                  async single() {
                    return { data: savedEmployer, error: null };
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const result = await insertEmployerRecord(supabase, "Example Motors");
    expect(inserted).toEqual({ company_name: "Example Motors" });
    expect(inserted).not.toHaveProperty("employer_id");
    expect(selected).toContain("employer_id");
    expect(selected).not.toContain("postcode");
    expect(result).toEqual({
      ok: true,
      value: {
        employerId: "GTA-EMP-000001",
        companyName: "Example Motors",
        createdAt: savedEmployer.created_at,
        updatedAt: savedEmployer.updated_at,
        sites: [],
        managers: [],
      },
    });
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
    const route = readFileSync(
      path.join(root, "src/shell/workspaces/render-workspace-page.tsx"),
      "utf8",
    );
    expect(route).toContain('if (segment === "onboarding/employer") return <EmployersScreen />;');
    expect(route).toContain('redirect(`/${workspace}/onboarding/apprentice`)');
    expect(route).not.toContain('title="Apprentices"');
  });
});
