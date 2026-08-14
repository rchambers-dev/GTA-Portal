/**
 * Create ONE SAFE TEST tutor + attach one W011 learner-visible proof resource.
 *
 * Does NOT: modify the 26 real staff, start Block 3, create S4 unlocks,
 * change W011 learner copy, move lesson plans, or populate Tasks.
 *
 *   ALLOW_SAFE_TEST_TUTOR=1 node --env-file=.env.local scripts/seed-autocare-safe-test-tutor.mjs --confirm
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const CONTROL_TAG = "autocare-st0499-v1.3-phase1-controlled";
const PROGRAMME_VERSION_ID =
  process.env.AUTOCARE_PHASE1_VERSION_ID?.trim() ||
  "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";

const TUTOR_EMAIL = "test-autocare-tutor@example.invalid";
const TUTOR_NAME = "TEST Autocare Tutor (SAFE DEMO)";
const TUTOR_PERMS = [
  "messages.view",
  "ai.use",
  "staff.workspace.view",
  "apprentices.assigned.view",
  "apprentice.workspace.view",
  "modules.deliver",
  "lifecycle.kanban.view",
];

const RESOURCE_KEY = "test_learner_resource_w011_visibility";
const RESOURCE_TITLE =
  "TEST learner resource — W011 visibility proof — SAFE DEMO";
const RESOURCE_FILENAME = "TEST_W011_learner_visibility_proof.txt";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (process.env.ALLOW_SAFE_TEST_TUTOR !== "1") {
  die("Requires ALLOW_SAFE_TEST_TUTOR=1");
}
if (!process.argv.includes("--confirm")) die("Requires --confirm");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing Supabase env");
const sb = createClient(url, key, { auth: { persistSession: false } });

function generatePassword() {
  return `TestTutor-${crypto.randomBytes(6).toString("base64url")}!A1`;
}

async function main() {
  const { count: profilesBefore } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true });
  const { data: staffBefore } = await sb
    .from("profiles")
    .select("id, email")
    .like("email", "%@doncastergta.co.uk");
  const realStaffBefore = (staffBefore || []).length;
  if (realStaffBefore !== 26) {
    die(`Refusing: real staff emails=${realStaffBefore}, expected 26`);
  }

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

  const { count: sessions } = await sb
    .from("gta_programme_sessions")
    .select("*", { count: "exact", head: true })
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if (sessions !== 113) die(`Expected 113 sessions, found ${sessions}`);
  const { count: tasks } = await sb
    .from("gta_course_tasks")
    .select("*", { count: "exact", head: true })
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if (tasks !== 50) die(`Expected 50 tasks, found ${tasks}`);
  const { count: maps } = await sb
    .from("gta_block_ksb_mappings")
    .select("*", { count: "exact", head: true })
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if ((maps ?? 0) !== 0) die(`Expected 0 Primaries, found ${maps}`);

  const { data: existingProfile } = await sb
    .from("profiles")
    .select("id, email")
    .eq("email", TUTOR_EMAIL)
    .maybeSingle();

  let userId = existingProfile?.id || null;
  let password = process.env.SAFE_TEST_TUTOR_PASSWORD?.trim() || "";
  let createdAuth = false;

  if (!userId) {
    password = password || generatePassword();
    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email: TUTOR_EMAIL,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: TUTOR_NAME,
        username: "testtutor",
        isTest: true,
      },
    });
    if (authErr || !authData.user) {
      die(`Auth create failed: ${authErr?.message || "unknown"}`);
    }
    userId = authData.user.id;
    createdAuth = true;
  } else if (password) {
    const { error: pwErr } = await sb.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (pwErr) die(`Password update failed: ${pwErr.message}`);
  }

  const { error: profileErr } = await sb.from("profiles").upsert(
    {
      id: userId,
      email: TUTOR_EMAIL,
      username: "testtutor",
      display_name: TUTOR_NAME,
      base_role: "Tutor",
      workspace: "staff",
      permissions: TUTOR_PERMS,
      responsibilities: ["SAFE TEST Autocare Tutor — not a real staff member"],
      department: "TEST / SAFE DEMO",
      portal_status: "active",
      enabled_by: "SAFE TEST seed",
      enabled_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (profileErr) {
    if (createdAuth) await sb.auth.admin.deleteUser(userId);
    die(`Profile upsert failed: ${profileErr.message}`);
  }

  const { data: w011, error: sErr } = await sb
    .from("gta_programme_sessions")
    .select("id, session_key, spine_item_id, learner_facing_content, publish_status")
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .eq("session_key", "W011")
    .maybeSingle();
  if (sErr) die(sErr.message);
  if (!w011) die("W011 session missing");
  if (w011.learner_facing_content?.status !== "approved_published") {
    die("Refusing: W011 learner copy is not approved_published");
  }

  const extractPath =
    "tests/artifacts/autocare-v1/evidence-enriched/staging/extracts/test_w011_learner_visibility_proof.txt";
  const absExtract = path.resolve(extractPath);
  if (!fs.existsSync(absExtract)) die(`Missing extract ${extractPath}`);

  const { error: resErr } = await sb.from("gta_programme_resources").upsert(
    {
      programme_version_id: PROGRAMME_VERSION_ID,
      resource_key: RESOURCE_KEY,
      title: RESOURCE_TITLE,
      filename: RESOURCE_FILENAME,
      source_path: "TEST FIXTURE — not a real teaching asset",
      evidence_resource_id: "",
      extract_path: extractPath,
      metadata: {
        isTest: true,
        phase: "2C-tutor-visibility",
        purpose: "w011-learner-visible-access-proof",
        cleanup:
          "Delete this resource + its W011 LEARNER_VISIBLE attachment only. Do not touch learner_facing_content, v4.4 LP, Tasks, or Sessions.",
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
      session_id: w011.id,
      spine_item_id: w011.spine_item_id,
      role: "LEARNER_LEARNING",
      audience: "LEARNER_VISIBLE",
      sort_order: 20,
      metadata: {
        isTest: true,
        mapping: "W011 learner-visible visibility proof",
      },
    });
  if (attErr) die(`attach: ${attErr.message}`);

  const { data: afterW011 } = await sb
    .from("gta_programme_sessions")
    .select("learner_facing_content, publish_status")
    .eq("id", w011.id)
    .single();
  if (afterW011.learner_facing_content?.status !== "approved_published") {
    die("W011 learner copy drifted");
  }
  if (afterW011.publish_status !== "published") {
    die("W011 authoring status drifted");
  }

  const { count: profilesAfter } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true });
  const { data: staffAfter } = await sb
    .from("profiles")
    .select("id")
    .like("email", "%@doncastergta.co.uk");
  if ((staffAfter || []).length !== 26) {
    die("Real staff count changed");
  }
  if (profilesAfter !== 28) {
    die(`Expected 28 profiles, found ${profilesAfter} (before ${profilesBefore})`);
  }

  const { count: unlocks } = await sb
    .from("gta_enrolment_block_unlocks")
    .select("*", { count: "exact", head: true });
  if ((unlocks ?? 0) !== 0) die(`Unlocks appeared: ${unlocks}`);

  const creds = {
    email: TUTOR_EMAIL,
    displayName: TUTOR_NAME,
    passwordSet: Boolean(password),
    password: password || "(unchanged — set SAFE_TEST_TUTOR_PASSWORD to rotate)",
    workspace: "staff",
    baseRole: "Tutor",
    permissions: TUTOR_PERMS,
    note: "SAFE TEST only. Not a real staff login.",
  };
  fs.mkdirSync(".tmp", { recursive: true });
  fs.writeFileSync(
    ".tmp/safe-test-tutor-credentials.json",
    JSON.stringify(creds, null, 2),
  );

  const report = {
    ok: true,
    profilesBefore,
    profilesAfter,
    realStaffUnchanged: 26,
    tutor: {
      id: userId,
      email: TUTOR_EMAIL,
      displayName: TUTOR_NAME,
      workspace: "staff",
      baseRole: "Tutor",
      permissions: TUTOR_PERMS,
      createdAuth,
    },
    resource: {
      key: RESOURCE_KEY,
      title: RESOURCE_TITLE,
      sessionKey: "W011",
      role: "LEARNER_LEARNING",
      audience: "LEARNER_VISIBLE",
      cleanup:
        "Delete gta_programme_resource_attachments for this resource_id, then the gta_programme_resources row. Leave W011 learner_facing_content and v4.4 LP attachment untouched.",
    },
    sessionsStill: 113,
    tasksStill: 50,
    primariesStill: 0,
    unlocks: 0,
  };
  fs.writeFileSync(
    ".tmp/autocare-safe-test-tutor-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ ...report, credentialsFile: ".tmp/safe-test-tutor-credentials.json" }, null, 2));
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));
