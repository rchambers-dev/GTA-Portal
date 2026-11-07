import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import type { PortalAccount } from "@/lib/portal/types";

const getEffectiveSession = vi.fn();
const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
const tables: Record<string, Record<string, unknown>[]> = {
  employers: [],
  employer_sites: [],
  employer_site_memberships: [],
  employer_managers: [],
  employer_manager_roles: [],
  apprentices: [],
  review_apprentice_details: [],
  apprentice_programmes: [],
  profiles: [],
};

vi.mock("@/adapters/standalone", () => ({
  getStandalonePorts: () => ({
    auth: { getEffectiveSession: () => getEffectiveSession() },
  }),
}));

vi.mock("@/adapters/supabase/client", () => ({
  createSupabaseAdminClient: () => ({
    from(table: string) {
      const rows = tables[table] ?? [];
      const filters: Array<[string, unknown]> = [];
      const api = {
        select() {
          return api;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return api;
        },
        insert(row: Record<string, unknown>) {
          inserts.push({ table, row });
          rows.push(row);
          tables[table] = rows;
          return Promise.resolve({ data: row, error: null });
        },
        update(row: Record<string, unknown>) {
          const matched: Array<[string, unknown]> = [];
          const chain = {
            eq(column: string, value: unknown) {
              matched.push([column, value]);
              return chain;
            },
            select() {
              const hits = rows.filter((item) =>
                matched.every(([column, value]) => item[column] === value),
              );
              for (const hit of hits) Object.assign(hit, row);
              return Promise.resolve({ data: hits, error: null });
            },
          };
          return chain;
        },
        delete() {
          return {
            eq(column: string, value: unknown) {
              const next = {
                eq(column2: string, value2: unknown) {
                  tables[table] = rows.filter(
                    (item) => !(item[column] === value && item[column2] === value2),
                  );
                  return Promise.resolve({ error: null });
                },
              };
              if (column === "id") {
                tables[table] = rows.filter((item) => item[column] !== value);
              }
              return Object.assign(Promise.resolve({ error: null }), next);
            },
          };
        },
        then(
          resolve: (value: { data: Record<string, unknown>[]; error: null }) => void,
          reject?: (reason: unknown) => void,
        ) {
          try {
            const data = rows.filter((row) =>
              filters.every(([column, value]) => row[column] === value),
            );
            resolve({ data, error: null });
          } catch (error) {
            reject?.(error);
          }
        },
      };
      return api;
    },
    rpc(fn: string, args: Record<string, unknown>) {
      if (fn === "create_review_apprentice") {
        const row = args.p_row as Record<string, unknown>;
        tables.apprentices.push({
          id: row.id,
          display_name: row.display_name,
          apprentice_reference: row.apprentice_reference,
          portal_entry: "reviews",
        });
        tables.review_apprentice_details.push({
          apprentice_id: row.id,
          version: 1,
          employer_id: null,
        });
        inserts.push({ table: "apprentices", row });
        inserts.push({ table: "review_apprentice_details", row });
        return Promise.resolve({ data: null, error: null });
      }
      const detail = tables.review_apprentice_details.find(
        (item) => item.apprentice_id === args.p_apprentice_id,
      );
      const fields = (args.p_fields ?? {}) as Record<string, unknown>;
      if (!detail || detail.version !== args.p_expected_version) {
        return Promise.resolve({
          data: null,
          error: { message: "version_conflict", code: "40001" },
        });
      }
      Object.assign(detail, fields, { version: Number(detail.version) + 1 });
      if (typeof args.p_display_name === "string") {
        const person = tables.apprentices.find((item) => item.id === args.p_apprentice_id);
        if (person) person.display_name = args.p_display_name;
      }
      return Promise.resolve({ data: detail.version, error: null });
    },
  }),
}));

function session(input: {
  workspace: PortalAccount["workspace"];
  permissions: string[];
  baseRole?: string;
}) {
  const account: PortalAccount = {
    id: "user-1",
    name: "Test User",
    initials: "TU",
    email: "test.user@example.invalid",
    baseRole: input.baseRole ?? "Administrator",
    responsibilities: [],
    workspace: input.workspace,
    permissions: input.permissions,
    linkedApprenticeId: null,
  };
  return buildEffectiveSession(account, []);
}

describe("employer directory route", () => {
  beforeEach(() => {
    inserts.length = 0;
    for (const key of Object.keys(tables)) tables[key] = [];
    getEffectiveSession.mockReset();
  });

  it("denies reviews-only tutors and apprentice or employer accounts even with a stray records permission", async () => {
    const { GET, POST } = await import("./route");
    getEffectiveSession.mockResolvedValueOnce(null);
    const signedOut = await GET();
    expect(signedOut.status).toBe(401);

    for (const denied of [
      session({
        workspace: "staff",
        baseRole: "Tutor",
        permissions: ["reviews.manage", "staff.workspace.view"],
      }),
      session({
        workspace: "apprentice",
        baseRole: "Apprentice",
        permissions: ["admin.records.manage", "apprentice.workspace.own"],
      }),
      session({
        workspace: "employer",
        baseRole: "Employer",
        permissions: ["admin.records.manage", "employer.workspace.view"],
      }),
      session({
        workspace: "staff",
        baseRole: "Apprentice",
        permissions: ["admin.records.manage"],
      }),
    ]) {
      getEffectiveSession.mockResolvedValueOnce(denied);
      getEffectiveSession.mockResolvedValueOnce(denied);
      const response = await POST(
        new Request("http://localhost/api/employer-directory", {
          method: "POST",
          body: JSON.stringify({
            action: "createReviewApprentice",
            input: { fullName: "Should Not Save" },
          }),
        }),
      );
      expect(response.status).toBe(403);
    }
    expect(inserts).toHaveLength(0);
  });

  it("denies a signed-out request", async () => {
    const { POST } = await import("./route");
    getEffectiveSession.mockResolvedValueOnce(null);
    const response = await POST(
      new Request("http://localhost/api/employer-directory", {
        method: "POST",
        body: JSON.stringify({ action: "createEmployer", input: { name: "Nope" } }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("lets a records manager create a name-only company and a learner without an account", async () => {
    const { POST } = await import("./route");
    getEffectiveSession.mockResolvedValue(
      session({
        workspace: "administration",
        permissions: ["admin.records.manage"],
      }),
    );
    const company = await POST(
      new Request("http://localhost/api/employer-directory", {
        method: "POST",
        body: JSON.stringify({ action: "createEmployer", input: { name: "Example Motors" } }),
      }),
    );
    expect(company.status).toBe(200);
    const companyBody = (await company.json()) as {
      snapshot: { employers: Array<{ name: string; legalName: string }> };
    };
    expect(companyBody.snapshot.employers[0]).toMatchObject({
      name: "Example Motors",
      legalName: "",
    });

    const learner = await POST(
      new Request("http://localhost/api/employer-directory", {
        method: "POST",
        body: JSON.stringify({
          action: "createReviewApprentice",
          input: { fullName: "Example Learner" },
        }),
      }),
    );
    expect(learner.status).toBe(200);
    const learnerBody = (await learner.json()) as {
      snapshot: {
        apprentices: Array<{ displayName: string }>;
        reviewDetails: Array<{ employerId: string | null }>;
      };
    };
    expect(learnerBody.snapshot.apprentices[0].displayName).toBe("Example Learner");
    expect(learnerBody.snapshot.reviewDetails[0].employerId).toBeNull();
    expect(inserts.map((insert) => insert.table)).toEqual([
      "employers",
      "apprentices",
      "review_apprentice_details",
    ]);
    expect(inserts.filter((insert) => insert.table === "employers")).toHaveLength(1);
    expect(inserts.some((insert) => insert.table === "profiles")).toBe(false);
    expect(inserts.some((insert) => insert.table === "apprentice_programmes")).toBe(false);
  });

  it("lets a records manager link a learner without creating another company", async () => {
    const { POST } = await import("./route");
    getEffectiveSession.mockResolvedValue(
      session({
        workspace: "management",
        baseRole: "Management",
        permissions: ["admin.records.manage"],
      }),
    );
    await POST(
      new Request("http://localhost/api/employer-directory", {
        method: "POST",
        body: JSON.stringify({ action: "createEmployer", input: { name: "Linked Co" } }),
      }),
    );
    await POST(
      new Request("http://localhost/api/employer-directory", {
        method: "POST",
        body: JSON.stringify({ action: "createReviewApprentice", input: { fullName: "Linked Learner" } }),
      }),
    );
    const companyId = tables.employers[0]?.id;
    const learnerId = tables.apprentices[0]?.id;
    inserts.length = 0;
    const linked = await POST(
      new Request("http://localhost/api/employer-directory", {
        method: "POST",
        body: JSON.stringify({
          action: "linkReviewApprentice",
          apprenticeId: learnerId,
          expectedVersion: 1,
          link: { employerId: companyId, siteId: null, managerRoleId: null },
        }),
      }),
    );
    expect(linked.status).toBe(200);
    expect(inserts).toHaveLength(0);
    expect(tables.employers).toHaveLength(1);
    expect(tables.review_apprentice_details[0]?.employer_id).toBe(companyId);
  });
});
