import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertApprenticeRecord } from "./apprentice-repository";
import {
  canAddApprentice,
  explainApprenticeWriteError,
  formatProgrammeChoice,
  toApprenticeInsert,
  validateNewApprentice,
  type ValidatedApprentice,
} from "./apprentice-record";

const programmeId = "80f06b62-c953-4acd-aacf-630db3a861c4";

const savedRow = {
  gta_id: "GTA-000170",
  first_name: "Alex",
  middle_names: "Jay",
  last_name: "Smith",
  programme_id: programmeId,
  status: "in_learning",
  created_at: "2026-11-09T12:00:00.000Z",
  updated_at: "2026-11-09T12:00:00.000Z",
};

function actor(baseRole: string, permissions: string[]) {
  return { account: { baseRole }, permissions };
}

describe("add apprentice record", () => {
  it("shows the programme name with its Skills England code", () => {
    expect(formatProgrammeChoice("Autocare Level 2", "ST0499")).toBe(
      "Autocare L2 (ST0499)",
    );
    expect(formatProgrammeChoice("Heavy Vehicle Technician Level 3", "ST0068")).toBe(
      "Heavy Vehicle Technician L3 (ST0068)",
    );
  });

  it("requires names, keeps programme optional, and defaults status through the caller", () => {
    const missing = validateNewApprentice({
      firstName: "  ",
      middleNames: "  ",
      lastName: "",
      programmeId: "",
      status: "in_learning",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.fieldErrors.firstName).toBe("Enter a first name.");
      expect(missing.fieldErrors.lastName).toBe("Enter a last name.");
      expect(missing.fieldErrors.programmeId).toBeUndefined();
    }

    const saved = validateNewApprentice({
      firstName: " Alex ",
      middleNames: "",
      lastName: " Smith ",
      programmeId: "",
      status: "in_learning",
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(toApprenticeInsert(saved.value)).toEqual({
      first_name: "Alex",
      middle_names: null,
      last_name: "Smith",
      programme_id: null,
      status: "in_learning",
    });
    expect(toApprenticeInsert(saved.value)).not.toHaveProperty("gta_id");
  });

  it("rejects a status or programme that the table would not accept", () => {
    const invalid = validateNewApprentice({
      firstName: "Alex",
      middleNames: "",
      lastName: "Smith",
      programmeId: "not-a-programme",
      status: "draft",
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.fieldErrors.programmeId).toMatch(/programme/i);
      expect(invalid.fieldErrors.status).toMatch(/status/i);
    }
  });

  it("lets Administrator and Management add, and keeps Tutor read-only", () => {
    expect(
      canAddApprentice(actor("Administrator", ["admin.records.manage"])),
    ).toBe(true);
    expect(canAddApprentice(actor("Management", ["admin.records.manage"]))).toBe(
      true,
    );
    expect(canAddApprentice(actor("Tutor", ["staff.workspace.view"]))).toBe(false);
    expect(canAddApprentice(actor("Tutor", ["admin.records.manage"]))).toBe(false);
    expect(canAddApprentice(actor("Administrator", []))).toBe(false);
    expect(canAddApprentice(null)).toBe(false);
  });

  it("turns database check and permission failures into field or form errors", () => {
    expect(
      explainApprenticeWriteError({
        code: "23514",
        message:
          'new row for relation "apprentices" violates check constraint "apprentices_first_name_not_blank"',
      }).fieldErrors.firstName,
    ).toBe("Enter a first name.");
    expect(
      explainApprenticeWriteError({
        code: "42501",
        message: 'new row violates row-level security policy for table "apprentices"',
      }).formError,
    ).toMatch(/Administrator and Management/);
    expect(
      explainApprenticeWriteError({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      }).formError,
    ).toMatch(/duplicate key/);
  });

  it("saves without a GTA ID and returns the ID the database assigned", async () => {
    let inserted: Record<string, unknown> | null = null;
    let selected = "";
    const supabase = {
      from(table: string) {
        expect(table).toBe("apprentices");
        return {
          insert(values: Record<string, unknown>) {
            inserted = values;
            return {
              select(columns: string) {
                selected = columns;
                return {
                  async single() {
                    return { data: savedRow, error: null };
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const value: ValidatedApprentice = {
      firstName: "Alex",
      middleNames: "Jay",
      lastName: "Smith",
      programmeId,
      status: "in_learning",
    };
    const result = await insertApprenticeRecord(supabase, value);
    expect(inserted).toEqual({
      first_name: "Alex",
      middle_names: "Jay",
      last_name: "Smith",
      programme_id: programmeId,
      status: "in_learning",
    });
    expect(inserted).not.toHaveProperty("gta_id");
    expect(selected).toContain("gta_id");
    expect(selected).not.toContain("display_name");
    expect(selected).not.toContain("apprentice_reference");
    expect(result).toEqual({
      ok: true,
      apprentice: {
        gtaId: "GTA-000170",
        firstName: "Alex",
        middleNames: "Jay",
        lastName: "Smith",
        programmeId,
        status: "in_learning",
        createdAt: savedRow.created_at,
        updatedAt: savedRow.updated_at,
      },
    });
  });

  it("does not use the old random GTA ID generator or the service role", () => {
    const root = process.cwd();
    const files = [
      "src/features/administration/domain/apprentice-record.ts",
      "src/features/administration/domain/apprentice-repository.ts",
      "src/features/administration/screens/add-apprentice-actions.ts",
      "src/features/administration/screens/AddApprenticeForm.tsx",
      "src/features/administration/screens/AddApprenticeScreen.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(path.join(root, file), "utf8");
      expect(source).not.toMatch(/generateApprenticeReference|createSupabaseAdminClient|GTA-\$\{/);
    }
    const action = readFileSync(
      path.join(root, "src/features/administration/screens/add-apprentice-actions.ts"),
      "utf8",
    );
    expect(action).toContain("createSupabaseServerClient");
    const route = readFileSync(
      path.join(root, "src/shell/workspaces/render-workspace-page.tsx"),
      "utf8",
    );
    expect(route).toContain('if (segment === "onboarding/apprentice") return <AddApprenticeScreen />;');
    expect(route).not.toContain('ApprenticesVisualPreview mode="form"');
    expect(route).toContain("<EmployersVisualPreview mode=\"form\" />");
  });
});
