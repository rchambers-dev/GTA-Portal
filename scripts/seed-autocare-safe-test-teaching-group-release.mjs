/**
 * SAFE TEST teaching-group fixture + W001/W002 learning-release migration.
 *
 * Creates/reuses:
 *   TEST Autocare Intake (SAFE DEMO)
 *   TEST Autocare Teaching Group (SAFE DEMO)
 *   SAFE TEST tutor ownership
 *   SAFE TEST apprentice placement
 *
 * Migrates existing gta_session_delivery_records for W001/W002 into
 * gta_session_learning_releases (source=migrated_from_delivery).
 * Does NOT delete delivery rows. Does NOT release W003.
 *
 * Does NOT: modify 26 real staff, real teaching-group assignments,
 * Block 3, Tasks, OTJ, Primaries, Other Portal, or attendance.
 *
 *   ALLOW_SAFE_TEST_RELEASE=1 node --env-file=.env.local scripts/seed-autocare-safe-test-teaching-group-release.mjs --confirm
 */
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const CONTROL_TAG = "autocare-st0499-v1.3-phase1-controlled";
const PROGRAMME_VERSION_ID =
  process.env.AUTOCARE_PHASE1_VERSION_ID?.trim() ||
  "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";
const TEST_REF = "TEST-GTA-2026-B1DELIVERY";
const TUTOR_EMAIL = "test-autocare-tutor@example.invalid";
const TUTOR_NAME = "TEST Autocare Tutor (SAFE DEMO)";
const COHORT_NAME = "TEST Autocare Intake (SAFE DEMO)";
const GROUP_NAME = "TEST Autocare Teaching Group (SAFE DEMO)";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (process.env.ALLOW_SAFE_TEST_RELEASE !== "1") {
  die("Requires ALLOW_SAFE_TEST_RELEASE=1");
}
if (!process.argv.includes("--confirm")) die("Requires --confirm");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing Supabase env");
const sb = createClient(url, key, { auth: { persistSession: false } });

async function count(table, filter) {
  let q = sb.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return n ?? 0;
}

async function main() {
  const { data: staff } = await sb
    .from("profiles")
    .select("id, email")
    .like("email", "%@doncastergta.co.uk");
  const realStaff = (staff || []).length;
  if (realStaff !== 26) die(`Refusing: real staff emails=${realStaff}, expected 26`);

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

  const sessions = await count("gta_programme_sessions", (q) =>
    q.eq("programme_version_id", PROGRAMME_VERSION_ID),
  );
  if (sessions !== 113) die(`Expected 113 sessions, found ${sessions}`);
  const tasks = await count("gta_course_tasks", (q) =>
    q.eq("programme_version_id", PROGRAMME_VERSION_ID),
  );
  if (tasks !== 50) die(`Expected 50 tasks, found ${tasks}`);
  const primaries = await count("gta_spine_item_ksbs", (q) =>
    q.eq("programme_version_id", PROGRAMME_VERSION_ID).eq("is_primary", true),
  );
  if (primaries !== 0) die(`Expected 0 Primaries, found ${primaries}`);

  const { data: apprentice } = await sb
    .from("apprentices")
    .select("id, display_name, apprentice_reference")
    .eq("apprentice_reference", TEST_REF)
    .maybeSingle();
  if (!apprentice) die("SAFE TEST apprentice missing");

  const { data: enrolment } = await sb
    .from("apprentice_programmes")
    .select(
      "id, apprentice_id, teaching_group_id, tutor_name, gta_programme_version_id, programme_week, status",
    )
    .eq("apprentice_id", apprentice.id)
    .eq("gta_programme_version_id", PROGRAMME_VERSION_ID)
    .maybeSingle();
  if (!enrolment) die("SAFE TEST enrolment missing");

  const { data: tutor } = await sb
    .from("profiles")
    .select("id, email, display_name")
    .eq("email", TUTOR_EMAIL)
    .maybeSingle();
  if (!tutor) die("SAFE TEST tutor missing");

  const { data: existingGroups } = await sb
    .from("cohort_teaching_groups")
    .select("id, name, tutor_name, notes, cohort_id")
    .eq("id", enrolment.teaching_group_id || "00000000-0000-0000-0000-000000000000")
    .maybeSingle();

  if (enrolment.teaching_group_id && existingGroups) {
    const isSafe =
      /SAFE DEMO|SAFE TEST/i.test(existingGroups.name) ||
      /SAFE DEMO|SAFE TEST/i.test(existingGroups.notes || "");
    if (!isSafe) {
      die(
        `Refusing: SAFE TEST enrolment is already in teaching group "${existingGroups.name}" which is not a SAFE TEST fixture. Will not move real assignments.`,
      );
    }
  }

  let cohortId = null;
  const { data: existingCohort } = await sb
    .from("cohorts")
    .select("id, name")
    .eq("name", COHORT_NAME)
    .maybeSingle();
  if (existingCohort) {
    cohortId = existingCohort.id;
  } else {
    const { data: created, error } = await sb
      .from("cohorts")
      .insert({
        name: COHORT_NAME,
        programme_name: "Autocare Technician Level 2 [TEST]",
        standard_code: "ST0499",
        standard_version: "1.3",
        delivery_spine: "blocks",
        start_date: new Date().toISOString().slice(0, 10),
        tutor_name: TUTOR_NAME,
        teaching_group: GROUP_NAME,
        college_days: "TEST",
        status: "planned",
        locked: true,
        notes:
          "SAFE TEST intake fixture for teaching-group learning release. Not a live cohort.",
      })
      .select("id")
      .single();
    if (error) die(`Cohort create failed: ${error.message}`);
    cohortId = created.id;
  }

  let groupId = existingGroups?.id || null;
  if (!groupId) {
    const { data: named } = await sb
      .from("cohort_teaching_groups")
      .select("id, name, tutor_name, notes")
      .eq("name", GROUP_NAME)
      .maybeSingle();
    groupId = named?.id || null;
  }
  if (!groupId) {
    const { data: created, error } = await sb
      .from("cohort_teaching_groups")
      .insert({
        cohort_id: cohortId,
        tutor_name: TUTOR_NAME,
        name: GROUP_NAME,
        college_days: "TEST",
        capacity: 9,
        notes: `SAFE TEST teaching-group fixture. tutorProfileId=${tutor.id} tutorEmail=${TUTOR_EMAIL}`,
      })
      .select("id")
      .single();
    if (error) die(`Teaching group create failed: ${error.message}`);
    groupId = created.id;
  } else {
    await sb
      .from("cohort_teaching_groups")
      .update({
        tutor_name: TUTOR_NAME,
        notes: `SAFE TEST teaching-group fixture. tutorProfileId=${tutor.id} tutorEmail=${TUTOR_EMAIL}`,
      })
      .eq("id", groupId);
  }

  if (enrolment.teaching_group_id !== groupId) {
    const { error } = await sb
      .from("apprentice_programmes")
      .update({
        teaching_group_id: groupId,
        tutor_name: TUTOR_NAME,
        college_days: "TEST",
        cohort_id: cohortId,
      })
      .eq("id", enrolment.id)
      .eq("apprentice_id", apprentice.id);
    if (error) die(`Enrolment placement failed: ${error.message}`);
  }

  const { data: deliveries, error: dErr } = await sb
    .from("gta_session_delivery_records")
    .select(
      "id, session_id, apprentice_id, apprentice_programme_id, spine_item_id, delivered_at, signed_off_by, signed_off_by_name, note",
    )
    .eq("apprentice_programme_id", enrolment.id)
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if (dErr) die(dErr.message);

  const sessionIds = [...new Set((deliveries || []).map((d) => d.session_id))];
  const { data: sessionRows } = sessionIds.length
    ? await sb
        .from("gta_programme_sessions")
        .select("id, session_key")
        .in("id", sessionIds)
    : { data: [] };
  const keyById = new Map((sessionRows || []).map((s) => [s.id, s.session_key]));

  const migrated = [];
  for (const row of deliveries || []) {
    const sessionKey = keyById.get(row.session_id) || "";
    const { data: existingRelease } = await sb
      .from("gta_session_learning_releases")
      .select("id")
      .eq("session_id", row.session_id)
      .eq("apprentice_programme_id", enrolment.id)
      .maybeSingle();
    if (existingRelease) {
      migrated.push({ sessionKey, releaseId: existingRelease.id, skipped: true });
      continue;
    }
    const { data: created, error } = await sb
      .from("gta_session_learning_releases")
      .insert({
        programme_version_id: PROGRAMME_VERSION_ID,
        session_id: row.session_id,
        apprentice_id: row.apprentice_id,
        apprentice_programme_id: row.apprentice_programme_id,
        spine_item_id: row.spine_item_id,
        teaching_group_id: groupId,
        source: "migrated_from_delivery",
        released_at: row.delivered_at,
        released_by: row.signed_off_by,
        released_by_name: row.signed_off_by_name || TUTOR_NAME,
        note: row.note || "Migrated from SAFE TEST SessionDeliveryRecord.",
        metadata: {
          meaning:
            "Approved learner-facing Session learning is available to this enrolment. Not attendance, completion, Task pass, competence, or OTJ.",
          migratedFromDeliveryId: row.id,
          sessionKey,
        },
      })
      .select("id")
      .single();
    if (error) die(`Release migrate failed (${sessionKey}): ${error.message}`);
    migrated.push({ sessionKey, releaseId: created.id, skipped: false });
  }

  const { data: w003 } = await sb
    .from("gta_programme_sessions")
    .select("id, session_key, title")
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .eq("session_key", "W003")
    .maybeSingle();
  const { data: w003Release } = w003
    ? await sb
        .from("gta_session_learning_releases")
        .select("id")
        .eq("session_id", w003.id)
        .eq("apprentice_programme_id", enrolment.id)
        .maybeSingle()
    : { data: null };

  const after = {
    realStaff,
    profiles: await count("profiles"),
    sessions,
    tasks,
    primaries,
    deliveryRecords: await count("gta_session_delivery_records", (q) =>
      q.eq("programme_version_id", PROGRAMME_VERSION_ID),
    ),
    learningReleases: await count("gta_session_learning_releases", (q) =>
      q.eq("programme_version_id", PROGRAMME_VERSION_ID),
    ),
    unlocks: await count("gta_enrolment_block_unlocks"),
  };

  const report = {
    teachingGroup: {
      id: groupId,
      name: GROUP_NAME,
      tutorName: TUTOR_NAME,
      tutorEmail: TUTOR_EMAIL,
    },
    cohort: { id: cohortId, name: COHORT_NAME },
    apprentice: {
      id: apprentice.id,
      reference: TEST_REF,
      enrolmentId: enrolment.id,
    },
    migrated,
    deliveryRecordsKept: (deliveries || []).length,
    w003: {
      sessionId: w003?.id || null,
      title: w003?.title || null,
      released: Boolean(w003Release),
    },
    after,
    notes: [
      "W003 was not released by this script — tutor group release walkthrough starts Not released.",
      "Existing W001/W002 SessionDeliveryRecords were kept.",
      "No attendance/register work. No Task release. Block 3 not started.",
    ],
  };

  fs.mkdirSync(".tmp", { recursive: true });
  fs.writeFileSync(
    ".tmp/autocare-safe-test-teaching-group-release.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));
