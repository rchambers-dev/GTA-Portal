/**
 * Diagnostic only — evaluates sufficiency against official wording + corpus.
 * No golden injection into analysis prompts.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { describe, it } from "vitest";
import { loadOriginalLessonPlanEvidencePack } from "./evidence";
import { assessEvidenceSufficiency } from "./evidence-sufficiency";
import { retrieveEvidenceForKsb } from "./retriever";

const PV = "231a8a32-d876-4312-a178-960d19dcf938";
const FALSE_GAPS = ["K30", "S19", "B3", "K3", "K26", "K27", "S6", "S18", "S22", "S21"];
const FALSE_PRIM = ["K1", "K2", "K7", "S25"];

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
    // ok
  }
}

describe("AI-1.4 sufficiency diagnostic", () => {
  it("records current sufficiency for known AI-1.3 error patterns", async () => {
    loadEnvLocal();
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: ver } = await sb
      .from("gta_programme_versions")
      .select("standard_version_id")
      .eq("id", PV)
      .single();
    const { data: ksbs } = await sb
      .from("se_ksbs")
      .select("ksb_code,ksb_type,description")
      .eq("standard_version_id", ver!.standard_version_id);
    const by = new Map(
      (ksbs ?? []).map((k) => [String(k.ksb_code).toUpperCase(), k]),
    );
    const pack = loadOriginalLessonPlanEvidencePack();
    const rows = [];
    for (const code of [...FALSE_GAPS, ...FALSE_PRIM]) {
      const k = by.get(code)!;
      const ksb = {
        code,
        type: String(k.ksb_type || "knowledge"),
        description: String(k.description || ""),
      };
      const hits = retrieveEvidenceForKsb(ksb, pack.sessions, 10);
      const s = assessEvidenceSufficiency({ ksb, hits });
      rows.push({
        code,
        bucket: FALSE_GAPS.includes(code) ? "false_gap" : "false_primary",
        description: ksb.description,
        type: ksb.type,
        strength: s.coverageStrength,
        ratio: s.coverageRatio,
        missingMaterial: s.missingMaterialBreadth,
        practicalRequired: s.practicalRequired,
        practicalPresent: s.practicalPresent,
        covered: s.coveredComponents,
        missing: s.missingComponents,
        reasons: s.reasons,
        topHits: hits.slice(0, 4).map((h) => ({
          w: h.session.week,
          b: h.session.blockNumber,
          topic: h.session.topic,
          score: Number(h.score.toFixed(2)),
        })),
      });
    }
    writeFileSync(
      // Scratch regenerable output (gitignored). Frozen copy:
      // tests/artifacts/autocare-v1/sow-only/ai-evaluations/ai-1.4/ai14-sufficiency-diagnostic.json
      resolve(".tmp-ai14-sufficiency-diagnostic.json"),
      JSON.stringify({ at: new Date().toISOString(), rows }, null, 2),
    );
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(rows.map((r) => ({
      code: r.code,
      bucket: r.bucket,
      strength: r.strength,
      ratio: r.ratio,
      missingMaterial: r.missingMaterial,
      practical: `${r.practicalRequired}/${r.practicalPresent}`,
      missing: r.missing,
      reasons: r.reasons,
    })), null, 2));
  }, 60_000);
});
