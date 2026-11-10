import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  exitNotesLabel,
  exitReasonLabel,
  explainExitError,
  formatRecordedAt,
  validateExitReversal,
  validateLearnerExit,
} from "./learner-exit";
import { readLearnerExits, recordLearnerExit, reverseLearnerExit } from "./learner-exit-repository";

const reasonId = "44444444-4444-4444-8444-444444444444";
const exitId = "55555555-5555-4555-8555-555555555555";
const adminId = "22222222-2222-4222-8222-222222222222";
const today = "2026-11-10";

const base = {
  gtaId: "GTA-000110",
  exitDate: "2026-11-01",
  notes: " Finished the standard. ",
  today,
  courseStart: "2024-07-15",
};

describe("learner exit validation", () => {
  it("accepts a completion without a reason and trims the notes", () => {
    const result = validateLearnerExit({
      ...base,
      exitType: "completed",
      reasonId: "",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        gtaId: "GTA-000110",
        exitType: "completed",
        exitDate: "2026-11-01",
        reasonId: null,
        notes: "Finished the standard.",
      },
    });
  });

  it("requires a withdrawal reason and rejects a completion reason", () => {
    const missing = validateLearnerExit({ ...base, exitType: "withdrawn", reasonId: "" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.formError).toMatch(/reason/);

    const extra = validateLearnerExit({ ...base, exitType: "completed", reasonId });
    expect(extra.ok).toBe(false);
    if (!extra.ok) expect(extra.formError).toMatch(/does not take a reason/);
  });

  it("rejects a future exit date and a date before the course start", () => {
    const future = validateLearnerExit({
      ...base,
      exitType: "completed",
      reasonId: "",
      exitDate: "2026-11-11",
    });
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.formError).toMatch(/future/);

    const early = validateLearnerExit({
      ...base,
      exitType: "withdrawn",
      reasonId,
      exitDate: "2024-07-14",
    });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.formError).toMatch(/15 Jul 2024/);
  });

  it("requires a reversal note", () => {
    expect(validateExitReversal({ exitId, note: "  " }).ok).toBe(false);
    expect(validateExitReversal({ exitId, note: "Recorded against the wrong learner." })).toEqual({
      ok: true,
      value: { exitId, note: "Recorded against the wrong learner." },
    });
  });

  it("explains the database messages without dropping an unknown one", () => {
    expect(explainExitError({ code: "42501", message: "Administrator or Management role required" })).toMatch(
      /Administrator and Management/,
    );
    expect(explainExitError({ message: "Apprentice GTA-000110 already has an active exit" })).toMatch(
      /already has an exit/,
    );
    expect(explainExitError({ message: "Reason \"Other\" cannot be used for withdrawals" })).toMatch(
      /withdrawal reason/,
    );
    expect(explainExitError({ message: "something unexpected" })).toBe("something unexpected");
  });

  it("formats the recorded time in London", () => {
    expect(formatRecordedAt("2026-11-10T18:49:00.000Z")).toBe("10 Nov 2026, 18:49");
  });

  it("shows a missing completion reason and withheld notes plainly", () => {
    expect(exitReasonLabel({ exitType: "completed", reason: null })).toBe("No reason");
    expect(exitReasonLabel({ exitType: "withdrawn", reason: null })).toBe("Reason unavailable");
    expect(exitNotesLabel({ notes: null, notesWithheld: true })).toBe("Notes withheld");
    expect(exitNotesLabel({ notes: null, notesWithheld: false })).toBe("No notes");
  });
});

describe("learner exit repository", () => {
  it("does not call the database for a future date or a completion with a reason", async () => {
    const { supabase, calls, tables } = exitClient({ courseStart: "2024-07-15" });
    const future = await recordLearnerExit(supabase, {
      gtaId: "GTA-000110",
      exitType: "completed",
      exitDate: "2026-12-01",
      reasonId: "",
      notes: "",
      today,
    });
    expect(future.ok).toBe(false);
    const withReason = await recordLearnerExit(supabase, {
      gtaId: "GTA-000110",
      exitType: "completed",
      exitDate: "2026-11-01",
      reasonId,
      notes: "",
      today,
    });
    expect(withReason.ok).toBe(false);
    expect(calls).toEqual([]);
    expect(tables).toEqual([]);
  });

  it("checks the course start before recording, and sends null for a completion reason", async () => {
    const { supabase, calls } = exitClient({ courseStart: "2024-07-15" });
    const early = await recordLearnerExit(supabase, {
      gtaId: "GTA-000110",
      exitType: "withdrawn",
      exitDate: "2024-01-01",
      reasonId,
      notes: "",
      today,
    });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.formError).toMatch(/course start/);
    expect(calls).toEqual([]);

    const recorded = await recordLearnerExit(supabase, {
      gtaId: "gta-000110",
      exitType: "completed",
      exitDate: "2026-11-01",
      reasonId: "",
      notes: "  Finished the standard. ",
      today,
    });
    expect(recorded).toEqual({ ok: true });
    expect(calls).toEqual([
      {
        name: "record_learner_exit",
        args: {
          p_gta_id: "GTA-000110",
          p_exit_type: "completed",
          p_exit_date: "2026-11-01",
          p_reason_id: null,
          p_notes: "Finished the standard.",
        },
      },
    ]);
  });

  it("sends the withdrawal reason and the reversal note", async () => {
    const { supabase, calls } = exitClient({ courseStart: null });
    const recorded = await recordLearnerExit(supabase, {
      gtaId: "GTA-000110",
      exitType: "withdrawn",
      exitDate: "2026-11-01",
      reasonId,
      notes: "",
      today,
    });
    expect(recorded.ok).toBe(true);
    expect(calls[0]?.args).toMatchObject({
      p_exit_type: "withdrawn",
      p_reason_id: reasonId,
      p_notes: null,
    });

    const reversed = await reverseLearnerExit(supabase, {
      exitId,
      note: " Recorded against the wrong learner. ",
    });
    expect(reversed).toEqual({ ok: true });
    expect(calls[1]).toEqual({
      name: "reverse_learner_exit",
      args: { p_exit_id: exitId, p_note: "Recorded against the wrong learner." },
    });
  });

  it("loads exits through get_learner_exits and withdrawal reasons from reasons", async () => {
    const admin = exitReadClient(true);
    const page = await readLearnerExits(admin.supabase, "GTA-000110", { canManage: true });
    expect(page.courseStart).toBe("2024-07-15");
    expect(page.reasons.map((reason) => reason.label)).toEqual(["Learner chose to leave"]);
    expect(page.exits[0]).toMatchObject({
      exitType: "withdrawn",
      reason: "Safeguarding",
      notes: "Private withdrawal note",
      notesWithheld: false,
      recordedByName: "Anne Admin",
    });
    expect(admin.queries).toEqual([
      {
        table: "reasons",
        filters: [
          ["used_for_withdrawals", true],
          ["active", true],
        ],
      },
    ]);
    expect(admin.rpcs).toEqual(["get_learner_exits"]);
    expect(admin.tables).not.toContain("learner_exits");
    expect(admin.tables).not.toContain("break_reasons");
    expect(admin.tables).not.toContain("date_change_reasons");

    const tutor = exitReadClient(false);
    const hidden = await readLearnerExits(tutor.supabase, "GTA-000110", { canManage: false });
    expect(hidden.reasons).toEqual([]);
    expect(hidden.exits[0]?.notes).toBeNull();
    expect(hidden.exits[0]?.notesWithheld).toBe(true);
    expect(exitNotesLabel(hidden.exits[0]!)).toBe("Notes withheld");
    expect(tutor.tables).not.toContain("reasons");
    expect(tutor.rpcs).toEqual(["get_learner_exits"]);
  });
});

function exitClient(options: { courseStart: string | null }) {
  const calls: { name: string; args: unknown }[] = [];
  const tables: string[] = [];
  const supabase = {
    from(table: string) {
      tables.push(table);
      const builder: Record<string, unknown> = {};
      const self = () => builder;
      builder.select = self;
      builder.eq = self;
      builder.maybeSingle = () =>
        Promise.resolve({ data: { course_start: options.courseStart }, error: null });
      return builder;
    },
    rpc(name: string, args: unknown) {
      calls.push({ name, args });
      return Promise.resolve({ data: exitId, error: null });
    },
  } as unknown as SupabaseClient;
  return { supabase, calls, tables };
}

function exitReadClient(canManage: boolean) {
  const tables: string[] = [];
  const queries: { table: string; filters: [string, unknown][] }[] = [];
  const rpcs: string[] = [];
  const reasonRows = [
    {
      id: reasonId,
      label: "Learner chose to leave",
      sort_order: 10,
      is_safeguarding: false,
      used_for_withdrawals: true,
      active: true,
    },
    {
      id: "reason-break",
      label: "Maternity, paternity or parental leave",
      sort_order: 5,
      is_safeguarding: false,
      used_for_withdrawals: false,
      active: true,
    },
    {
      id: "reason-old",
      label: "Retired reason",
      sort_order: 1,
      is_safeguarding: false,
      used_for_withdrawals: true,
      active: false,
    },
  ];
  const supabase = {
    from(table: string) {
      tables.push(table);
      const filters: [string, unknown][] = [];
      if (table === "reasons") queries.push({ table, filters });
      const builder: Record<string, unknown> = {};
      const self = () => builder;
      builder.select = self;
      builder.eq = (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      };
      builder.order = self;
      builder.in = self;
      builder.maybeSingle = () =>
        Promise.resolve({ data: { course_start: "2024-07-15" }, error: null });
      builder.then = (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => {
        const data =
          table === "reasons"
            ? reasonRows.filter((row) =>
                filters.every(([column, value]) => (row as Record<string, unknown>)[column] === value),
              )
            : table === "profiles"
              ? [{ id: adminId, display_name: "Anne Admin", email: "anne@example.com" }]
              : [];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      };
      return builder;
    },
    rpc(name: string, args: unknown) {
      rpcs.push(name);
      expect(args).toEqual({ p_gta_id: "GTA-000110" });
      return Promise.resolve({
        data: [
          {
            id: exitId,
            gta_id: "GTA-000110",
            exit_type: "withdrawn",
            exit_date: "2026-11-01",
            reason: "Safeguarding",
            is_safeguarding: true,
            notes: canManage ? "Private withdrawal note" : null,
            recorded_by: adminId,
            created_at: "2026-11-10T18:49:00.000Z",
            reversed_at: null,
            reversed_by: null,
            reversal_note: null,
          },
        ],
        error: null,
      });
    },
  } as unknown as SupabaseClient;
  return { supabase, tables, queries, rpcs };
}
