/**
 * Phase 2C-style — Block 2 learner publication after curriculum-owner review.
 *
 * Applies ONLY the reviewed wording/scope corrections, then sets W011–W020
 * learner_facing_content to approved_published and authoring publish_status
 * to published ("Ready for delivery").
 *
 * Does NOT: attach learner files, place PowerPoints, create Task→Session
 * links, alter Block 1, start Block 3, create S4 unlocks, or change staff /
 * SAFE TEST / delivery records.
 *
 *   ALLOW_PHASE2C_BLOCK2_APPROVE=1 node --env-file=.env.local scripts/seed-autocare-phase2c-block2-approve.mjs --confirm
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const CONTROL_TAG = "autocare-st0499-v1.3-phase1-controlled";
const PROGRAMME_VERSION_ID =
  process.env.AUTOCARE_PHASE1_VERSION_ID?.trim() ||
  "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";

const APPROVED = JSON.parse(
  fs.readFileSync(
    path.resolve(
      "src/features/programme-definition/data/block2-approved-learner-copy.json",
    ),
    "utf8",
  ),
);

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (process.env.ALLOW_PHASE2C_BLOCK2_APPROVE !== "1") {
  die("Requires ALLOW_PHASE2C_BLOCK2_APPROVE=1");
}
if (!process.argv.includes("--confirm")) {
  die("Requires --confirm");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing Supabase env");

const sb = createClient(url, key, { auth: { persistSession: false } });

async function countEq(table, column, value) {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) die(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const { count: profilesBefore } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true });
  const { count: apprenticesBefore } = await sb
    .from("apprentices")
    .select("*", { count: "exact", head: true });
  const { count: deliveriesBefore } = await sb
    .from("gta_session_delivery_records")
    .select("*", { count: "exact", head: true });
  const { count: unlocksBefore } = await sb
    .from("gta_enrolment_block_unlocks")
    .select("*", { count: "exact", head: true });

  const { data: version, error: vErr } = await sb
    .from("gta_programme_versions")
    .select("id, parameters")
    .eq("id", PROGRAMME_VERSION_ID)
    .maybeSingle();
  if (vErr) die(vErr.message);
  if (!version) die(`Programme version ${PROGRAMME_VERSION_ID} not found`);
  const params = version.parameters || {};
  if (params.controlTag !== CONTROL_TAG) {
    die(`Refusing: controlTag is ${params.controlTag}`);
  }
  if (Number(params.expectedOtjHours) !== 611.5) {
    die(`Refusing: expectedOtjHours=${params.expectedOtjHours}`);
  }

  const { count: sessionCount } = await sb
    .from("gta_programme_sessions")
    .select("*", { count: "exact", head: true })
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if (sessionCount !== 113) {
    die(`Expected 113 sessions, found ${sessionCount}`);
  }

  const taskCount = await countEq(
    "gta_course_tasks",
    "programme_version_id",
    PROGRAMME_VERSION_ID,
  );
  if (taskCount !== 50) die(`Expected 50 tasks, found ${taskCount}`);

  const mappingCount = await countEq(
    "gta_block_ksb_mappings",
    "programme_version_id",
    PROGRAMME_VERSION_ID,
  );
  if (mappingCount !== 0) die(`Expected 0 Primaries, found ${mappingCount}`);

  const { data: sessions, error: sErr } = await sb
    .from("gta_programme_sessions")
    .select(
      "id, session_key, calendar_week, title, topic, publish_status, learner_facing_content, spine_item_id",
    )
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .gte("calendar_week", 1)
    .lte("calendar_week", 20)
    .order("calendar_week");
  if (sErr) die(sErr.message);

  const block1 = (sessions || []).filter((s) => s.calendar_week <= 10);
  const block2 = (sessions || []).filter((s) => s.calendar_week >= 11);
  if (block1.length !== 10) die(`Expected 10 Block 1 sessions, found ${block1.length}`);
  if (block2.length !== 10) die(`Expected 10 Block 2 sessions, found ${block2.length}`);

  const b1Approved = block1.filter(
    (s) => s.learner_facing_content?.status === "approved_published",
  );
  const b1Keys = b1Approved.map((s) => s.session_key).sort().join(",");
  if (b1Keys !== "W001,W002,W003") {
    die(`Refusing: Block 1 approved keys=${b1Keys || "(none)"}`);
  }

  const approvedAt = new Date().toISOString();
  const approvedByName = "Curriculum owner";
  const edits = [];

  for (const session of block2) {
    const copy = APPROVED[session.session_key];
    if (!copy) die(`Missing approved copy for ${session.session_key}`);
    const current = session.learner_facing_content || {};
    const candidate = current.candidate || {
      summary: copy.summary,
      learningContent: copy.learningContent,
      activityPractice: copy.activityPractice,
      sourceLabel: copy.sourceLabel,
    };

    const payload = {
      status: "approved_published",
      candidate,
      approved: {
        summary: copy.summary,
        learningContent: copy.learningContent,
        activityPractice: copy.activityPractice,
        sourceLabel: copy.sourceLabel,
        approvedAt,
        approvedByName,
      },
    };

    const { error: uErr } = await sb
      .from("gta_programme_sessions")
      .update({
        learner_facing_content: payload,
        publish_status: "published",
      })
      .eq("id", session.id)
      .eq("programme_version_id", PROGRAMME_VERSION_ID);
    if (uErr) die(`${session.session_key}: ${uErr.message}`);

    edits.push({
      sessionKey: session.session_key,
      controlledTitle: session.title,
      summary: copy.summary,
      learnerStatus: "approved_published",
      authoringStatus: "published",
      authoringLabel: "Ready for delivery",
    });
  }

  const { data: after, error: aErr } = await sb
    .from("gta_programme_sessions")
    .select(
      "session_key, calendar_week, title, topic, publish_status, learner_facing_content",
    )
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .gte("calendar_week", 1)
    .lte("calendar_week", 30)
    .order("calendar_week");
  if (aErr) die(aErr.message);

  const afterB1 = (after || []).filter((s) => s.calendar_week <= 10);
  const afterB2 = (after || []).filter(
    (s) => s.calendar_week >= 11 && s.calendar_week <= 20,
  );
  const afterB3 = (after || []).filter((s) => s.calendar_week >= 21);
  const b1Still = afterB1
    .filter((s) => s.learner_facing_content?.status === "approved_published")
    .map((s) => s.session_key)
    .sort()
    .join(",");
  if (b1Still !== "W001,W002,W003") {
    die(`Block 1 approved drifted to ${b1Still}`);
  }
  const b2Approved = afterB2.filter(
    (s) => s.learner_facing_content?.status === "approved_published",
  );
  const b2Ready = afterB2.filter((s) => s.publish_status === "published");
  if (b2Approved.length !== 10) {
    die(`Expected 10 Block 2 approved_published, found ${b2Approved.length}`);
  }
  if (b2Ready.length !== 10) {
    die(`Expected 10 Block 2 Ready for delivery, found ${b2Ready.length}`);
  }
  if (afterB3.some((s) => s.learner_facing_content?.status === "approved_published")) {
    die("Refusing: Block 3 learner content was published");
  }

  const leakChecks = [];
  for (const s of afterB2) {
    const approved = s.learner_facing_content?.approved || {};
    const blob = JSON.stringify({
      summary: approved.summary,
      learningContent: approved.learningContent,
      activityPractice: approved.activityPractice,
    });
    leakChecks.push({
      sessionKey: s.session_key,
      hasUnderPressure: /under pressure/i.test(blob),
      hasCandidateEnum: /candidate_for_review/.test(blob),
      hasIndependentRepair: /independent (engine |ABS )?repair/i.test(
        approved.activityPractice || "",
      ),
      notTask2: s.session_key !== "W016" || /not the Block 2 Employer Job Card \(Task 2\)/.test(approved.activityPractice || ""),
      notTask3: s.session_key !== "W012" || /not Task 3/.test(approved.activityPractice || ""),
      notTask4: s.session_key !== "W014" || /does not complete Task 4/.test(approved.activityPractice || ""),
      notTask5: s.session_key !== "W020" || /Block Reflection \(Task 5\)/.test(approved.activityPractice || ""),
      lirSeparate: s.session_key !== "W020" || /Learning Impact Record are separate forms/.test(approved.activityPractice || ""),
      noUnlock: s.session_key !== "W020" || /does not unlock the next Block/.test(approved.activityPractice || ""),
    });
  }
  if (leakChecks.some((c) => c.hasUnderPressure)) {
    die("W011 still contains 'under pressure'");
  }
  if (leakChecks.some((c) => !c.notTask2 || !c.notTask3 || !c.notTask4 || !c.notTask5 || !c.lirSeparate || !c.noUnlock)) {
    die("Block 2 Task/Session distinction wording missing");
  }

  const { data: attachments, error: attErr } = await sb
    .from("gta_programme_resource_attachments")
    .select("id, session_id, audience, role, resource_id, spine_item_id")
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .eq("spine_item_id", block2[0].spine_item_id);
  if (attErr) die(attErr.message);

  const learnerVisible = (attachments || []).filter(
    (a) => a.audience === "LEARNER_VISIBLE",
  );
  const tutorOnly = (attachments || []).filter((a) => a.audience === "TUTOR_ONLY");
  const sessionPlaced = (attachments || []).filter((a) => a.session_id);

  const { count: linkCount } = await sb
    .from("gta_course_task_session_links")
    .select("*", { count: "exact", head: true })
    .eq("programme_version_id", PROGRAMME_VERSION_ID);

  const { count: profilesAfter } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true });
  const { count: apprenticesAfter } = await sb
    .from("apprentices")
    .select("*", { count: "exact", head: true });
  const { count: deliveriesAfter } = await sb
    .from("gta_session_delivery_records")
    .select("*", { count: "exact", head: true });
  const { count: unlocksAfter } = await sb
    .from("gta_enrolment_block_unlocks")
    .select("*", { count: "exact", head: true });

  if (profilesAfter !== profilesBefore) {
    die(`profiles changed ${profilesBefore} → ${profilesAfter}`);
  }
  if (apprenticesAfter !== apprenticesBefore) {
    die(`apprentices changed ${apprenticesBefore} → ${apprenticesAfter}`);
  }
  if (deliveriesAfter !== deliveriesBefore) {
    die(`deliveries changed ${deliveriesBefore} → ${deliveriesAfter}`);
  }
  if (unlocksAfter !== unlocksBefore) {
    die(`unlocks changed ${unlocksBefore} → ${unlocksAfter}`);
  }

  const report = {
    ok: true,
    programmeVersionId: PROGRAMME_VERSION_ID,
    learnerStatus: "approved_published",
    authoringStatus: "published",
    authoringLabel: "Ready for delivery",
    sessions: edits,
    learnerVisibleAttachmentsBlock2: learnerVisible.length,
    tutorOnlyAttachmentsBlock2: tutorOnly.length,
    sessionPlacedAttachmentsBlock2: sessionPlaced.length,
    taskSessionLinks: linkCount,
    block1ApprovedStill: ["W001", "W002", "W003"],
    block3Approved: 0,
    sessionsStill: 113,
    tasksStill: taskCount,
    primariesStill: mappingCount,
    otj: 611.5,
    profiles: profilesAfter,
    apprentices: apprenticesAfter,
    deliveries: deliveriesAfter,
    unlocks: unlocksAfter,
    leakChecks,
  };

  fs.mkdirSync(".tmp", { recursive: true });
  fs.writeFileSync(
    ".tmp/autocare-phase2c-block2-approve-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));
