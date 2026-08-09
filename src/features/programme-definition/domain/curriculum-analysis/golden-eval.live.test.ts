/**
 * Live/manual golden evaluation (not part of default test suite).
 * Run: npm run eval:autocare-v1-curriculum-ai
 *      npm run eval:autocare-v1-curriculum-ai -- --mode=portal_ai
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { analyseProgrammeVersion } from "@/features/programme-definition/domain/curriculum-analysis/engine";
import {
  buildAutocareV1GoldenLabels,
  evaluateAgainstGolden,
} from "@/features/programme-definition/domain/curriculum-analysis/golden-eval";
import { isAiConfigured } from "@/lib/ai";

const PV = "231a8a32-d876-4312-a178-960d19dcf938";
const mode = (process.env.GOLDEN_EVAL_MODE || "heuristic") as
  "heuristic" | "portal_ai";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    // env already loaded
  }
}

describe("Autocare V1 golden evaluation", () => {
  it(
    `runs ${mode} analysis and scores against frozen golden labels`,
    async () => {
      loadEnvLocal();
      if (mode === "portal_ai" && !isAiConfigured()) {
        throw new Error("portal_ai requested but AI is not configured.");
      }

      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );

      const { count: beforePrimaries } = await sb
        .from("gta_spine_item_ksbs")
        .select("id", { count: "exact", head: true })
        .eq("programme_version_id", PV)
        .eq("is_primary", true);

      const { data: ver, error: vErr } = await sb
        .from("gta_programme_versions")
        .select("id, standard_version_id")
        .eq("id", PV)
        .single();
      if (vErr) throw new Error(vErr.message);

      const { data: spine, error: sErr } = await sb
        .from("gta_spines")
        .select("id")
        .eq("programme_version_id", PV)
        .single();
      if (sErr) throw new Error(sErr.message);

      const { data: items, error: iErr } = await sb
        .from("gta_spine_items")
        .select("id, item_type, title, sequence, metadata, planned_otj_hours")
        .eq("spine_id", spine.id)
        .order("sequence");
      if (iErr) throw new Error(iErr.message);

      const { data: ksbs, error: kErr } = await sb
        .from("se_ksbs")
        .select("ksb_code, ksb_type, description")
        .eq("standard_version_id", ver.standard_version_id);
      if (kErr) throw new Error(kErr.message);

      const otj = (items ?? []).reduce(
        (s, i) => s + (Number(i.planned_otj_hours) || 0),
        0,
      );

      const blocks = (items ?? [])
        .filter((i) => i.item_type === "block")
        .map((i, idx) => ({
          id: i.id as string,
          title: String(i.title),
          sequence: Number(i.sequence),
          blockNumber:
            typeof (i.metadata as { blockNumber?: number } | null)?.blockNumber ===
            "number"
              ? (i.metadata as { blockNumber: number }).blockNumber
              : idx + 1,
        }));

      const run = await analyseProgrammeVersion(sb, {
        programmeVersionId: PV,
        officialStandardVersionId: ver.standard_version_id as string,
        blocks,
        ksbs: (ksbs ?? []).map((k) => ({
          code: String(k.ksb_code).toUpperCase(),
          type: String(k.ksb_type || "knowledge"),
          description: String(k.description || ""),
        })),
        providerMode: mode,
        createdBy: "golden-eval-harness",
        concurrency: mode === "portal_ai" ? 2 : 6,
      });

      const { count: afterPrimaries } = await sb
        .from("gta_spine_item_ksbs")
        .select("id", { count: "exact", head: true })
        .eq("programme_version_id", PV)
        .eq("is_primary", true);

      const evaluation = evaluateAgainstGolden(
        run.results ?? [],
        buildAutocareV1GoldenLabels(),
      );

      const out = {
        at: new Date().toISOString(),
        mode,
        runId: run.id,
        provider: run.provider,
        model: run.model,
        promptVersion: run.promptVersion,
        stats: run.stats,
        baselineFrozen: {
          approvedPrimariesBefore: beforePrimaries,
          approvedPrimariesAfter: afterPrimaries,
          unchanged: beforePrimaries === afterPrimaries && afterPrimaries === 45,
          structuredOtj: otj,
        },
        evaluation,
      };

      // Scratch regenerable output (gitignored). Frozen AI-1.4 history lives under
      // tests/artifacts/autocare-v1/sow-only/ai-evaluations/ai-1.4/ — do not overwrite it.
      writeFileSync(
        resolve(`.tmp-autocare-v1-ai14-golden-eval-${mode}.json`),
        JSON.stringify(out, null, 2),
      );

      // eslint-disable-next-line no-console
      console.log(JSON.stringify(out, null, 2));

      expect(out.baselineFrozen.unchanged).toBe(true);
      expect(out.baselineFrozen.structuredOtj).toBe(611.5);
      expect(evaluation.official).toBe(64);
      expect(evaluation.compared).toBe(64);
    },
    mode === "portal_ai" ? 900_000 : 180_000,
  );
});
