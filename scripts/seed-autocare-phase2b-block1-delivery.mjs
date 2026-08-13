/**
 * Phase 2B — create SAFE TEST apprentice + enrolment for Block 1 Session delivery pilot.
 *
 * Guards:
 *   ALLOW_HOSTED_PB_AUTHORING_RESET=1
 *   --confirm
 *
 * Does NOT: modify staff profiles, Primaries, OTJ, Sessions count (except publish_status on B1),
 * Other Portal data, or create anything resembling a real apprentice.
 *
 * Usage:
 *   ALLOW_HOSTED_PB_AUTHORING_RESET=1 node --env-file=.env.local scripts/seed-autocare-phase2b-block1-delivery.mjs --confirm
 */
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const CONTROL_TAG = "autocare-st0499-v1.3-phase1-controlled";
const PROGRAMME_VERSION_ID =
  process.env.AUTOCARE_PHASE1_VERSION_ID?.trim() ||
  "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";
const TEST_REF = "TEST-GTA-2026-B1DELIVERY";
const TEST_NAME = "TEST Block1 Session Delivery (SAFE DEMO)";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (process.env.ALLOW_HOSTED_PB_AUTHORING_RESET !== "1") {
  die("Requires ALLOW_HOSTED_PB_AUTHORING_RESET=1");
}
if (!process.argv.includes("--confirm")) die("Requires --confirm");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing Supabase env");
const sb = createClient(url, key, { auth: { persistSession: false } });

async function count(table) {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const before = {
    profiles: await count("profiles"),
    apprentices: await count("apprentices"),
    enrolments: await count("apprentice_programmes"),
    sessions: await count("gta_programme_sessions"),
    tasks: await count("gta_course_tasks"),
    deliveryRecords: await count("gta_session_delivery_records").catch(() => 0),
  };

  if (before.profiles !== 26) {
    console.warn(`WARNING: profiles=${before.profiles} (expected 26)`);
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

  // Mark Block 1 sessions Ready for delivery (authoring publish)
  const { data: b1Sessions, error: sErr } = await sb
    .from("gta_programme_sessions")
    .select("id, session_key, spine_item_id, calendar_week")
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .gte("calendar_week", 1)
    .lte("calendar_week", 10)
    .order("sequence");
  if (sErr) die(sErr.message);
  if ((b1Sessions || []).length !== 10) {
    die(`Expected 10 Block 1 sessions, got ${(b1Sessions || []).length}`);
  }
  const { error: pubErr } = await sb
    .from("gta_programme_sessions")
    .update({ publish_status: "published" })
    .in(
      "id",
      b1Sessions.map((s) => s.id),
    );
  if (pubErr) die(pubErr.message);

  // Upsert TEST apprentice
  const { data: existingAp } = await sb
    .from("apprentices")
    .select("id")
    .eq("apprentice_reference", TEST_REF)
    .maybeSingle();

  let apprenticeId = existingAp?.id;
  if (!apprenticeId) {
    const { data: created, error } = await sb
      .from("apprentices")
      .insert({
        display_name: TEST_NAME,
        apprentice_reference: TEST_REF,
        email: "test-block1-delivery@example.invalid",
        phone: "",
        date_of_birth: null,
        uln: "",
        address_line1: "TEST ONLY — NOT A REAL APPRENTICE",
        address_line2: "",
        town: "TEST",
        postcode: "TE1 1ST",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        emergency_contact_relationship: "",
        support_notes:
          "SAFE DEMO / TEST record for Autocare Phase 2B Block 1 Session delivery pilot. Do not treat as a real apprentice.",
        intake_status: "ready",
        pack: {
          isTest: true,
          phase: "2B",
          purpose: "session-delivery-pilot",
        },
        notes:
          "TEST-GTA SAFE DEMO — Autocare Block 1 SessionDeliveryRecord pilot only.",
      })
      .select("id")
      .single();
    if (error) die(error.message);
    apprenticeId = created.id;
  }

  // Enrolment pin
  const { data: existingEnr } = await sb
    .from("apprentice_programmes")
    .select("id")
    .eq("apprentice_id", apprenticeId)
    .eq("gta_programme_version_id", PROGRAMME_VERSION_ID)
    .maybeSingle();

  let enrolmentId = existingEnr?.id;
  if (!enrolmentId) {
    const { data: enr, error } = await sb
      .from("apprentice_programmes")
      .insert({
        kind: "new_starter",
        status: "active",
        apprentice_id: apprenticeId,
        programme_name: "Autocare Technician Level 2 [TEST]",
        standard_code: "ST0499",
        gta_programme_version_id: PROGRAMME_VERSION_ID,
        cohort_id: null,
        teaching_group_id: null,
        employer_id: "",
        employer_name: "TEST EMPLOYER (SAFE DEMO)",
        workplace_contact: "",
        mentor_name: "",
        tutor_name: "TEST TUTOR",
        start_date: new Date().toISOString().slice(0, 10),
        original_planned_end_date: "2028-08-01",
        programme_year: 1,
        programme_week: 3,
        attendance_percent: null,
        actual_progress_percent: null,
        college_days: "TEST",
        notes:
          "SAFE TEST enrolment for Phase 2B Block 1 Session delivery. programme_week=3 so W001–W003 are available.",
      })
      .select("id")
      .single();
    if (error) die(error.message);
    enrolmentId = enr.id;
  } else {
    await sb
      .from("apprentice_programmes")
      .update({
        programme_week: 3,
        status: "active",
        gta_programme_version_id: PROGRAMME_VERSION_ID,
      })
      .eq("id", enrolmentId);
  }

  // Safe learner-visible fixture on W001 only (visibility proof)
  const w001 = b1Sessions.find((s) => s.session_key === "W001");
  const spineId = w001.spine_item_id;
  const fixtureKey = "test_learner_fixture_w001_handout";
  await sb.from("gta_programme_resources").upsert(
    {
      programme_version_id: PROGRAMME_VERSION_ID,
      resource_key: fixtureKey,
      title: "TEST learner handout fixture (W001) — SAFE DEMO",
      filename: "TEST_W001_learner_handout_fixture.txt",
      source_path: "TEST FIXTURE — not a real teaching asset",
      evidence_resource_id: "",
      extract_path: "",
      metadata: {
        isTest: true,
        phase: "2B",
        purpose: "learner-visibility-filter-proof",
      },
    },
    { onConflict: "programme_version_id,resource_key" },
  );
  const { data: fixtureRes } = await sb
    .from("gta_programme_resources")
    .select("id")
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .eq("resource_key", fixtureKey)
    .single();

  // Remove prior fixture attachment then insert
  await sb
    .from("gta_programme_resource_attachments")
    .delete()
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .eq("resource_id", fixtureRes.id);

  await sb.from("gta_programme_resource_attachments").insert({
    programme_version_id: PROGRAMME_VERSION_ID,
    resource_id: fixtureRes.id,
    session_id: w001.id,
    spine_item_id: spineId,
    role: "LEARNER_LEARNING",
    audience: "LEARNER_VISIBLE",
    sort_order: 50,
    metadata: { isTest: true, phase: "2B" },
  });

  const after = {
    profiles: await count("profiles"),
    apprentices: await count("apprentices"),
    enrolments: await count("apprentice_programmes"),
    sessions: await count("gta_programme_sessions"),
    tasks: await count("gta_course_tasks"),
    deliveryRecords: await count("gta_session_delivery_records"),
  };

  const { count: primaries } = await sb
    .from("gta_block_ksb_mappings")
    .select("*", { count: "exact", head: true })
    .eq("programme_version_id", PROGRAMME_VERSION_ID);

  const report = {
    before,
    after,
    testApprenticeId: apprenticeId,
    testEnrolmentId: enrolmentId,
    testReference: TEST_REF,
    programmeVersionId: PROGRAMME_VERSION_ID,
    programmeWeek: 3,
    block1SessionsReadyForDelivery: 10,
    learnerVisibilityFixture: fixtureKey,
    primaries: primaries ?? 0,
    otj: 611.5,
    approach:
      "Created clearly marked TEST apprentice + enrolment in DB (apprentices was 0). No staff profiles modified. No real learners used.",
  };

  fs.mkdirSync(".tmp", { recursive: true });
  fs.writeFileSync(
    ".tmp/autocare-phase2b-seed-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
