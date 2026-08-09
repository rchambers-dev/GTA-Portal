import { describe, expect, it } from "vitest";
import { saveProgrammeSpine } from "./spine-repository";
import { createDefaultProgrammeParameters } from "./rpl-formulas/programme-parameters";

describe("saveProgrammeSpine parameters persistence", () => {
  it("upserts validated parameters JSON onto gta_programme_versions", async () => {
    const upserts: Array<{ table: string; row: Record<string, unknown> }> = [];

    const supabase = {
      from(table: string) {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => {
                    if (table === "se_standards") {
                      return { data: { id: "std-1" }, error: null };
                    }
                    if (table === "gta_spines") {
                      return { data: { id: "spine-1" }, error: null };
                    }
                    return { data: null, error: null };
                  },
                  limit() {
                    return {
                      maybeSingle: async () => {
                        if (table === "gta_spines") {
                          return { data: { id: "spine-1" }, error: null };
                        }
                        return { data: null, error: null };
                      },
                    };
                  },
                  async then(resolve: (v: unknown) => void) {
                    if (table === "gta_spine_items") {
                      resolve({ data: [], error: null });
                      return;
                    }
                    resolve({ data: [], error: null });
                  },
                };
              },
            };
          },
          upsert(row: Record<string, unknown>) {
            upserts.push({ table, row });
            return {
              then(resolve: (v: unknown) => void) {
                resolve({ error: null });
              },
            };
          },
          delete() {
            return {
              in: async () => ({ error: null }),
            };
          },
          insert() {
            return {
              select() {
                return {
                  single: async () => ({
                    data: { id: "spine-1" },
                    error: null,
                  }),
                };
              },
              then(resolve: (v: unknown) => void) {
                resolve({ error: null });
              },
            };
          },
        };
      },
    };

    const parameters = {
      ...createDefaultProgrammeParameters(),
      expectedOtjHours: 611.5,
      includeRplBehaviours: false,
      fundingBandPounds: 13000,
      formulaStatus: "published" as const,
      rplNotes: "persist me",
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

    await saveProgrammeSpine(supabase as never, {
      programmeId: "p1",
      programmeVersionId: "v1",
      programmeTitle: "Autocare",
      standardCode: "ST0499",
      standardVersionId: "sv1",
      status: "draft",
      internalVersion: "1",
      spineItems: [],
      ksbMappings: [],
      parameters,
    });

    const versionUpsert = upserts.find(
      (u) => u.table === "gta_programme_versions",
    );
    expect(versionUpsert).toBeTruthy();
    expect(versionUpsert!.row.parameters).toEqual(
      expect.objectContaining({
        expectedOtjHours: 611.5,
        includeRplBehaviours: false,
        fundingBandPounds: 13000,
        formulaKey: "block_ksb_value_v1",
        formulaStatus: "published",
        rplNotes: "persist me",
      }),
    );
  });
});
