/**
 * Generate in-portal slide-image previews for:
 * - SAFE DEMO learner PPTX (apprentice-visible)
 * - genuine W003 Hybrid PPT (tutor-only)
 *
 * Does not create Session releases, change audience, or replace originals.
 *
 *   ALLOW_W003_RESOURCE_PREVIEWS=1 node --env-file=.env.local scripts/generate-w003-resource-previews.mjs --confirm
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
const SAFE_DEMO_ID = "1e103a37-317a-4955-833b-5e6fe877b9a8";
const HYBRID_ID = "eb00bcb9-df19-41dc-a4b0-b347d86d93ef";
const BUCKET = "gta-programme-resource-binaries";
const TEST_APPRENTICE_ID = "ea587505-487a-4b81-aeec-963cda86e47d";

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

if (process.env.ALLOW_W003_RESOURCE_PREVIEWS !== "1") {
  die("Requires ALLOW_W003_RESOURCE_PREVIEWS=1");
}
if (!process.argv.includes("--confirm")) die("Requires --confirm");

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing Supabase env");
const sb = createClient(url, key, { auth: { persistSession: false } });

async function countEq(table, filters, expected, label) {
  let q = sb.from(table).select("*", { count: "exact", head: true });
  for (const [col, val] of Object.entries(filters || {})) q = q.eq(col, val);
  const { count, error } = await q;
  if (error) die(error.message);
  if (count !== expected) die(`${label}: expected ${expected}, found ${count}`);
  return count;
}

function exportSlides(sourcePath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const ps1 = path.resolve("scripts/export-resource-preview-slides.ps1");
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, sourcePath, outDir],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    die(result.stderr || result.stdout || `PowerPoint export failed for ${sourcePath}`);
  }
  const manifestPath = path.join(outDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) die(`No slide manifest written for ${sourcePath}`);
  const raw = fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

async function loadResource(id) {
  const { data: resource, error } = await sb
    .from("gta_programme_resources")
    .select("id, title, filename, extract_path, resource_key, metadata")
    .eq("id", id)
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .maybeSingle();
  if (error) die(error.message);
  if (!resource) die(`Resource missing: ${id}`);
  const { data: binary, error: bErr } = await sb
    .from("gta_programme_resource_binaries")
    .select("id, sha256, storage_bucket, storage_path, original_filename, mime_type, size_bytes")
    .eq("resource_id", id)
    .maybeSingle();
  if (bErr) die(bErr.message);
  if (!binary) die(`Original binary missing for ${id}`);
  return { resource, binary };
}

async function downloadOriginal(binary, dest) {
  const downloaded = await sb.storage
    .from(binary.storage_bucket)
    .download(binary.storage_path);
  if (downloaded.error) die(downloaded.error.message);
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  if (hash !== binary.sha256) die(`Original hash mismatch for ${binary.storage_path}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, bytes);
  return bytes;
}

async function storePreview({ resource, binary, localDir, manifest, audience }) {
  const slides = [];
  for (const slide of manifest.slides || []) {
    const pngPath = path.join(localDir, slide.file);
    if (!fs.existsSync(pngPath)) die(`Missing slide image ${pngPath}`);
    const bytes = fs.readFileSync(pngPath);
    const storagePath = `previews/${PROGRAMME_VERSION_ID}/${resource.id}/${binary.sha256.slice(0, 16)}/${slide.file}`;
    const uploaded = await sb.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (uploaded.error) die(uploaded.error.message);
    slides.push({
      index: slide.index,
      storagePath,
      mimeType: "image/png",
      text: Array.isArray(slide.text) ? slide.text : [],
    });
  }
  const { data: row, error } = await sb
    .from("gta_programme_resource_previews")
    .upsert(
      {
        resource_id: resource.id,
        binary_id: binary.id,
        programme_version_id: PROGRAMME_VERSION_ID,
        preview_type: "slide_images",
        status: "ready",
        generated_from_binary_hash: binary.sha256,
        storage_bucket: BUCKET,
        slide_count: slides.length,
        failure_reason: "",
        manifest: {
          slides,
          generator: manifest.generator || "powerpoint_com_png_v1",
          audience,
        },
      },
      { onConflict: "resource_id" },
    )
    .select("id, slide_count, generated_from_binary_hash, status")
    .single();
  if (error) die(error.message);
  return { row, slides };
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
if ((releasesBefore ?? 0) !== 3) die(`Learning releases drifted: ${releasesBefore}`);

const { data: w003 } = await sb
  .from("gta_programme_sessions")
  .select("id, session_key")
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("session_key", "W003")
  .maybeSingle();
if (!w003) die("W003 missing");

const demo = await loadResource(SAFE_DEMO_ID);
const hybrid = await loadResource(HYBRID_ID);

const { data: demoAtt } = await sb
  .from("gta_programme_resource_attachments")
  .select("role, audience")
  .eq("resource_id", SAFE_DEMO_ID)
  .eq("session_id", w003.id)
  .maybeSingle();
if (!demoAtt || demoAtt.audience !== "LEARNER_VISIBLE" || demoAtt.role !== "LEARNER_LEARNING") {
  die("SAFE DEMO is no longer learner-visible");
}
const { data: hybridAtt } = await sb
  .from("gta_programme_resource_attachments")
  .select("role, audience")
  .eq("resource_id", HYBRID_ID)
  .eq("session_id", w003.id)
  .maybeSingle();
if (!hybridAtt || hybridAtt.audience !== "TUTOR_ONLY" || hybridAtt.role !== "TUTOR_DELIVERY") {
  die("Genuine Hybrid PPT is no longer Tutor only");
}

const workRoot = path.resolve(".tmp/resource-previews");
const demoSrc = path.join(workRoot, "SAFE_DEMO.pptx");
const hybridSrc = path.join(workRoot, "hybrid.ppt");
const demoOut = path.join(workRoot, "demo-slides");
const hybridOut = path.join(workRoot, "hybrid-slides");

await downloadOriginal(demo.binary, demoSrc);
await downloadOriginal(hybrid.binary, hybridSrc);

const demoManifest = exportSlides(demoSrc, demoOut);
const hybridManifest = exportSlides(hybridSrc, hybridOut);
if (!demoManifest.slideCount) die("SAFE DEMO produced no slides");
if (!hybridManifest.slideCount) die("Hybrid PPT produced no slides");

const demoStored = await storePreview({
  resource: demo.resource,
  binary: demo.binary,
  localDir: demoOut,
  manifest: demoManifest,
  audience: "LEARNER_VISIBLE",
});
const hybridStored = await storePreview({
  resource: hybrid.resource,
  binary: hybrid.binary,
  localDir: hybridOut,
  manifest: hybridManifest,
  audience: "TUTOR_ONLY",
});

const { data: hybridAfter } = await sb
  .from("gta_programme_resource_attachments")
  .select("role, audience")
  .eq("resource_id", HYBRID_ID)
  .eq("session_id", w003.id)
  .maybeSingle();
if (hybridAfter?.audience !== "TUTOR_ONLY") die("Genuine Hybrid PPT audience drifted");
const { data: demoAfter } = await sb
  .from("gta_programme_resource_attachments")
  .select("role, audience")
  .eq("resource_id", SAFE_DEMO_ID)
  .eq("session_id", w003.id)
  .maybeSingle();
if (demoAfter?.audience !== "LEARNER_VISIBLE") die("SAFE DEMO audience drifted");

const { count: releasesAfter } = await sb.from("gta_session_learning_releases").select("*", { count: "exact", head: true });
if (releasesAfter !== releasesBefore) die("Learning releases changed");

const publicSlidePath = demoStored.slides[0]?.storagePath;
const publicUrl = `${url.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${publicSlidePath}`;
const publicRes = await fetch(publicUrl);
const anonObjectUrl = `${url.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${publicSlidePath}`;
const anonRes = await fetch(anonObjectUrl);

let unauthPreview = { status: null, error: null };
try {
  const res = await fetch(
    `http://127.0.0.1:3000/api/apprentice/learning/resources/${SAFE_DEMO_ID}/preview`,
  );
  unauthPreview = {
    status: res.status,
    error: (await res.json().catch(() => ({}))).error || null,
  };
} catch (err) {
  unauthPreview = { status: null, error: err instanceof Error ? err.message : String(err) };
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
const { count: previews } = await sb
  .from("gta_programme_resource_previews")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", PROGRAMME_VERSION_ID);

console.log(
  JSON.stringify(
    {
      ok: true,
      architecture: {
        previewFormat: "slide_images",
        generator: "powerpoint_com_png_v1",
        storedIn: BUCKET,
        originalsUnchanged: true,
      },
      safeDemo: {
        resourceId: SAFE_DEMO_ID,
        title: demo.resource.title,
        filename: demo.resource.filename,
        audience: "LEARNER_VISIBLE",
        originalSha256: demo.binary.sha256,
        previewId: demoStored.row.id,
        slideCount: demoStored.row.slide_count,
        status: demoStored.row.status,
        generatedFromBinaryHash: demoStored.row.generated_from_binary_hash,
      },
      genuineHybrid: {
        resourceId: HYBRID_ID,
        title: hybrid.resource.title,
        filename: hybrid.resource.filename,
        audience: "TUTOR_ONLY",
        originalSha256: hybrid.binary.sha256,
        previewId: hybridStored.row.id,
        slideCount: hybridStored.row.slide_count,
        apprenticeExpected: 403,
      },
      genuineW003LearnerResourceGapStillOpen: true,
      security: {
        publicStorage: { url: publicUrl, status: publicRes.status },
        anonymousObject: { url: anonObjectUrl, status: anonRes.status },
        unauthenticatedPreviewApi: unauthPreview,
      },
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
        previewsForVersion: previews,
      },
    },
    null,
    2,
  ),
);
