import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  readApprenticeProgramme,
  requestApprenticePlannedDateChange,
  saveApprenticeCourseDates,
} from "./apprentice-programme-repository";

const tutorId = "11111111-1111-4111-8111-111111111111";
const reasonId = "44444444-4444-4444-8444-444444444444";
const breakId = "55555555-5555-4555-8555-555555555555";

const dateRow = {
  course_start: "2025-09-01",
  planned_course_end: "2026-07-01",
  actual_course_end: null,
  planned_gateway_1: "2026-03-01",
  actual_gateway_1: null,
  planned_gateway_2: null,
  actual_gateway_2: null,
  planned_epa: null,
  actual_epa: null,
};

function chain(data: unknown, error: { message: string } | null = null) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = self;
  builder.eq = self;
  builder.order = self;
  builder.in = self;
  builder.is = self;
  builder.update = self;
  builder.maybeSingle = () =>
    Promise.resolve({
      data: Array.isArray(data) ? (data[0] ?? null) : data,
      error,
    });
  builder.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve({ data, error }).then(resolve, reject);
  return builder;
}

function programmeClient(canManage: boolean) {
  const tables: string[] = [];
  const rpcs: string[] = [];
  const forbidden = [
    "breaks_in_learning",
    "break_reasons",
    "return_checklist_items",
    "return_to_learning_checks",
    "return_check_results",
    "date_change_reasons",
  ];
  const supabase = {
    from(table: string) {
      tables.push(table);
      if (!canManage && forbidden.includes(table)) {
        throw new Error(`read-only caller queried ${table}`);
      }
      if (table === "apprentices") return chain(dateRow);
      if (table === "profiles") {
        return chain([
          { id: tutorId, display_name: "Anne Admin", email: "anne@example.com" },
        ]);
      }
      if (table === "date_change_reasons") {
        return chain([
          { id: reasonId, label: "Other", sort_order: 20, is_safeguarding: false },
          {
            id: "reason-early",
            label: "Learner ahead of schedule",
            sort_order: 10,
            is_safeguarding: false,
          },
        ]);
      }
      if (table === "breaks_in_learning") {
        return chain([
          {
            id: breakId,
            start_date: "2026-01-01",
            planned_return: null,
            actual_return: null,
            reason_id: reasonId,
            explanation: "Recovering after surgery.",
            started_by: tutorId,
          },
          {
            id: "past-break",
            start_date: "2025-01-06",
            planned_return: "2025-03-17",
            actual_return: "2025-02-01",
            reason_id: reasonId,
            explanation: "Family funeral.",
            started_by: tutorId,
          },
        ]);
      }
      if (table === "break_reasons") {
        return chain([
          {
            id: reasonId,
            label: "Illness, injury or medical treatment",
            sort_order: 10,
            active: true,
            is_safeguarding: false,
          },
        ]);
      }
      if (table === "return_checklist_items") return chain([]);
      if (table === "return_to_learning_checks") return chain(null);
      throw new Error(`unexpected table ${table}`);
    },
    rpc(name: string) {
      rpcs.push(name);
      if (name === "get_effective_planned_dates") {
        return Promise.resolve({
          data: [
            {
              course_end: "2027-06-01",
              gateway_1: "2026-03-01",
              gateway_2: null,
              epa: null,
              original_course_end: "2026-07-01",
              original_gateway_1: "2026-03-01",
              original_gateway_2: null,
              original_epa: null,
              course_end_changed: true,
              gateway_1_changed: false,
              gateway_2_changed: false,
              epa_changed: false,
            },
          ],
          error: null,
        });
      }
      if (name === "get_planned_date_changes") {
        return Promise.resolve({
          data: [
            {
              id: "change-1",
              date_type: "gateway_1",
              old_date: "2026-03-01",
              new_date: "2026-05-01",
              reason: "Safeguarding",
              is_safeguarding: true,
              explanation: canManage ? "Private support details." : null,
              extension_paperwork: false,
              status: "approved",
              requested_by: tutorId,
              requested_at: "2026-10-01T09:00:00.000Z",
              signed_off_by: tutorId,
              signed_off_at: "2026-10-02T09:00:00.000Z",
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: `unexpected rpc ${name}` } });
    },
  } as unknown as SupabaseClient;
  return { supabase, tables, rpcs };
}

describe("apprentice programme repository", () => {
  it("does not query breaks or reasons for a read-only caller", async () => {
    const { supabase, tables, rpcs } = programmeClient(false);
    const page = await readApprenticeProgramme(supabase, "GTA-000002", { canManage: false });
    expect(page.breaks).toBeNull();
    expect(page.dateChangeReasons).toEqual([]);
    expect(page.effective?.courseEnd).toBe("2027-06-01");
    expect(page.effective?.courseEndChanged).toBe(true);
    expect(page.changes[0]?.explanation).toBeNull();
    expect(page.changes[0]?.isSafeguarding).toBe(true);
    expect(page.changes[0]?.requestedByName).toBe("Anne Admin");
    expect(tables).toEqual(["apprentices", "profiles"]);
    expect(rpcs).toEqual(["get_effective_planned_dates", "get_planned_date_changes"]);
    expect(page.loadError).toBeNull();
  });

  it("loads breaks for an administrator and keeps the generated planned return", async () => {
    const { supabase, tables } = programmeClient(true);
    const page = await readApprenticeProgramme(supabase, "gta-000002", { canManage: true });
    expect(page.dateChangeReasons.map((reason) => reason.label)).toEqual([
      "Learner ahead of schedule",
      "Other",
    ]);
    expect(page.changes[0]?.explanation).toBe("Private support details.");
    expect(page.breaks?.open).toMatchObject({
      id: breakId,
      startDate: "2026-01-01",
      plannedReturn: "2026-03-12",
      reason: "Illness, injury or medical treatment",
      explanation: "Recovering after surgery.",
      checks: [],
      checksUnavailable: false,
      signedOff: false,
    });
    expect(page.breaks?.history.map((item) => item.actualReturn)).toEqual(["2025-02-01"]);
    expect(tables).toContain("breaks_in_learning");
    expect(tables).not.toContain("return_check_results");
  });

  it("writes an initial planned date only while the column is empty", async () => {
    const { client, calls } = scriptedClient([
      { data: { ...dateRow, planned_gateway_2: null }, error: null },
      {
        data: [
          {
            course_end: "2027-06-01",
            gateway_1: "2026-03-01",
            gateway_2: null,
            epa: null,
            original_course_end: "2026-07-01",
            original_gateway_1: "2026-03-01",
            original_gateway_2: null,
            original_epa: null,
            course_end_changed: true,
            gateway_1_changed: false,
            gateway_2_changed: false,
            epa_changed: false,
          },
        ],
        error: null,
      },
      { data: [{ gta_id: "GTA-000002" }], error: null },
      { data: null, error: null },
    ]);
    const result = await saveApprenticeCourseDates(client, {
      gtaId: "GTA-000002",
      courseStart: "2025-10-01",
      actualCourseEnd: null,
      actualGateway1: null,
      actualGateway2: null,
      actualEpa: null,
      plannedGateway2: "2026-04-01",
    });
    expect(result).toEqual({ ok: true });
    const updates = calls.filter((call) => call.op === "update");
    expect(updates[0]).toMatchObject({
      payload: { planned_gateway_2: "2026-04-01" },
      filters: expect.arrayContaining([
        ["eq", "gta_id", "GTA-000002"],
        ["is", "planned_gateway_2", null],
      ]),
    });
    expect(updates[1]?.payload).toEqual({ course_start: "2025-10-01" });
  });

  it("does not update a planned date that is already set", async () => {
    const { client, calls } = scriptedClient([
      { data: dateRow, error: null },
      { data: [], error: null },
    ]);
    const result = await saveApprenticeCourseDates(client, {
      gtaId: "GTA-000002",
      courseStart: "2025-09-01",
      actualCourseEnd: null,
      actualGateway1: null,
      actualGateway2: null,
      actualEpa: null,
      plannedCourseEnd: "2028-01-01",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toMatch(/date change request/);
    expect(calls.map((call) => call.op)).toEqual(["select", "rpc"]);
  });

  it("refuses a date change request until the planned date exists", async () => {
    const { client, calls } = scriptedClient([
      { data: { planned_gateway_2: null }, error: null },
      { data: null, error: null },
    ]);
    const result = await requestApprenticePlannedDateChange(client, {
      gtaId: "GTA-000002",
      dateType: "gateway_2",
      newDate: "2026-04-01",
      reasonId,
      explanation: "Bringing gateway 2 forward.",
      extensionPaperwork: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toMatch(/course dates form first/);
    expect(calls.map((call) => call.op)).not.toContain("rpc-request");
  });
});

function scriptedClient(
  responses: { data: unknown; error: { code?: string; message: string } | null }[],
) {
  const calls: { op: string; payload?: unknown; filters: unknown[] }[] = [];
  let index = 0;
  function take() {
    const response = responses[index] ?? { data: null, error: { message: "missing scripted response" } };
    index += 1;
    return response;
  }
  const client = {
    from() {
      const call = { op: "select", payload: undefined as unknown, filters: [] as unknown[] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
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
      builder.maybeSingle = () => Promise.resolve(take());
      builder.then = (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(take()).then(resolve, reject);
      return builder;
    },
    rpc(name: string, args: unknown) {
      calls.push({
        op: name === "request_planned_date_change" ? "rpc-request" : "rpc",
        payload: args,
        filters: [],
      });
      return Promise.resolve(take());
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
