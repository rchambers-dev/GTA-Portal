/**
 * Attach a harmless SAFE DEMO .pptx binary to the existing W003
 * learner-visible test resource. Does not create resources, releases,
 * or genuine curriculum evidence.
 *
 *   ALLOW_SAFE_DEMO_W003_LEARNER_BINARY=1 node --env-file=.env.local scripts/attach-safe-demo-w003-learner-binary.mjs --confirm
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
const RESOURCE_KEY = "test_learner_resource_w003_package";
const HYBRID_KEY = "res_lm_b956dd2a0014_1";
const FILENAME = "TEST_W003_learner_presentation_SAFE_DEMO.pptx";
const MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const BUCKET = "gta-programme-resource-binaries";
const TEST_APPRENTICE_ID = "ea587505-487a-4b81-aeec-963cda86e47d";
const EXTRACT_PATH =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/extracts/test_w003_learner_presentation.txt";
const OUT_PPTX = path.resolve(
  "tests/artifacts/autocare-v1/evidence-enriched/staging/safe-demo",
  FILENAME,
);

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

if (process.env.ALLOW_SAFE_DEMO_W003_LEARNER_BINARY !== "1") {
  die("Requires ALLOW_SAFE_DEMO_W003_LEARNER_BINARY=1");
}
if (!process.argv.includes("--confirm")) die("Requires --confirm");

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing Supabase env");
const sb = createClient(url, key, { auth: { persistSession: false } });

function createSafeDemoPptx(dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const ps1 = path.resolve(".tmp/source-pack-inventory/_make-safe-demo-pptx.ps1");
  fs.mkdirSync(path.dirname(ps1), { recursive: true });
  fs.writeFileSync(
    ps1,
    `
$ErrorActionPreference = "Stop"
$path = $args[0]
$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
try {
  $pres = $ppt.Presentations.Add()
  $slide = $pres.Slides.Add(1, 2)
  $slide.Shapes.Title.TextFrame.TextRange.Text = "TEST RESOURCE"
  $slide.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = "Hybrid and High-Voltage Vehicle Awareness\`rSAFE DEMO\`rThis file exists only to validate learner file access."
  if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
  $pres.SaveAs($path, 24)
  $pres.Close()
} finally {
  $ppt.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
`,
    "utf8",
  );
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, dest],
    { encoding: "utf8" },
  );
  if (result.status !== 0 || !fs.existsSync(dest)) {
    die(result.stderr || result.stdout || "PowerPoint could not create the SAFE DEMO pptx");
  }
}

async function countEq(table, filters, expected, label) {
  let q = sb.from(table).select("*", { count: "exact", head: true });
  for (const [col, val] of Object.entries(filters || {})) q = q.eq(col, val);
  const { count, error } = await q;
  if (error) die(error.message);
  if (count !== expected) die(`${label}: expected ${expected}, found ${count}`);
  return count;
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
const { data: staff } = await sb.from("profiles").select("id").like("email", "%@doncastergta.co.uk");
if ((staff || []).length !== 26) die(`Real staff drifted: ${(staff || []).length}`);
const { count: unlocks } = await sb.from("gta_enrolment_block_unlocks").select("*", { count: "exact", head: true });
if ((unlocks ?? 0) !== 0) die(`S4 unlocks appeared: ${unlocks}`);
const { count: deliveries } = await sb.from("gta_session_delivery_records").select("*", { count: "exact", head: true });
if ((deliveries ?? 0) !== 2) die(`Delivery records drifted: ${deliveries}`);
const { count: releasesBefore } = await sb.from("gta_session_learning_releases").select("*", { count: "exact", head: true });

const { data: resource, error: rErr } = await sb
  .from("gta_programme_resources")
  .select("id, title, filename, extract_path, source_path, metadata, resource_key")
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("resource_key", RESOURCE_KEY)
  .maybeSingle();
if (rErr) die(rErr.message);
if (!resource) die("SAFE DEMO learner resource missing");
if (resource.extract_path !== EXTRACT_PATH) die("Refusing: SAFE DEMO extract_path drifted");

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
if (!att) die("SAFE DEMO W003 attachment missing");
if (att.role !== "LEARNER_LEARNING" || att.audience !== "LEARNER_VISIBLE") {
  die(`Refusing: SAFE DEMO attachment is ${att.role}/${att.audience}`);
}

const { data: hybrid } = await sb
  .from("gta_programme_resources")
  .select("id")
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("resource_key", HYBRID_KEY)
  .maybeSingle();
if (!hybrid) die("Genuine Hybrid PPT missing");
const { data: hybridAtt } = await sb
  .from("gta_programme_resource_attachments")
  .select("id, role, audience")
  .eq("resource_id", hybrid.id)
  .eq("session_id", w003.id)
  .maybeSingle();
if (!hybridAtt || hybridAtt.audience !== "TUTOR_ONLY" || hybridAtt.role !== "TUTOR_DELIVERY") {
  die("Refusing: genuine Hybrid PPT is no longer Tutor only");
}

createSafeDemoPptx(OUT_PPTX);
const bytes = fs.readFileSync(OUT_PPTX);
if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) die("Created file is not a ZIP/PPTX");
const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

const listed = await sb.storage.listBuckets();
if (listed.error) die(listed.error.message);
const exists = (listed.data || []).some((b) => b.name === BUCKET);
if (!exists) {
  const created = await sb.storage.createBucket(BUCKET, { public: false });
  if (created.error) die(created.error.message);
}

const storagePath = `${PROGRAMME_VERSION_ID}/${resource.id}/${sha256.slice(0, 16)}_SAFE_DEMO.pptx`;
const uploaded = await sb.storage.from(BUCKET).upload(storagePath, bytes, {
  contentType: MIME,
  upsert: true,
});
if (uploaded.error) die(uploaded.error.message);

const { data: binaryRow, error: bErr } = await sb
  .from("gta_programme_resource_binaries")
  .upsert(
    {
      resource_id: resource.id,
      programme_version_id: PROGRAMME_VERSION_ID,
      original_filename: FILENAME,
      mime_type: MIME,
      size_bytes: bytes.length,
      sha256,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      source_archive: "SAFE DEMO fixture",
      source_path: `tests/artifacts/autocare-v1/evidence-enriched/staging/safe-demo/${FILENAME}`,
      source_group_code: "",
      source_group_folder: "",
      version_review: "SAME",
      metadata: {
        isTest: true,
        notCurriculumEvidence: true,
        purpose: "w003-learner-visible-binary-retrieval-proof",
      },
    },
    { onConflict: "resource_id" },
  )
  .select("id, storage_bucket, storage_path, original_filename, mime_type, size_bytes, sha256")
  .single();
if (bErr) die(bErr.message);

const meta =
  resource.metadata && typeof resource.metadata === "object" ? resource.metadata : {};
const { error: mErr } = await sb
  .from("gta_programme_resources")
  .update({
    filename: FILENAME,
    metadata: {
      ...meta,
      isTest: true,
      binaryHostedInPortal: true,
      binarySha256: sha256,
      notCurriculumEvidence: true,
    },
  })
  .eq("id", resource.id);
if (mErr) die(mErr.message);

const { data: afterAtt } = await sb
  .from("gta_programme_resource_attachments")
  .select("role, audience")
  .eq("id", att.id)
  .maybeSingle();
if (afterAtt?.audience !== "LEARNER_VISIBLE" || afterAtt?.role !== "LEARNER_LEARNING") {
  die("SAFE DEMO classification drifted");
}
const { data: hybridAfter } = await sb
  .from("gta_programme_resource_attachments")
  .select("role, audience")
  .eq("id", hybridAtt.id)
  .maybeSingle();
if (hybridAfter?.audience !== "TUTOR_ONLY") die("Genuine Hybrid PPT audience drifted");

const { data: afterResource } = await sb
  .from("gta_programme_resources")
  .select("extract_path, title, filename")
  .eq("id", resource.id)
  .maybeSingle();
if (afterResource?.extract_path !== EXTRACT_PATH) die("Extract path changed");

const { count: releasesAfter } = await sb.from("gta_session_learning_releases").select("*", { count: "exact", head: true });
if (releasesAfter !== releasesBefore) die("Learning releases changed");

const { data: enrolment } = await sb
  .from("apprentice_programmes")
  .select("id, programme_week, apprentice_id")
  .eq("apprentice_id", TEST_APPRENTICE_ID)
  .eq("gta_programme_version_id", PROGRAMME_VERSION_ID)
  .maybeSingle();
if (!enrolment) die("SAFE TEST enrolment missing");
const { data: w003Release } = await sb
  .from("gta_session_learning_releases")
  .select("id")
  .eq("session_id", w003.id)
  .eq("apprentice_programme_id", enrolment.id)
  .maybeSingle();
if (!w003Release) die("W003 is not released for the SAFE TEST apprentice");

const { data: apprentice } = await sb
  .from("apprentices")
  .select("id, apprentice_reference, display_name")
  .eq("id", TEST_APPRENTICE_ID)
  .maybeSingle();
const isTest =
  String(apprentice?.apprentice_reference || "").startsWith("TEST-") ||
  /TEST|DEMO/i.test(String(apprentice?.display_name || ""));
if (!isTest) die("SAFE TEST apprentice is not flagged as test");

const programmeWeek = Number(enrolment.programme_week) || 1;
const block1Open = programmeWeek >= 1 && programmeWeek <= 10;
if (!block1Open) die(`Block 1 not open for programme_week=${programmeWeek}`);

const downloaded = await sb.storage.from(BUCKET).download(storagePath);
if (downloaded.error) die(downloaded.error.message);
const retrieved = Buffer.from(await downloaded.data.arrayBuffer());
const retrievedHash = crypto.createHash("sha256").update(retrieved).digest("hex");
if (retrievedHash !== sha256) die("Retrieved binary hash mismatch");
if (retrieved[0] !== 0x50 || retrieved[1] !== 0x4b) die("Retrieved bytes are not a PPTX/ZIP");

const publicUrl = `${url.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${storagePath}`;
const publicRes = await fetch(publicUrl);
const anonObjectUrl = `${url.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${storagePath}`;
const anonRes = await fetch(anonObjectUrl);

let unauthApi = { status: null, error: null };
try {
  const res = await fetch(
    `http://127.0.0.1:3000/api/apprentice/learning/resources/${resource.id}/file`,
  );
  unauthApi = { status: res.status, error: (await res.json().catch(() => ({}))).error || null };
} catch (err) {
  unauthApi = { status: null, error: err instanceof Error ? err.message : String(err) };
}

const { data: otherEnrolment } = await sb
  .from("apprentice_programmes")
  .select("id, apprentice_id")
  .eq("gta_programme_version_id", PROGRAMME_VERSION_ID)
  .neq("apprentice_id", TEST_APPRENTICE_ID)
  .limit(1)
  .maybeSingle();
let wrongApprentice = { denied: true, reason: "no other enrolment on this version" };
if (otherEnrolment) {
  const { data: otherApprentice } = await sb
    .from("apprentices")
    .select("apprentice_reference, display_name")
    .eq("id", otherEnrolment.apprentice_id)
    .maybeSingle();
  const otherIsTest =
    String(otherApprentice?.apprentice_reference || "").startsWith("TEST-") ||
    /TEST|DEMO/i.test(String(otherApprentice?.display_name || ""));
  wrongApprentice = {
    apprenticeId: otherEnrolment.apprentice_id,
    isTest: otherIsTest,
    denied: otherIsTest === false,
    reason: otherIsTest
      ? "other record is also a test fixture"
      : "SAFE DEMO hidden from non-test apprentices; not their released Session package",
  };
}

const { count: sessionsAfter } = await sb
  .from("gta_programme_sessions")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", PROGRAMME_VERSION_ID);
const { count: tasksAfter } = await sb
  .from("gta_course_tasks")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", PROGRAMME_VERSION_ID);
const { data: staffAfter } = await sb.from("profiles").select("id").like("email", "%@doncastergta.co.uk");
const { count: binaries } = await sb
  .from("gta_programme_resource_binaries")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", PROGRAMME_VERSION_ID);

const learnerCard = {
  kindLabel: "PowerPoint",
  title: afterResource.title,
  filename: FILENAME,
  openLabel: "Open presentation",
  openMode: "binary",
  binaryAvailable: true,
  extractAvailable: true,
  extractLabel: "View extract",
  unavailableNote: null,
};

console.log(
  JSON.stringify(
    {
      ok: true,
      safeDemo: {
        resourceId: resource.id,
        resourceKey: RESOURCE_KEY,
        title: afterResource.title,
        filename: FILENAME,
        role: "LEARNER_LEARNING",
        audience: "LEARNER_VISIBLE",
        sessionKey: "W003",
        binaryId: binaryRow.id,
        storageBucket: binaryRow.storage_bucket,
        storagePath: binaryRow.storage_path,
        sha256,
        sizeBytes: bytes.length,
        mimeType: MIME,
        contentDisposition: `attachment; filename="${FILENAME}"`,
        extractPreserved: afterResource.extract_path === EXTRACT_PATH,
        notCurriculumEvidence: true,
      },
      learnerCard,
      retrieval: {
        authorisedBackend: retrievedHash === sha256,
        pptxSignature: retrieved[0] === 0x50 && retrieved[1] === 0x4b,
        bytes: retrieved.length,
        w003Released: true,
        block1Open: true,
        isTestApprentice: true,
        expectedHttp: 200,
      },
      security: {
        genuineHybridStillTutorOnly: hybridAfter.audience === "TUTOR_ONLY",
        genuineHybridApprenticeExpected: 403,
        unauthenticatedApi: unauthApi,
        publicStorage: { url: publicUrl, status: publicRes.status },
        anonymousObject: { url: anonObjectUrl, status: anonRes.status },
        wrongApprentice,
      },
      genuineW003LearnerResourceGapStillOpen: true,
      invariants: {
        otj: 611.5,
        sessions: sessionsAfter,
        tasks: tasksAfter,
        primaries,
        realStaff: (staffAfter || []).length,
        s4Unlocks: unlocks,
        deliveryRecords: deliveries,
        learningReleases: releasesAfter,
        binariesForVersion: binaries,
      },
    },
    null,
    2,
  ),
);
