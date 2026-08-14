/**
 * Attach ONE SAFE TEST learner-visible PowerPoint fixture to W003.
 *
 * Does NOT: change the genuine Hybrid PPT audience, alter real staff,
 * alter real apprentices, alter teaching-group assignments, release
 * Sessions, touch Tasks, attendance, or Block 3.
 *
 *   ALLOW_SAFE_TEST_W003_LEARNER_RESOURCE=1 node --env-file=.env.local scripts/seed-autocare-safe-test-w003-learner-resource.mjs --confirm
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const CONTROL_TAG = "autocare-st0499-v1.3-phase1-controlled";
const PROGRAMME_VERSION_ID =
  process.env.AUTOCARE_PHASE1_VERSION_ID?.trim() ||
  "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";

const RESOURCE_KEY = "test_learner_resource_w003_package";
const RESOURCE_TITLE =
  "TEST learner presentation — Hybrid awareness (SAFE DEMO)";
const RESOURCE_FILENAME = "TEST_W003_learner_presentation.pptx";
const EXTRACT_PATH =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/extracts/test_w003_learner_presentation.txt";
const HYBRID_KEY = "res_lm_b956dd2a0014_1";
const GROUP_NAME = "TEST Autocare Teaching Group (SAFE DEMO)";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (process.env.ALLOW_SAFE_TEST_W003_LEARNER_RESOURCE !== "1") {
  die("Requires ALLOW_SAFE_TEST_W003_LEARNER_RESOURCE=1");
}
if (!process.argv.includes("--confirm")) die("Requires --confirm");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing Supabase env");
const sb = createClient(url, key, { auth: { persistSession: false } });

async function countEq(table, filters, expected, label) {
  let q = sb.from(table).select("*", { count: "exact", head: true });
  for (const [col, val] of Object.entries(filters || {})) {
    q = q.eq(col, val);
  }
  const { count, error } = await q;
  if (error) die(error.message);
  if (count !== expected) die(`${label}: expected ${expected}, found ${count}`);
  return count;
}

const absExtract = path.resolve(EXTRACT_PATH);
if (!fs.existsSync(absExtract)) die(`Missing extract ${EXTRACT_PATH}`);

const { data: version, error: vErr } = await sb
  .from("gta_programme_versions")
  .select("id, parameters")
  .eq("id", PROGRAMME_VERSION_ID)
  .maybeSingle();
if (vErr) die(vErr.message);
if (!version) die("Programme version missing");
const params = version.parameters || {};
if (params.controlTag !== CONTROL_TAG) {
  die(`controlTag mismatch: ${params.controlTag}`);
}
if (Number(params.expectedOtjHours) !== 611.5) die("OTJ mismatch");

await countEq(
  "gta_programme_sessions",
  { programme_version_id: PROGRAMME_VERSION_ID },
  113,
  "sessions",
);
await countEq(
  "gta_course_tasks",
  { programme_version_id: PROGRAMME_VERSION_ID },
  50,
  "tasks",
);
const { count: primaries } = await sb
  .from("gta_spine_item_ksbs")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("is_primary", true);
if ((primaries ?? 0) !== 0) die(`Primaries drifted: ${primaries}`);

const { data: staff } = await sb
  .from("profiles")
  .select("id")
  .like("email", "%@doncastergta.co.uk");
if ((staff || []).length !== 26) {
  die(`Real staff drifted: ${(staff || []).length}`);
}

const { count: unlocks } = await sb
  .from("gta_enrolment_block_unlocks")
  .select("*", { count: "exact", head: true });
if ((unlocks ?? 0) !== 0) die(`S4 unlocks appeared: ${unlocks}`);

const { count: deliveries } = await sb
  .from("gta_session_delivery_records")
  .select("*", { count: "exact", head: true });
if ((deliveries ?? 0) !== 2) die(`Delivery records drifted: ${deliveries}`);

const { count: releasesBefore } = await sb
  .from("gta_session_learning_releases")
  .select("*", { count: "exact", head: true });

const { data: w003, error: sErr } = await sb
  .from("gta_programme_sessions")
  .select("id, session_key, spine_item_id, learner_facing_content")
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("session_key", "W003")
  .maybeSingle();
if (sErr) die(sErr.message);
if (!w003) die("W003 missing");
if (w003.learner_facing_content?.status !== "approved_published") {
  die("Refusing: W003 learner copy is not approved_published");
}

const { data: hybrid } = await sb
  .from("gta_programme_resources")
  .select("id")
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("resource_key", HYBRID_KEY)
  .maybeSingle();
if (!hybrid) die("Genuine Hybrid PPT resource missing");

const { data: hybridAtt } = await sb
  .from("gta_programme_resource_attachments")
  .select("id, audience, role")
  .eq("resource_id", hybrid.id)
  .eq("session_id", w003.id)
  .maybeSingle();
if (!hybridAtt) die("Genuine Hybrid PPT attachment missing");
if (hybridAtt.audience !== "TUTOR_ONLY" || hybridAtt.role !== "TUTOR_DELIVERY") {
  die(
    `Refusing: Hybrid PPT drifted to ${hybridAtt.role}/${hybridAtt.audience}`,
  );
}

const { data: group } = await sb
  .from("cohort_teaching_groups")
  .select("id, name")
  .eq("name", GROUP_NAME)
  .maybeSingle();
if (!group) die("SAFE TEST teaching group missing");

const { count: realGroupMoves } = await sb
  .from("apprentice_programmes")
  .select("*", { count: "exact", head: true })
  .eq("teaching_group_id", group.id)
  .not("apprentice_id", "eq", "ea587505-487a-4b81-aeec-963cda86e47d");
if ((realGroupMoves ?? 0) !== 0) {
  die("SAFE TEST group has unexpected extra enrolments");
}

const { error: resErr } = await sb.from("gta_programme_resources").upsert(
  {
    programme_version_id: PROGRAMME_VERSION_ID,
    resource_key: RESOURCE_KEY,
    title: RESOURCE_TITLE,
    filename: RESOURCE_FILENAME,
    source_path: "TEST FIXTURE — not a real teaching asset",
    evidence_resource_id: "",
    extract_path: EXTRACT_PATH,
    metadata: {
      isTest: true,
      phase: "w003-learner-package-proof",
      purpose: "w003-learner-visible-powerpoint-access-proof",
      binaryHostedInPortal: false,
      cleanup:
        "Delete this resource + its W003 LEARNER_VISIBLE attachment only. Do not touch the Hybrid PPT, lesson plan, learner_facing_content, Tasks, or Sessions.",
    },
  },
  { onConflict: "programme_version_id,resource_key" },
);
if (resErr) die(`resource upsert: ${resErr.message}`);

const { data: resource, error: rErr } = await sb
  .from("gta_programme_resources")
  .select("id")
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("resource_key", RESOURCE_KEY)
  .single();
if (rErr || !resource) die(rErr?.message || "resource missing");

await sb
  .from("gta_programme_resource_attachments")
  .delete()
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("resource_id", resource.id);

const { error: attErr } = await sb
  .from("gta_programme_resource_attachments")
  .insert({
    programme_version_id: PROGRAMME_VERSION_ID,
    resource_id: resource.id,
    session_id: w003.id,
    spine_item_id: w003.spine_item_id,
    role: "LEARNER_LEARNING",
    audience: "LEARNER_VISIBLE",
    sort_order: 40,
    metadata: {
      isTest: true,
      mapping: "W003 learner-visible package proof",
    },
  });
if (attErr) die(`attach: ${attErr.message}`);

const { data: hybridAfter } = await sb
  .from("gta_programme_resource_attachments")
  .select("audience, role")
  .eq("id", hybridAtt.id)
  .single();
if (hybridAfter.audience !== "TUTOR_ONLY") {
  die("Hybrid PPT audience changed — abort");
}

const { count: releasesAfter } = await sb
  .from("gta_session_learning_releases")
  .select("*", { count: "exact", head: true });
if (releasesAfter !== releasesBefore) {
  die(`Learning releases changed: ${releasesBefore} → ${releasesAfter}`);
}

const { count: staffAfter } = await sb
  .from("profiles")
  .select("*", { count: "exact", head: true })
  .like("email", "%@doncastergta.co.uk");
if (staffAfter !== 26) die("Real staff count changed");

const report = {
  ok: true,
  resource: {
    id: resource.id,
    key: RESOURCE_KEY,
    title: RESOURCE_TITLE,
    filename: RESOURCE_FILENAME,
    sessionKey: "W003",
    role: "LEARNER_LEARNING",
    audience: "LEARNER_VISIBLE",
    binaryHostedInPortal: false,
  },
  genuineHybridPptStillTutorOnly: true,
  invariants: {
    otj: 611.5,
    sessions: 113,
    tasks: 50,
    primaries: 0,
    realStaff: 26,
    unlocks: 0,
    deliveryRecords: 2,
    learningReleases: releasesAfter,
  },
  cleanup:
    "Delete gta_programme_resource_attachments for this resource_id, then the gta_programme_resources row. Leave Hybrid PPT + FS03 lesson plan untouched.",
};

fs.mkdirSync(".tmp", { recursive: true });
fs.writeFileSync(
  ".tmp/autocare-safe-test-w003-learner-resource-report.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
