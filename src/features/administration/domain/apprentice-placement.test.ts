import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  placementDetailEmail,
  placementDetailManager,
  placementDetailManagerSite,
  placementDetailPhone,
  placementDetailSiteName,
  placementEndReasonLabel,
  validatePlacementChange,
  validatePlacementEnd,
  validatePlacementStart,
  type PlacementDetail,
} from "./apprentice-placement";
import {
  changeApprenticePlacement,
  endApprenticePlacement,
  readApprenticePlacements,
  startApprenticePlacement,
} from "./apprentice-placement-repository";

const employmentId = "66666666-6666-4666-8666-666666666666";
const siteId = "80f06b62-c953-4acd-aacf-630db3a861c4";
const managerId = "11111111-1111-4111-8111-111111111111";
const employerId = "GTA-EMP-000011";

function detail(overrides: Partial<PlacementDetail> = {}): PlacementDetail {
  return {
    id: employmentId,
    employerId,
    companyName: "BCA",
    employerFound: true,
    siteId,
    siteName: null,
    siteFound: true,
    postcode: "DN2 4SF",
    areaName: "Barnby Dun with Kirk Sandall",
    managerId,
    managerName: "Mick James Reynolds",
    managerFound: true,
    managerSiteId: null,
    managerSiteFound: false,
    managerSiteName: null,
    managerSitePostcode: null,
    email: null,
    phone: "01302 893277",
    startDate: "2024-07-15",
    endDate: null,
    endReason: null,
    ...overrides,
  };
}

describe("placement display", () => {
  it("shows a missing site name, a manager with no site, and missing contact details", () => {
    const row = detail();
    expect(placementDetailSiteName(row)).toBe("No site name");
    expect(placementDetailManager(row)).toBe("Mick James Reynolds");
    expect(placementDetailManagerSite(row)).toBe("No site");
    expect(placementDetailEmail(row)).toBe("No email");
    expect(placementDetailPhone(row)).toBe("01302 893277");
    expect(placementEndReasonLabel({ endReason: null })).toBe("No end reason");
    expect(placementDetailSiteName(detail({ siteFound: false }))).toBe("Site unavailable");
    expect(placementDetailManager(detail({ managerFound: false }))).toBe("Manager unavailable");
  });
});

describe("placement validation", () => {
  it("rejects an end date before the start and a blank end reason", () => {
    const early = validatePlacementEnd({
      employmentId,
      currentStart: "2024-07-15",
      endDate: "2024-07-14",
      endReason: "Moved site",
    });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.formError).toMatch(/before the placement start/);

    const blank = validatePlacementEnd({
      employmentId,
      currentStart: "2024-07-15",
      endDate: "2026-11-01",
      endReason: "  ",
    });
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.formError).toMatch(/end reason/);
  });

  it("requires the new placement to start on or after the end date", () => {
    const result = validatePlacementChange({
      employmentId,
      currentStart: "2024-07-15",
      endDate: "2026-11-01",
      endReason: "Moved site",
      gtaId: "GTA-000110",
      employerId,
      siteId,
      managerId,
      startDate: "2026-10-01",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toMatch(/cannot start before/);

    const ok = validatePlacementStart({
      gtaId: "gta-000110",
      employerId,
      siteId,
      managerId,
      startDate: "2026-11-01",
    });
    expect(ok.ok).toBe(true);
  });
});

describe("placement repository", () => {
  it("keeps a tutor off the employer catalogue and shows a manager with no site", async () => {
    const { supabase, tables } = readClient(false);
    const page = await readApprenticePlacements(supabase, "GTA-000110", { canManage: false });
    expect(page.employers).toEqual([]);
    expect(page.current[0]).toMatchObject({
      companyName: "BCA",
      siteName: null,
      managerName: "Mick James Reynolds",
      managerSiteId: null,
      email: null,
      phone: "01302 893277",
    });
    expect(placementDetailManagerSite(page.current[0]!)).toBe("No site");
    expect(placementDetailSiteName(page.current[0]!)).toBe("No site name");
    expect(page.history[0]?.endReason).toBe("Learner withdrew");
    expect(tables).not.toContain("reasons");
  });

  it("ends the current placement before inserting the next one, and restores it if the insert fails", async () => {
    const { supabase, calls } = writeClient([
      { data: { id: employmentId, gta_id: "GTA-000110", start_date: "2024-07-15", end_date: null }, error: null },
      { data: [{ id: employmentId }], error: null },
      { data: null, error: { message: "Site does not belong to employer GTA-EMP-000011", code: "23514" } },
      { data: [{ id: employmentId }], error: null },
    ]);
    const result = await changeApprenticePlacement(supabase, {
      employmentId,
      endDate: "2026-11-01",
      endReason: " Moved site ",
      employerId,
      siteId,
      managerId,
      startDate: "2026-11-01",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBe("Choose a site that belongs to this employer.");
    expect(calls.map((call) => call.op)).toEqual(["select", "update", "insert", "update"]);
    expect(calls[1]).toMatchObject({
      payload: { end_date: "2026-11-01", end_reason: "Moved site" },
      filters: expect.arrayContaining([
        ["eq", "id", employmentId],
        ["is", "end_date", null],
      ]),
    });
    expect(calls[2]?.payload).toMatchObject({
      gta_id: "GTA-000110",
      employer_id: employerId,
      site_id: siteId,
      manager_id: managerId,
      start_date: "2026-11-01",
    });
    expect(calls[3]?.payload).toEqual({ end_date: null, end_reason: null });
  });

  it("refuses to start a second current placement", async () => {
    const { supabase, calls } = writeClient([{ data: [{ id: employmentId }], error: null }]);
    const result = await startApprenticePlacement(supabase, {
      gtaId: "GTA-000110",
      employerId,
      siteId,
      managerId,
      startDate: "2026-11-01",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toMatch(/already has a current placement/);
    expect(calls.map((call) => call.op)).toEqual(["select"]);
  });

  it("ends a placement without opening another", async () => {
    const { supabase, calls } = writeClient([
      { data: { id: employmentId, gta_id: "GTA-000110", start_date: "2024-07-15", end_date: null }, error: null },
      { data: [{ id: employmentId }], error: null },
    ]);
    const result = await endApprenticePlacement(supabase, {
      employmentId,
      endDate: "2026-11-01",
      endReason: "Left the employer",
    });
    expect(result).toEqual({ ok: true });
    expect(calls.map((call) => call.op)).toEqual(["select", "update"]);
  });
});

function readClient(canManage: boolean) {
  const tables: string[] = [];
  const supabase = {
    from(table: string) {
      tables.push(table);
      const filters: [string, string, unknown][] = [];
      const builder: Record<string, unknown> = {};
      const self = () => builder;
      builder.select = self;
      builder.eq = (column: string, value: unknown) => {
        filters.push(["eq", column, value]);
        return builder;
      };
      builder.in = (column: string, value: unknown) => {
        filters.push(["in", column, value]);
        return builder;
      };
      builder.then = (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: rowsFor(table, canManage, filters), error: null }).then(resolve, reject);
      return builder;
    },
  } as unknown as SupabaseClient;
  return { supabase, tables };
}

function rowsFor(table: string, canManage: boolean, filters: [string, string, unknown][]) {
  if (table === "apprentice_employments") {
    return [
      {
        id: employmentId,
        gta_id: "GTA-000110",
        employer_id: employerId,
        site_id: siteId,
        manager_id: managerId,
        start_date: "2024-07-15",
        end_date: null,
        end_reason: null,
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        gta_id: "GTA-000110",
        employer_id: employerId,
        site_id: siteId,
        manager_id: managerId,
        start_date: "2023-01-09",
        end_date: "2024-07-14",
        end_reason: "Learner withdrew",
      },
    ];
  }
  if (!canManage && filters.some((filter) => filter[0] === "eq")) return [];
  if (table === "employers") return [{ employer_id: employerId, company_name: "BCA" }];
  if (table === "employer_sites") {
    return [
      {
        id: siteId,
        employer_id: employerId,
        postcode: "DN2 4SF",
        area_name: "Barnby Dun with Kirk Sandall",
        site_name: null,
        is_active: true,
        created_at: "2026-11-09T12:00:00.000Z",
        updated_at: "2026-11-09T12:00:00.000Z",
      },
    ];
  }
  if (table === "employer_managers") {
    return [
      {
        id: managerId,
        employer_id: employerId,
        site_id: null,
        first_name: "Mick",
        middle_names: "James",
        last_name: "Reynolds",
        phone: "01302 893277",
        email: "  ",
        created_at: "2026-11-09T12:00:00.000Z",
        updated_at: "2026-11-09T12:00:00.000Z",
      },
    ];
  }
  return [];
}

function writeClient(responses: { data: unknown; error: { message: string; code?: string } | null }[]) {
  const calls: { op: string; payload?: unknown; filters: unknown[] }[] = [];
  let index = 0;
  function take() {
    const response = responses[index] ?? { data: null, error: { message: "missing scripted response" } };
    index += 1;
    return response;
  }
  const supabase = {
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
      builder.insert = (payload: unknown) => {
        call.op = "insert";
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
  } as unknown as SupabaseClient;
  return { supabase, calls };
}
