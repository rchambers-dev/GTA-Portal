import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assignApprenticeTutor, readApprenticeLearner } from "./apprentice-tutor-repository";
import {
  APPRENTICESHIP_TUTOR_RESPONSIBILITY,
  apprenticeLearnerGtaId,
  apprenticeLearnerPath,
  apprenticeListWorkspace,
  canAssignApprenticeTutor,
  eligibleTutorOptions,
  explainTutorWriteError,
  formatTutorDate,
  learnerSectionFromQuery,
  learnerSectionHref,
  londonToday,
  profileCanTutor,
  splitTutorAssignments,
  validateTutorAssignment,
  type TutorAssignment,
  type TutorProfileRow,
} from "./apprentice-tutor";

const tutorId = "11111111-1111-4111-8111-111111111111";
const adminId = "22222222-2222-4222-8222-222222222222";
const formerId = "33333333-3333-4333-8333-333333333333";

function actor(baseRole: string, permissions: string[]) {
  return { account: { baseRole }, permissions };
}

describe("apprentice tutor rule", () => {
  it("matches the trigger: Tutor role or the exact Apprenticeship Tutor responsibility", () => {
    expect(profileCanTutor({ baseRole: "Tutor", responsibilities: [] })).toBe(true);
    expect(
      profileCanTutor({
        baseRole: "Administrator",
        responsibilities: ["Sales & Marketing", "Apprenticeship Tutor", "Deputy DSL"],
      }),
    ).toBe(true);
    expect(
      profileCanTutor({ baseRole: "Administrator", responsibilities: ["Tutor"] }),
    ).toBe(false);
    expect(
      profileCanTutor({
        baseRole: "Administrator",
        responsibilities: ["apprenticeship tutor"],
      }),
    ).toBe(false);
    expect(profileCanTutor({ baseRole: "tutor", responsibilities: [] })).toBe(false);
    expect(profileCanTutor({ baseRole: "Administrator", responsibilities: null })).toBe(
      false,
    );
  });

  it("keeps an administrator with the responsibility and drops a near miss", () => {
    const rows: TutorProfileRow[] = [
      {
        id: tutorId,
        display_name: "Alex Tutor",
        email: "alex@example.com",
        base_role: "Tutor",
        responsibilities: [],
      },
      {
        id: adminId,
        display_name: "Anne Admin",
        email: "anne@example.com",
        base_role: "Administrator",
        responsibilities: ["Apprenticeship Tutor"],
      },
      {
        id: formerId,
        display_name: "Not A Tutor",
        email: "not@example.com",
        base_role: "Administrator",
        responsibilities: ["Tutor"],
      },
      {
        id: tutorId,
        display_name: "Alex Tutor",
        email: "alex@example.com",
        base_role: "Tutor",
        responsibilities: ["Apprenticeship Tutor"],
      },
    ];
    expect(eligibleTutorOptions(rows).map((row) => row.displayName)).toEqual([
      "Alex Tutor",
      "Anne Admin",
    ]);
  });

  it("lets Administrator and Management assign, and keeps Tutor read-only", () => {
    expect(canAssignApprenticeTutor(actor("Administrator", ["admin.records.manage"]))).toBe(
      true,
    );
    expect(canAssignApprenticeTutor(actor("Management", ["admin.records.manage"]))).toBe(
      true,
    );
    expect(canAssignApprenticeTutor(actor("Tutor", ["admin.records.manage"]))).toBe(false);
    expect(canAssignApprenticeTutor(actor("Tutor", ["staff.workspace.view"]))).toBe(false);
    expect(canAssignApprenticeTutor(null)).toBe(false);
  });

  it("routes a learner id without taking over the add apprentice page", () => {
    expect(apprenticeLearnerGtaId("onboarding/apprentice")).toBeNull();
    expect(apprenticeLearnerGtaId("onboarding/apprentice/GTA-000002")).toBe("GTA-000002");
    expect(apprenticeLearnerGtaId("onboarding/apprentice/GTA-000002/tutor")).toBeNull();
    expect(apprenticeListWorkspace("/management/onboarding/apprentice")).toBe(
      "management",
    );
    expect(apprenticeLearnerPath("management", "GTA-000002")).toBe(
      "/management/onboarding/apprentice/GTA-000002",
    );
    expect(learnerSectionFromQuery(null)).toBe("overview");
    expect(learnerSectionFromQuery("tutor")).toBe("tutor");
    expect(learnerSectionFromQuery("programme")).toBe("programme");
    expect(learnerSectionFromQuery("employer")).toBe("overview");
    expect(learnerSectionHref("/administration/onboarding/apprentice/GTA-000002", "overview")).toBe(
      "/administration/onboarding/apprentice/GTA-000002",
    );
    expect(learnerSectionHref("/administration/onboarding/apprentice/GTA-000002", "programme")).toBe(
      "/administration/onboarding/apprentice/GTA-000002?tab=programme",
    );
    expect(learnerSectionHref("/administration/onboarding/apprentice/GTA-000002", "tutor")).toBe(
      "/administration/onboarding/apprentice/GTA-000002?tab=tutor",
    );
  });

  it("formats tutor dates in the London calendar day", () => {
    expect(formatTutorDate("2025-01-27")).toBe("27 Jan 2025");
    expect(londonToday(new Date("2026-06-01T23:30:00.000Z"))).toBe("2026-06-02");
    expect(londonToday(new Date("2026-11-09T00:30:00.000Z"))).toBe("2026-11-09");
  });

  it("explains database errors and keeps unknown messages", () => {
    expect(
      explainTutorWriteError({
        code: "23514",
        message:
          "tutor_id must reference a profile with base_role Tutor or the Apprenticeship Tutor responsibility",
      }),
    ).toMatch(/Apprenticeship Tutor/);
    expect(
      explainTutorWriteError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "apprentice_tutors_one_current_idx"',
      }),
    ).toMatch(/already has a current tutor/);
    expect(
      explainTutorWriteError({
        code: "42501",
        message: "new row violates row-level security policy",
      }),
    ).toMatch(/Administrator and Management/);
    expect(
      explainTutorWriteError({
        code: "23514",
        message: 'violates check constraint "apprentice_tutors_dates_check"',
      }),
    ).toMatch(/end date/);
    expect(
      explainTutorWriteError({
        code: "P0001",
        message: "unexpected tutor failure from the database",
      }),
    ).toBe("unexpected tutor failure from the database");
  });

  it("splits the open tutor from history, newest end date first", () => {
    const rows: TutorAssignment[] = [
      assignment("old", "2024-01-01", "2024-06-01"),
      assignment("open", "2025-01-27", null),
      assignment("mid", "2024-06-02", "2024-12-01"),
    ];
    const split = splitTutorAssignments(rows);
    expect(split.current?.id).toBe("open");
    expect(split.multipleCurrent).toBe(false);
    expect(split.history.map((row) => row.id)).toEqual(["mid", "old"]);
  });

  it("loads a learner with the trigger's tutor list", async () => {
    const seen = { role: false, responsibility: null as unknown };
    const supabase = {
      from(table: string) {
        if (table === "apprentices") {
          return {
            select() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return {
                        data: {
                          gta_id: "GTA-000002",
                          first_name: "Jack",
                          middle_names: null,
                          last_name: "Elliot",
                          programme_id: "80f06b62-c953-4acd-aacf-630db3a861c4",
                          status: "in_learning",
                          created_at: "2026-11-09T12:00:00.000Z",
                          updated_at: "2026-11-09T12:00:00.000Z",
                        },
                        error: null,
                      };
                    },
                  };
                },
              };
            },
          };
        }
        if (table === "apprentice_tutors") {
          return {
            select() {
              return {
                eq() {
                  return Promise.resolve({
                    data: [
                      {
                        id: "open",
                        tutor_id: tutorId,
                        start_date: "2025-01-27",
                        end_date: null,
                      },
                      {
                        id: "past",
                        tutor_id: formerId,
                        start_date: "2024-01-01",
                        end_date: "2025-01-26",
                      },
                    ],
                    error: null,
                  });
                },
              };
            },
          };
        }
        if (table === "profiles") {
          return {
            select() {
              return {
                eq(column: string, value: string) {
                  seen.role = column === "base_role" && value === "Tutor";
                  return Promise.resolve({
                    data: [
                      {
                        id: tutorId,
                        display_name: "Alex Tutor",
                        email: "alex@example.com",
                        base_role: "Tutor",
                        responsibilities: [],
                      },
                    ],
                    error: null,
                  });
                },
                filter(column: string, operator: string, value: string) {
                  seen.responsibility =
                    column === "responsibilities" && operator === "cs" ? value : null;
                  return Promise.resolve({
                    data: [
                      {
                        id: adminId,
                        display_name: "Anne Admin",
                        email: "anne@example.com",
                        base_role: "Administrator",
                        responsibilities: ["Apprenticeship Tutor"],
                      },
                      {
                        id: "not-eligible",
                        display_name: "Wrong Flag",
                        email: "wrong@example.com",
                        base_role: "Administrator",
                        responsibilities: ["Tutor"],
                      },
                    ],
                    error: null,
                  });
                },
                in(_column: string, ids: string[]) {
                  expect(ids).toEqual([formerId]);
                  return Promise.resolve({
                    data: [
                      {
                        id: formerId,
                        display_name: "Former Tutor",
                        email: "former@example.com",
                      },
                    ],
                    error: null,
                  });
                },
              };
            },
          };
        }
        if (table === "programmes") {
          return {
            select() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return {
                        data: {
                          name: "Vehicle Damage Panel Level 3",
                          standard_code: "ST0403",
                        },
                        error: null,
                      };
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;

    const page = await readApprenticeLearner(supabase, "gta-000002");
    expect(page.apprentice).toMatchObject({
      gtaId: "GTA-000002",
      name: "Jack Elliot",
      programmeLabel: "Vehicle Damage Panel L3 (ST0403)",
      programmeName: "Vehicle Damage Panel Level 3",
      standardCode: "ST0403",
      statusLabel: "In learning",
    });
    expect(page.currentTutor).toMatchObject({
      displayName: "Alex Tutor",
      email: "alex@example.com",
      startDate: "2025-01-27",
      endDate: null,
    });
    expect(page.tutorHistory.map((row) => row.displayName)).toEqual(["Former Tutor"]);
    expect(page.tutorOptions.map((row) => row.displayName)).toEqual([
      "Alex Tutor",
      "Anne Admin",
    ]);
    expect(seen.role).toBe(true);
    expect(seen.responsibility).toBe(`{"${APPRENTICESHIP_TUTOR_RESPONSIBILITY}"}`);
    expect(page.loadError).toBeNull();
  });

  it("rejects an id that is not a GTA ID before asking the database", async () => {
    const page = await readApprenticeLearner({} as SupabaseClient, "not-an-id");
    expect(page.apprentice).toBeNull();
    expect(page.loadError).toMatch(/GTA-000002/);
  });

  it("ends the current tutor and inserts the next one", async () => {
    const { client, calls } = scriptedClient([
      {
        data: [{ id: "row-1", tutor_id: tutorId, start_date: "2025-01-27" }],
        error: null,
      },
      { data: [{ id: "row-1" }], error: null },
      { data: { id: "row-2" }, error: null },
    ]);
    const result = await assignApprenticeTutor(
      client,
      { gtaId: "GTA-000016", tutorId: adminId },
      "2026-11-09",
    );
    expect(result).toEqual({ ok: true });
    expect(calls.map((call) => call.op)).toEqual(["select", "update", "insert"]);
    expect(calls[1]).toMatchObject({
      payload: { end_date: "2026-11-09" },
      filters: [
        ["eq", "id", "row-1"],
        ["is", "end_date", null],
      ],
    });
    expect(calls[2]?.payload).toEqual({
      apprentice_id: "GTA-000016",
      tutor_id: adminId,
      start_date: "2026-11-09",
    });
  });

  it("inserts when the apprentice has no tutor", async () => {
    const { client, calls } = scriptedClient([
      { data: [], error: null },
      { data: { id: "row-2" }, error: null },
    ]);
    const result = await assignApprenticeTutor(
      client,
      { gtaId: "GTA-000016", tutorId },
      "2026-11-09",
    );
    expect(result).toEqual({ ok: true });
    expect(calls.map((call) => call.op)).toEqual(["select", "insert"]);
  });

  it("does not write when the chosen tutor is already current", async () => {
    const { client, calls } = scriptedClient([
      {
        data: [{ id: "row-1", tutor_id: tutorId, start_date: "2025-01-27" }],
        error: null,
      },
    ]);
    const result = await assignApprenticeTutor(
      client,
      { gtaId: "GTA-000016", tutorId },
      "2026-11-09",
    );
    expect(result).toEqual({ ok: false, formError: "This tutor is already assigned." });
    expect(calls.map((call) => call.op)).toEqual(["select"]);
  });

  it("reopens the current tutor when the new row cannot be saved", async () => {
    const { client, calls } = scriptedClient([
      {
        data: [{ id: "row-1", tutor_id: tutorId, start_date: "2025-01-27" }],
        error: null,
      },
      { data: [{ id: "row-1" }], error: null },
      { data: null, error: { code: "23514", message: "tutor_id must reference a profile with base_role Tutor or the Apprenticeship Tutor responsibility" } },
      { data: [{ id: "row-1" }], error: null },
    ]);
    const result = await assignApprenticeTutor(
      client,
      { gtaId: "GTA-000016", tutorId: adminId },
      "2026-11-09",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toMatch(/Apprenticeship Tutor/);
    expect(calls[3]).toMatchObject({
      op: "update",
      payload: { end_date: null },
      filters: [
        ["eq", "id", "row-1"],
        ["eq", "end_date", "2026-11-09"],
      ],
    });
  });

  it("rejects a tutor id that is not in the list", () => {
    const parsed = validateTutorAssignment({ gtaId: "GTA-000002", tutorId: "Anne" });
    expect(parsed.ok).toBe(false);
  });

  it("queries tutors with the trigger rule and does not use the service role", () => {
    const root = process.cwd();
    const repository = readFileSync(
      path.join(root, "src/features/administration/domain/apprentice-tutor-repository.ts"),
      "utf8",
    );
    expect(repository).toContain('.eq("base_role", "Tutor")');
    expect(repository).toMatch(
      /\.filter\(\s*"responsibilities",\s*"cs",\s*`\{"\$\{APPRENTICESHIP_TUTOR_RESPONSIBILITY\}"\}`/,
    );
    expect(repository).not.toContain("createSupabaseAdminClient");
    const route = readFileSync(
      path.join(root, "src/shell/workspaces/render-workspace-page.tsx"),
      "utf8",
    );
    expect(route).toContain(
      'if (segment === "onboarding/apprentice") return <AddApprenticeScreen />;',
    );
    expect(route).toContain("apprenticeLearnerGtaId");
    expect(route).toContain("<ApprenticeLearnerScreen");
  });
});

function assignment(id: string, startDate: string, endDate: string | null): TutorAssignment {
  return {
    id,
    tutorId,
    displayName: id,
    email: null,
    startDate,
    endDate,
  };
}

function scriptedClient(
  responses: { data: unknown; error: { code?: string; message: string } | null }[],
) {
  const calls: { op: string; payload?: unknown; filters: unknown[] }[] = [];
  let index = 0;
  function take() {
    const response = responses[index] ?? {
      data: null,
      error: { message: "missing scripted response" },
    };
    index += 1;
    return response;
  }
  const client = {
    from() {
      const call = { op: "select", payload: undefined as unknown, filters: [] as unknown[] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.insert = (payload: unknown) => {
        call.op = "insert";
        call.payload = payload;
        return builder;
      };
      builder.update = (payload: unknown) => {
        call.op = "update";
        call.payload = payload;
        return builder;
      };
      builder.eq = (column: string, value: unknown) => {
        call.filters.push(["eq", column, value]);
        return builder;
      };
      builder.is = (column: string, value: unknown) => {
        call.filters.push(["is", column, value]);
        return builder;
      };
      builder.single = () => Promise.resolve(take());
      builder.then = (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(take()).then(resolve, reject);
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
