import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import type { PortalAccount, WorkspaceId } from "@/lib/portal/types";

const getEffectiveSession = vi.fn();
const rpcCalls: string[] = [];
const writes: string[] = [];

const apprenticeRow = {
  id: "apprentice-1",
  display_name: "Renamed Example",
  apprentice_reference: "GTA-2026-01001",
  email: "",
  phone: "",
  date_of_birth: null,
  uln: "",
  address_line1: "",
  address_line2: "",
  town: "",
  postcode: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relationship: "",
  support_notes: "",
  intake_status: "in_progress",
  pack: {},
  notes: "",
  created_at: "2026-11-07T00:00:00.000Z",
  updated_at: "2026-11-07T00:00:00.000Z",
};

vi.mock("@/adapters/standalone", () => ({
  getStandalonePorts: () => ({
    auth: { getEffectiveSession: () => getEffectiveSession() },
  }),
}));

vi.mock("@/adapters/supabase/client", () => ({
  createSupabaseAdminClient: () => ({
    from(table: string) {
      const api = {
        select() {
          return api;
        },
        eq() {
          return api;
        },
        insert() {
          writes.push(`insert:${table}`);
          return api;
        },
        update() {
          writes.push(`update:${table}`);
          return api;
        },
        single() {
          return Promise.resolve({ data: apprenticeRow, error: null });
        },
      };
      return api;
    },
    rpc(fn: string) {
      rpcCalls.push(fn);
      return Promise.resolve({ data: 2, error: null });
    },
  }),
}));

function session(input: {
  workspace: WorkspaceId;
  baseRole: string;
  permissions: string[];
}) {
  const account: PortalAccount = {
    id: "user-1",
    name: "Test User",
    initials: "TU",
    email: "test.user@example.invalid",
    baseRole: input.baseRole,
    responsibilities: [],
    workspace: input.workspace,
    permissions: input.permissions,
    linkedApprenticeId: null,
  };
  return buildEffectiveSession(account, []);
}

function renameRequest() {
  return new Request("http://localhost/api/admin/store", {
    method: "POST",
    body: JSON.stringify({
      action: "updateApprentice",
      id: "apprentice-1",
      patch: { displayName: "Renamed Example" },
      expectedReviewVersion: null,
    }),
  });
}

describe("legacy apprentice rename", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    writes.length = 0;
    getEffectiveSession.mockReset();
  });

  it("does not call the service-role rename for a tutor, proxy writer, apprentice, or employer", async () => {
    const { POST } = await import("./route");
    for (const denied of [
      session({
        workspace: "staff",
        baseRole: "Tutor",
        permissions: ["reviews.manage", "staff.workspace.view"],
      }),
      session({
        workspace: "staff",
        baseRole: "Tutor",
        permissions: ["records.proxy.write"],
      }),
      session({
        workspace: "apprentice",
        baseRole: "Apprentice",
        permissions: ["admin.records.manage"],
      }),
      session({
        workspace: "employer",
        baseRole: "Employer",
        permissions: ["admin.records.manage", "records.proxy.write"],
      }),
    ]) {
      getEffectiveSession.mockResolvedValueOnce(denied);
      const response = await POST(renameRequest());
      expect(response.status).toBe(403);
    }
    expect(rpcCalls).toEqual([]);
    expect(writes).toEqual([]);
  });

  it("does not write when displayName is omitted or when creating an apprentice or employer", async () => {
    const { POST } = await import("./route");
    const bodies = [
      {
        action: "updateApprentice",
        id: "apprentice-1",
        patch: { email: "proxy@example.invalid", intakeStatus: "ready" },
      },
      {
        action: "createApprentice",
        input: { displayName: "Should Not Create", email: "new@example.invalid", intakeStatus: "in_progress" },
      },
      {
        action: "createEmployer",
        input: { name: "Should Not Create" },
      },
      {
        action: "updateEmployer",
        id: "employer-1",
        patch: { contactEmail: "proxy@example.invalid" },
      },
    ];
    for (const actor of [
      session({
        workspace: "staff",
        baseRole: "Tutor",
        permissions: ["records.proxy.write"],
      }),
      session({
        workspace: "apprentice",
        baseRole: "Apprentice",
        permissions: ["admin.records.manage"],
      }),
      session({
        workspace: "employer",
        baseRole: "Employer",
        permissions: ["admin.records.manage"],
      }),
    ]) {
      for (const body of bodies) {
        getEffectiveSession.mockResolvedValueOnce(actor);
        const response = await POST(
          new Request("http://localhost/api/admin/store", {
            method: "POST",
            body: JSON.stringify(body),
          }),
        );
        expect(response.status).toBe(403);
      }
    }
    expect(writes).toEqual([]);
    expect(rpcCalls).toEqual([]);
  });

  it("renames for staff who have record-management permission", async () => {
    const { POST } = await import("./route");
    getEffectiveSession.mockResolvedValue(
      session({
        workspace: "administration",
        baseRole: "Administrator",
        permissions: ["admin.records.manage"],
      }),
    );
    const response = await POST(renameRequest());
    expect(response.status).toBe(200);
    expect(rpcCalls).toEqual(["rename_apprentice"]);
  });

  it("lets record staff create an apprentice and edit a non-name field", async () => {
    const { POST } = await import("./route");
    getEffectiveSession.mockResolvedValue(
      session({
        workspace: "administration",
        baseRole: "Administrator",
        permissions: ["admin.records.manage"],
      }),
    );
    const created = await POST(
      new Request("http://localhost/api/admin/store", {
        method: "POST",
        body: JSON.stringify({
          action: "createApprentice",
          input: {
            displayName: "New Example",
            apprenticeReference: "",
            email: "new.example@example.invalid",
            phone: "",
            dateOfBirth: "",
            uln: "",
            addressLine1: "",
            addressLine2: "",
            town: "",
            postcode: "",
            emergencyContactName: "",
            emergencyContactPhone: "",
            emergencyContactRelationship: "",
            supportNotes: "",
            intakeStatus: "in_progress",
            notes: "",
          },
        }),
      }),
    );
    expect(created.status).toBe(200);
    const edited = await POST(
      new Request("http://localhost/api/admin/store", {
        method: "POST",
        body: JSON.stringify({
          action: "updateApprentice",
          id: "apprentice-1",
          patch: { email: "updated.example@example.invalid", intakeStatus: "ready" },
        }),
      }),
    );
    expect(edited.status).toBe(200);
    expect(writes).toEqual(["insert:apprentices", "update:apprentices"]);
    expect(rpcCalls).toEqual([]);
  });
});
