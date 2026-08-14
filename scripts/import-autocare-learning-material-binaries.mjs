/**
 * Import HIGH-confidence original binaries from Autocare Learning Materials.zip.
 *
 * Imports ONLY the G02 Features of Hybrid Vehicles.ppt that already matches
 * the controlled W003 tutor resource. Does not mass-map Groups to Sessions.
 * Does not create resources for unplaced catalogue files.
 * Does not change audience, attachments, extracts, or release rows.
 *
 *   ALLOW_IMPORT_RESOURCE_BINARIES=1 node --env-file=.env.local scripts/import-autocare-learning-material-binaries.mjs --confirm
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

const CONTROL_TAG = "autocare-st0499-v1.3-phase1-controlled";
const PROGRAMME_VERSION_ID =
  process.env.AUTOCARE_PHASE1_VERSION_ID?.trim() ||
  "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";
const ZIP =
  process.env.AUTOCARE_LM_ZIP?.trim() ||
  "C:\\Users\\ReissChambers\\OneDrive - Doncaster GTA\\Desktop\\Autocare Learning Materials.zip";
const SOURCE_ARCHIVE = path.basename(ZIP);
const HIGH = {
  resourceKey: "res_lm_b956dd2a0014_1",
  filename: "Features of Hybrid Vehicles.ppt",
  sha256: "b956dd2a00140f66bee5813f27342993d71c1858b2b08829f904bae54fdaf085",
  zipEntry:
    "Autocare Learning Materials/ACS L2 Lesson plans and resources/G02 Electric Hybrid Awareness/Resources/Features of Hybrid Vehicles.ppt",
  sourcePath:
    "Autocare Learning Materials/ACS L2 Lesson plans and resources/G02 Electric Hybrid Awareness/Resources/Features of Hybrid Vehicles.ppt",
  sourceGroupCode: "G02",
  sourceGroupFolder: "G02 Electric Hybrid Awareness",
  extractPath:
    "tests/artifacts/autocare-v1/evidence-enriched/staging/extracts/res_lm_b956dd2a0014_1.txt",
};
const G07_CONFLICT = {
  zipEntry:
    "Autocare Learning Materials/ACS L2 Lesson plans and resources/G07 Starting and Charging Systems/Resources/Features of Hybrid Vehicles.ppt",
  sha256: "eb016735391c91cb0db90eef2fa47e969af3f701381503d9056a65408f4650b6",
};
const SAFE_DEMO_KEY = "test_learner_resource_w003_package";
const BUCKET = "gta-programme-resource-binaries";
const MIME = "application/vnd.ms-powerpoint";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function loadEnvLocal() {
  const out = {};
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

if (process.env.ALLOW_IMPORT_RESOURCE_BINARIES !== "1") {
  die("Requires ALLOW_IMPORT_RESOURCE_BINARIES=1");
}
if (!process.argv.includes("--confirm")) die("Requires --confirm");
if (!fs.existsSync(ZIP)) die(`ZIP not found: ${ZIP}`);

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing Supabase env");
const sb = createClient(url, key, { auth: { persistSession: false } });

function extractZipEntry(zipPath, entryName, destPath) {
  const ps1 = path.resolve(".tmp/source-pack-inventory/_extract-one.ps1");
  fs.mkdirSync(path.dirname(ps1), { recursive: true });
  fs.writeFileSync(
    ps1,
    `
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($args[0])
try {
  $want = $args[1].Replace("\\","/")
  $e = $zip.Entries | Where-Object { $_.FullName.Replace("\\","/") -eq $want } | Select-Object -First 1
  if (-not $e) { throw "ZIP entry not found: $want" }
  $dir = Split-Path -Parent $args[2]
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $in = $e.Open()
  try {
    $out = [System.IO.File]::Create($args[2])
    try { $in.CopyTo($out) } finally { $out.Dispose() }
  } finally { $in.Dispose() }
} finally { $zip.Dispose() }
`,
    "utf8",
  );
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, zipPath, entryName, destPath],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    die(result.stderr || result.stdout || `Failed to extract ${entryName}`);
  }
}

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

const extractAbs = path.resolve(HIGH.extractPath);
if (!fs.existsSync(extractAbs)) die(`Extract missing: ${HIGH.extractPath}`);
const extractText = fs.readFileSync(extractAbs, "utf8");
if (!extractText.includes(HIGH.sha256)) {
  die("Extract hash header does not match the HIGH binary SHA256. Extract was not overwritten.");
}
if (!/===== SLIDE 13 =====/i.test(extractText) || !/Question 1/i.test(extractText)) {
  die("Extract no longer contains quiz-answer slide evidence.");
}

const { data: version, error: vErr } = await sb
  .from("gta_programme_versions")
  .select("id, parameters")
  .eq("id", PROGRAMME_VERSION_ID)
  .maybeSingle();
if (vErr) die(vErr.message);
if (!version) die("Programme version missing");
const params = version.parameters || {};
if (params.controlTag !== CONTROL_TAG) die(`controlTag mismatch: ${params.controlTag}`);
if (Number(params.expectedOtjHours) !== 611.5) die("OTJ mismatch");

await countEq("gta_programme_sessions", { programme_version_id: PROGRAMME_VERSION_ID }, 113, "sessions");
await countEq("gta_course_tasks", { programme_version_id: PROGRAMME_VERSION_ID }, 50, "tasks");

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
if ((staff || []).length !== 26) die(`Real staff drifted: ${(staff || []).length}`);

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

const { data: resource, error: rErr } = await sb
  .from("gta_programme_resources")
  .select(
    "id, resource_key, title, filename, source_path, evidence_resource_id, extract_path, metadata",
  )
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("resource_key", HIGH.resourceKey)
  .maybeSingle();
if (rErr) die(rErr.message);
if (!resource) die("Controlled Hybrid resource missing");
if (resource.extract_path !== HIGH.extractPath) {
  die(`Refusing: extract_path drifted to ${resource.extract_path}`);
}

const { data: w003, error: sErr } = await sb
  .from("gta_programme_sessions")
  .select("id, session_key")
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("session_key", "W003")
  .maybeSingle();
if (sErr) die(sErr.message);
if (!w003) die("W003 missing");

const { data: att } = await sb
  .from("gta_programme_resource_attachments")
  .select("id, role, audience, session_id")
  .eq("resource_id", resource.id)
  .eq("session_id", w003.id)
  .maybeSingle();
if (!att) die("W003 attachment missing");
if (att.role !== "TUTOR_DELIVERY" || att.audience !== "TUTOR_ONLY") {
  die(`Refusing: W003 attachment is ${att.role}/${att.audience}`);
}

const dest = path.resolve(".tmp/source-pack-inventory/high-binaries", HIGH.filename);
extractZipEntry(ZIP, HIGH.zipEntry, dest);
const bytes = fs.readFileSync(dest);
const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
if (sha256 !== HIGH.sha256) {
  die(`SHA256 mismatch: got ${sha256}, expected ${HIGH.sha256}`);
}

let backend = "supabase";
let bucket = BUCKET;
try {
  const listed = await sb.storage.listBuckets();
  if (listed.error) throw listed.error;
  const exists = (listed.data || []).some((b) => b.name === BUCKET);
  if (!exists) {
    const created = await sb.storage.createBucket(BUCKET, {
      public: false,
    });
    if (created.error) throw created.error;
  }
} catch {
  backend = "local";
  bucket = "local-uploads";
}

const storagePath = `${PROGRAMME_VERSION_ID}/${resource.id}/${sha256.slice(0, 16)}_${HIGH.filename.replace(/[^\w.\-]+/g, "_")}`;
if (backend === "local") {
  const abs = path.resolve("uploads/programme-resources", storagePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, bytes);
} else {
  const uploaded = await sb.storage.from(bucket).upload(storagePath, bytes, {
    contentType: MIME,
    upsert: true,
  });
  if (uploaded.error) die(uploaded.error.message);
}

const { data: binaryRow, error: bErr } = await sb
  .from("gta_programme_resource_binaries")
  .upsert(
    {
      resource_id: resource.id,
      programme_version_id: PROGRAMME_VERSION_ID,
      original_filename: HIGH.filename,
      mime_type: MIME,
      size_bytes: bytes.length,
      sha256,
      storage_bucket: bucket,
      storage_path: storagePath,
      source_archive: SOURCE_ARCHIVE,
      source_path: HIGH.sourcePath,
      source_group_code: HIGH.sourceGroupCode,
      source_group_folder: HIGH.sourceGroupFolder,
      version_review: "SAME",
      metadata: {
        importedBy: "import-autocare-learning-material-binaries.mjs",
        quizAnswerSlidesPreservedInExtract: true,
        audienceUnchanged: "TUTOR_ONLY",
      },
    },
    { onConflict: "resource_id" },
  )
  .select("id")
  .single();
if (bErr) die(bErr.message);

const { error: pErr } = await sb.from("gta_programme_resource_source_paths").upsert(
  {
    resource_id: resource.id,
    binary_id: binaryRow.id,
    source_archive: SOURCE_ARCHIVE,
    source_path: HIGH.sourcePath,
    source_group_code: HIGH.sourceGroupCode,
    source_group_folder: HIGH.sourceGroupFolder,
    sha256,
  },
  { onConflict: "resource_id,source_path" },
);
if (pErr) die(pErr.message);

const meta = resource.metadata && typeof resource.metadata === "object" ? resource.metadata : {};
const { error: mErr } = await sb
  .from("gta_programme_resources")
  .update({
    metadata: {
      ...meta,
      binaryHostedInPortal: true,
      binarySha256: sha256,
      binaryImportedFrom: HIGH.sourcePath,
    },
  })
  .eq("id", resource.id);
if (mErr) die(mErr.message);

const { data: afterResource } = await sb
  .from("gta_programme_resources")
  .select("extract_path, metadata")
  .eq("id", resource.id)
  .maybeSingle();
if (afterResource?.extract_path !== HIGH.extractPath) {
  die("Extract path was changed; aborting conceptually — extract must stay.");
}

const { data: afterAtt } = await sb
  .from("gta_programme_resource_attachments")
  .select("role, audience")
  .eq("id", att.id)
  .maybeSingle();
if (afterAtt?.audience !== "TUTOR_ONLY" || afterAtt?.role !== "TUTOR_DELIVERY") {
  die("Audience/role drifted");
}

const { data: safeDemo } = await sb
  .from("gta_programme_resources")
  .select("id, title, filename")
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("resource_key", SAFE_DEMO_KEY)
  .maybeSingle();
let safeDemoBinary = null;
if (safeDemo) {
  const { data } = await sb
    .from("gta_programme_resource_binaries")
    .select("id")
    .eq("resource_id", safeDemo.id)
    .maybeSingle();
  safeDemoBinary = data;
}

const { count: releasesAfter } = await sb
  .from("gta_session_learning_releases")
  .select("*", { count: "exact", head: true });
const { count: sessionsAfter } = await sb
  .from("gta_programme_sessions")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", PROGRAMME_VERSION_ID);
const { count: tasksAfter } = await sb
  .from("gta_course_tasks")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", PROGRAMME_VERSION_ID);
const { count: deliveriesAfter } = await sb
  .from("gta_session_delivery_records")
  .select("*", { count: "exact", head: true });
const { data: staffAfter } = await sb
  .from("profiles")
  .select("id")
  .like("email", "%@doncastergta.co.uk");
const { count: unlocksAfter } = await sb
  .from("gta_enrolment_block_unlocks")
  .select("*", { count: "exact", head: true });
const { count: primariesAfter } = await sb
  .from("gta_spine_item_ksbs")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("is_primary", true);
const { count: binariesImported } = await sb
  .from("gta_programme_resource_binaries")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", PROGRAMME_VERSION_ID);

console.log(
  JSON.stringify(
    {
      ok: true,
      imported: {
        resourceId: resource.id,
        resourceKey: HIGH.resourceKey,
        filename: HIGH.filename,
        sha256,
        sizeBytes: bytes.length,
        storageBackend: backend,
        storageBucket: bucket,
        storagePath,
        sourcePath: HIGH.sourcePath,
        versionReview: "SAME",
        sessionKey: "W003",
        role: "TUTOR_DELIVERY",
        audience: "TUTOR_ONLY",
        extractPreserved: afterResource?.extract_path === HIGH.extractPath,
      },
      skipped: {
        g07SameFilenameDifferentHash: {
          path: G07_CONFLICT.zipEntry,
          sha256: G07_CONFLICT.sha256,
          action: "not imported; version conflict; not merged into W003",
        },
        otherZipFiles: "not imported; catalogue-known but not controlled HIGH matches",
      },
      safeDemo: {
        present: Boolean(safeDemo),
        id: safeDemo?.id || null,
        title: safeDemo?.title || null,
        binaryImported: Boolean(safeDemoBinary),
      },
      invariants: {
        otj: 611.5,
        sessions: sessionsAfter,
        tasks: tasksAfter,
        primaries: primariesAfter,
        realStaff: (staffAfter || []).length,
        s4Unlocks: unlocksAfter,
        deliveryRecords: deliveriesAfter,
        learningReleases: [releasesBefore, releasesAfter],
        binariesForVersion: binariesImported,
      },
    },
    null,
    2,
  ),
);
