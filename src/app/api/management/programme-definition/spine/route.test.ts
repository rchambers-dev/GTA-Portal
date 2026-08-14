import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultProgrammeParameters } from "@/features/programme-definition/domain/rpl-formulas/programme-parameters";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import type { PortalAccount } from "@/lib/portal/types";

const loadProgrammeSpine = vi.fn();
const saveProgrammeSpine = vi.fn();
const getEffectiveSession = vi.fn();

vi.mock("@/adapters/standalone", () => ({
  getStandalonePorts: () => ({
    auth: { getEffectiveSession: () => getEffectiveSession() },
  }),
}));

vi.mock("@/adapters/supabase/client", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ __client: true })),
}));

vi.mock("@/features/programme-definition/domain/spine-repository", () => ({
  loadProgrammeSpine: (...args: unknown[]) => loadProgrammeSpine(...args),
  saveProgrammeSpine: (...args: unknown[]) => saveProgrammeSpine(...args),
}));

const ownerAccount: PortalAccount = {
  id: "owner-1",
  name: "Curriculum Owner",
  initials: "CO",
  email: "owner@example.invalid",
  baseRole: "Management",
  responsibilities: [],
  workspace: "management",
  permissions: ["management.workspace.view", "management.programme.setup"],
};

describe("spine API — P0 contracts", () => {
  beforeEach(() => {
    loadProgrammeSpine.mockReset();
    saveProgrammeSpine.mockReset();
    getEffectiveSession.mockReset();
    getEffectiveSession.mockResolvedValue(buildEffectiveSession(ownerAccount, []));
    vi.resetModules();
  });

  it("GET without programmeVersionId returns 400 (no newest fallback)", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request(
        "http://localhost/api/management/programme-definition/spine?standardCode=ST0499",
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(String(body.error)).toMatch(/programmeVersionId is required/i);
    expect(loadProgrammeSpine).not.toHaveBeenCalled();
  });

  it("GET with programmeVersionId requests exactly that version id", async () => {
    const params = {
      ...createDefaultProgrammeParameters(),
      expectedOtjHours: 611.5,
      includeRplBehaviours: false,
      fundingBandPounds: 13000,
      formulaStatus: "published" as const,
      rplNotes: "kept",
      fixedCostLines: [
        {
          id: "fc1",
          label: "EPA",
          amountPounds: 2000,
          enabled: true,
          sequence: 0,
        },
      ],
    };

    loadProgrammeSpine.mockResolvedValue({
      spineItems: [],
      ksbMappings: [],
      parameters: params,
      version: {
        id: "version-1",
        programme_id: "programme-1",
        standard_version_id: "sv-1",
        internal_version: "1",
        status: "draft",
        parameters: params,
      },
    });

    const { createSupabaseAdminClient } = await import(
      "@/adapters/supabase/client"
    );
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from(table: string) {
        const maybeSingle = async () => {
          if (table === "gta_programmes") {
            return { data: { id: "programme-1", title: "Autocare" } };
          }
          if (table === "se_standard_versions") {
            return {
              data: { external_version: "1.3", standard_id: "std-1" },
            };
          }
          if (table === "se_standards") {
            return { data: { standard_code: "ST0499" } };
          }
          return { data: null };
        };
        return {
          select: () => ({
            eq: () => ({ maybeSingle }),
          }),
        };
      },
    } as never);

    const { GET } = await import("./route");
    const res = await GET(
      new Request(
        "http://localhost/api/management/programme-definition/spine?programmeVersionId=version-1&standardCode=ST0499",
      ),
    );
    expect(res.status).toBe(200);
    expect(loadProgrammeSpine).toHaveBeenCalledWith(
      expect.anything(),
      "version-1",
    );
    const body = await res.json();
    expect(body.programme.id).toBe("version-1");
    expect(body.programme.parameters.expectedOtjHours).toBe(611.5);
    expect(body.programme.parameters.includeRplBehaviours).toBe(false);
    expect(body.programme.parameters.fundingBandPounds).toBe(13000);
    expect(body.programme.parameters.rplNotes).toBe("kept");
    expect(body.programme.parameters).not.toEqual(
      createDefaultProgrammeParameters(),
    );
  });

  it("PUT requires parameters and rejects corrupt formulaKey", async () => {
    saveProgrammeSpine.mockResolvedValue(undefined);
    const { PUT } = await import("./route");
    const params = {
      ...createDefaultProgrammeParameters(),
      expectedOtjHours: 611.5,
      includeRplBehaviours: false,
      fundingBandPounds: 13000,
      fixedCostLines: [
        {
          id: "fc1",
          label: "EPA",
          amountPounds: 2000,
          enabled: true,
          sequence: 0,
        },
      ],
      formulaStatus: "draft" as const,
      rplNotes: "note",
    };

    const missing = await PUT(
      new Request("http://localhost/api/management/programme-definition/spine", {
        method: "PUT",
        body: JSON.stringify({
          programmeId: "p1",
          programmeVersionId: "v1",
          standardCode: "ST0499",
          standardVersionId: "sv1",
          spineItems: [],
          ksbMappings: [],
        }),
      }),
    );
    expect(missing.status).toBe(400);

    const badKey = await PUT(
      new Request("http://localhost/api/management/programme-definition/spine", {
        method: "PUT",
        body: JSON.stringify({
          programmeId: "p1",
          programmeVersionId: "v1",
          standardCode: "ST0499",
          standardVersionId: "sv1",
          spineItems: [],
          ksbMappings: [],
          parameters: { ...params, formulaKey: "corrupt" },
        }),
      }),
    );
    expect(badKey.status).toBe(422);
    expect(saveProgrammeSpine).not.toHaveBeenCalled();

    const ok = await PUT(
      new Request("http://localhost/api/management/programme-definition/spine", {
        method: "PUT",
        body: JSON.stringify({
          programmeId: "p1",
          programmeVersionId: "v1",
          standardCode: "ST0499",
          standardVersionId: "sv1",
          spineItems: [],
          ksbMappings: [],
          parameters: params,
        }),
      }),
    );
    expect(ok.status).toBe(200);
    expect(saveProgrammeSpine).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        programmeVersionId: "v1",
        parameters: expect.objectContaining({
          expectedOtjHours: 611.5,
          includeRplBehaviours: false,
          fundingBandPounds: 13000,
        }),
      }),
    );
  });
});
