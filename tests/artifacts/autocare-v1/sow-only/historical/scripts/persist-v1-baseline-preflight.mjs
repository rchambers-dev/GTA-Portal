/**
 * Prefight: load Autocare V1 spine blocks + existing primaries for baseline persist.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
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
}

loadEnvLocal();

const PROGRAMME_VERSION_ID = "231a8a32-d876-4312-a178-960d19dcf938";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: ver, error: vErr } = await sb
    .from("gta_programme_versions")
    .select("id, standard_version_id, parameters")
    .eq("id", PROGRAMME_VERSION_ID)
    .single();
  if (vErr) throw new Error(vErr.message);

  const { data: spine, error: sErr } = await sb
    .from("gta_spines")
    .select("id")
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .single();
  if (sErr) throw new Error(sErr.message);

  const { data: items, error: iErr } = await sb
    .from("gta_spine_items")
    .select("id, item_type, title, sequence, planned_otj_hours, metadata")
    .eq("spine_id", spine.id)
    .order("sequence");
  if (iErr) throw new Error(iErr.message);

  const { data: maps, error: mErr } = await sb
    .from("gta_spine_item_ksbs")
    .select(
      "id, spine_item_id, is_primary, ksb_id, learning_intent, curriculum_value, created_by, mapping_source",
    )
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if (mErr) throw new Error(mErr.message);

  const { data: ksbs, error: kErr } = await sb
    .from("se_ksbs")
    .select("id, ksb_code")
    .eq("standard_version_id", ver.standard_version_id);
  if (kErr) throw new Error(kErr.message);

  const codeById = new Map(
    (ksbs ?? []).map((k) => [k.id, String(k.ksb_code).toUpperCase()]),
  );

  const otj = (items ?? []).reduce(
    (s, i) => s + (Number(i.planned_otj_hours) || 0),
    0,
  );

  const out = {
    programmeVersionId: PROGRAMME_VERSION_ID,
    standardVersionId: ver.standard_version_id,
    spineId: spine.id,
    structuredOtj: otj,
    officialKsbCount: ksbs?.length ?? 0,
    blocks: (items ?? [])
      .filter((i) => i.item_type === "block")
      .map((i, idx) => ({
        id: i.id,
        sequence: i.sequence,
        title: i.title,
        blockNumber:
          typeof i.metadata?.blockNumber === "number"
            ? i.metadata.blockNumber
            : idx + 1,
      })),
    nonBlocks: (items ?? [])
      .filter((i) => i.item_type !== "block")
      .map((i) => ({ id: i.id, type: i.item_type, title: i.title })),
    existingMappings: (maps ?? []).length,
    existingPrimaries: (maps ?? [])
      .filter((m) => m.is_primary)
      .map((m) => ({
        code: codeById.get(m.ksb_id),
        blockId: m.spine_item_id,
        intent: m.learning_intent,
        value: Number(m.curriculum_value),
        createdBy: m.created_by,
      }))
      .sort((a, b) => String(a.code).localeCompare(String(b.code))),
  };

  writeFileSync(
    ".tmp-persist-v1-baseline-preflight.json",
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
