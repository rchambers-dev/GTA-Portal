/**
 * Phase 2A-style — Block 2 session authoring seed.
 *
 * Attaches catalogue v4.4 specialist lesson plans as Tutor delivery / Tutor only.
 * Writes staff-side learner candidates (not approved/published).
 * Does NOT: attach PowerPoints, publish learner content, place Task 3/4 on Sessions,
 * modify Block 1, staff, OTJ, Primaries, or SAFE TEST records.
 *
 *   ALLOW_PHASE2A_BLOCK2_AUTHORING=1 node --env-file=.env.local scripts/seed-autocare-phase2a-block2.mjs --confirm
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const CONTROL_TAG = "autocare-st0499-v1.3-phase1-controlled";
const PROGRAMME_VERSION_ID =
  process.env.AUTOCARE_PHASE1_VERSION_ID?.trim() ||
  "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";

const LESSON_PLANS = [
  {
    week: 11,
    sessionKey: "W011",
    topic: "Customer Service Scenarios",
    evidenceId: "res_lp_16fe848ac370",
    filename: "Autocare_L2_Week_011_Lesson_Plan_v4.4.docx",
  },
  {
    week: 12,
    sessionKey: "W012",
    topic: "Electrical System Inspection",
    evidenceId: "res_lp_5063b02fbaa2",
    filename: "Autocare_L2_Week_012_Lesson_Plan_v4.4.docx",
  },
  {
    week: 13,
    sessionKey: "W013",
    topic: "Engine Repairs",
    evidenceId: "res_lp_d2ee9a236d4b",
    filename: "Autocare_L2_Week_013_Lesson_Plan_v4.4.docx",
  },
  {
    week: 14,
    sessionKey: "W014",
    topic: "Tyre Pressure Monitoring Systems",
    evidenceId: "res_lp_5ad392e7e654",
    filename: "Autocare_L2_Week_014_Lesson_Plan_v4.4.docx",
  },
  {
    week: 15,
    sessionKey: "W015",
    topic: "Supplier Liaison",
    evidenceId: "res_lp_05b8c7ba4d4b",
    filename: "Autocare_L2_Week_015_Lesson_Plan_v4.4.docx",
  },
  {
    week: 16,
    sessionKey: "W016",
    topic: "Intake plus Inspection",
    evidenceId: "res_lp_1eb8b1588375",
    filename: "Autocare_L2_Week_016_Lesson_Plan_v4.4.docx",
  },
  {
    week: 17,
    sessionKey: "W017",
    topic: "Advanced Brake Diagnostics",
    evidenceId: "res_lp_d2ad96acd09a",
    filename: "Autocare_L2_Week_017_Lesson_Plan_v4.4.docx",
  },
  {
    week: 18,
    sessionKey: "W018",
    topic: "Wheel Alignment - Advanced",
    evidenceId: "res_lp_b4a5050fe271",
    filename: "Autocare_L2_Week_018_Lesson_Plan_v4.4.docx",
  },
  {
    week: 19,
    sessionKey: "W019",
    topic: "Stock Auditing",
    evidenceId: "res_lp_f1e9599b61ba",
    filename: "Autocare_L2_Week_019_Lesson_Plan_v4.4.docx",
  },
  {
    week: 20,
    sessionKey: "W020",
    topic: "Customer Dispute Resolution",
    evidenceId: "res_lp_8b012bfa9807",
    filename: "Autocare_L2_Week_020_Lesson_Plan_v4.4.docx",
  },
];

const UNPLACED = [
  {
    evidenceId: "res_prac_139a816c6d1e",
    filename: "Block_2_Task_3_Battery_and_Charging_Check_v2.0.pdf",
    title: "Block 2 Task 3 practical (v2.0 catalogue)",
    role: "PRACTICE",
    audience: "TUTOR_ONLY",
    reason:
      "Block-level Task 3 PDF. Not Session-placed. v1.0 vs v2.0 split unresolved.",
  },
  {
    evidenceId: "res_prac_b58e0adc803a",
    filename: "Block_2_Task_4_TPMS_and_Tyre_Service_v2.0.pdf",
    title: "Block 2 Task 4 practical (v2.0 catalogue)",
    role: "PRACTICE",
    audience: "TUTOR_ONLY",
    reason:
      "Block-level Task 4 PDF. Not Session-placed. v1.0 vs v2.0 split unresolved.",
  },
  {
    evidenceId: "res_ski_da8d38a7b45a",
    filename: "Block_2_Skills_Progress_Review_v2.0.pdf",
    title: "Block 2 Skills Progress Review",
    role: "ASSESSMENT_PREP",
    audience: "TUTOR_ONLY",
    reason: "Supporting review form; not mapped to a single SOW session.",
  },
  {
    evidenceId: "res_lea_56fb5bda375c",
    filename: "Block_2_Learning_Impact_Record_v2.1.pdf",
    title: "Block 2 Learning Impact Record",
    role: "ASSESSMENT_PREP",
    audience: "TUTOR_ONLY",
    reason: "Not the controlled Task 5 form; retained unplaced.",
  },
];

/** Concise learner-facing rewrites. Staff candidates only — not published. */
const CANDIDATES = {
  W011: {
    summary: "Customer Service Scenarios",
    learningContent:
      "This session is about handling workshop customer conversations professionally, including complaints, delays and misunderstandings. You will learn what customers expect, how poor communication can make a problem worse, and how to keep a clear, accurate record of what was said and what you did.\n\nBy the end you should be able to explain the sequence and risks of a customer service scenario, stay professional under pressure, and complete a simple interaction record.",
    activityPractice:
      "You will take part in structured role-play of realistic complaints (incorrect work, delays, cost disputes). After the tutor models a response, you practise independently and write a short record of the issue and the action taken. This is session practice — not a formal Task.",
  },
  W012: {
    summary: "Electrical System Inspection",
    learningContent:
      "This session covers battery, charging and starting systems and the basic electrical checks used during inspection. You will learn how voltage, current and resistance relate to vehicle systems, and how to inspect connections and take simple readings safely.\n\nBy the end you should be able to identify key electrical components, carry out basic voltage and visual checks, and record findings without guessing.",
    activityPractice:
      "You will identify electrical components on a vehicle or rig and carry out basic tests with a multimeter after a tutor demonstration. You then interpret simple fault scenarios such as a flat battery or poor connection and complete a test record. This is session practice — not a formal Task.",
  },
  W013: {
    summary: "Engine Repairs",
    learningContent:
      "This session introduces engine mechanical components — pistons, crankshaft, camshaft, valves and timing — and how they work together in the four-stroke cycle. You will learn how to inspect for leaks, loose parts and visible wear, and how symptoms can point to mechanical causes.\n\nBy the end you should be able to locate and name key engine parts, explain basic timing and synchronisation, and record a simple diagnostic observation.",
    activityPractice:
      "You will identify engine components on a training engine or vehicle and discuss their function. You then work through fault scenarios (noise, poor performance, leaks) and record likely causes on a worksheet or job card. This is session practice — not a formal Task.",
  },
  W014: {
    summary: "Tyre Pressure Monitoring Systems",
    learningContent:
      "This session explains how TPMS works, including direct and indirect systems, sensors, warnings and communication with the vehicle. You will learn why TPMS matters for inspection and MOT, and when a reset or relearn is needed after tyre work.\n\nBy the end you should be able to describe the main TPMS types, locate sensors where shown, and record a TPMS observation using the correct terms.",
    activityPractice:
      "You will identify TPMS components and observe reset or relearn procedures where appropriate. You then work through warning-light or after-tyre-fit scenarios and complete a short TPMS report. This is session practice — not a formal Task.",
  },
  W015: {
    summary: "Supplier Liaison",
    learningContent:
      "This session is about sourcing the correct parts using vehicle information such as registration or VIN, and communicating clearly with suppliers. You will learn how catalogues and order processes work, and how to deal with wrong, damaged or delayed parts.\n\nBy the end you should be able to identify a suitable part for a given vehicle, complete basic order documentation, and record a supplier issue clearly.",
    activityPractice:
      "You will use catalogues or systems to select parts for given vehicle scenarios, then practise handling incorrect or delayed parts with order and communication records. This is session practice — not a formal Task.",
  },
  W016: {
    summary: "Intake plus Inspection",
    learningContent:
      "This session links customer communication to vehicle intake and inspection planning. You will learn how to greet a customer, gather the concern accurately, and use that information to plan the right checks and complete a job card.\n\nBy the end you should be able to run a simple intake conversation, record concerns clearly, and choose inspection priorities from the symptoms described.",
    activityPractice:
      "You will role-play vehicle intake — greeting, questioning and recording concerns — then plan inspections from those symptoms and complete job-card and inspection records. This is session practice — not a formal Task.",
  },
  W017: {
    summary: "Advanced Brake Diagnostics",
    learningContent:
      "This session covers ABS and related brake diagnostics: wheel-speed sensors, tone rings, the hydraulic control unit and how the ECU uses them. You will learn common inspection points such as damaged wiring, corrosion and incorrect sensor gaps.\n\nBy the end you should be able to locate main ABS components, describe a logical inspection sequence, and record a diagnostic observation from a given warning or symptom.",
    activityPractice:
      "You will identify ABS components on a training vehicle and inspect sensor routes and mounting. You then work through warning-light, intermittent braking or vibration scenarios and record findings on a diagnostic sheet. This is session practice — not a formal Task.",
  },
  W018: {
    summary: "Wheel Alignment — Advanced",
    learningContent:
      "This session builds alignment knowledge: camber, caster, toe, thrust angle and steering-axis inclination, and how they affect handling, tyre wear and steering return. You will learn to read sample alignment values and link pull, wear or off-centre steering to likely causes.\n\nBy the end you should be able to explain the main alignment angles, say whether a sample reading is in specification, and record a reasoned diagnostic note.",
    activityPractice:
      "You will observe alignment equipment and review sample readings, then diagnose scenarios such as a vehicle pulling, uneven tyre wear or an off-centre steering wheel. This is session practice — not a formal Task.",
  },
  W019: {
    summary: "Stock Auditing",
    learningContent:
      "This session explains stock auditing: cycle counts, full checks and why recorded quantities can differ from what is on the shelf. You will learn common causes such as incorrect booking-in, misplacement or use without recording, and how to complete audit paperwork.\n\nBy the end you should be able to carry out a structured count, identify a discrepancy, and record a clear variance note.",
    activityPractice:
      "You will complete a structured stock check against recorded quantities, investigate possible causes of any difference, and complete audit documentation. This is session practice — not a formal Task.",
  },
  W020: {
    summary: "Customer Dispute Resolution",
    learningContent:
      "This session covers handling customer disputes: complaint procedures, when to escalate, and basic consumer-rights awareness. You will learn common causes such as incorrect work, delays or pricing issues, and why written records must be accurate and defensible.\n\nBy the end you should be able to describe a professional dispute-handling sequence, complete a written interaction record, and understand that block review paperwork is completed separately.",
    activityPractice:
      "You will role-play dispute scenarios (work carried out, service quality, cost) and complete written records of the issue, action and outcome. Block review / training-impact paperwork is a separate Task 5 checkpoint — not this session practice.",
  },
};

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (process.env.ALLOW_PHASE2A_BLOCK2_AUTHORING !== "1") {
  die("Requires ALLOW_PHASE2A_BLOCK2_AUTHORING=1");
}
if (!process.argv.includes("--confirm")) {
  die("Requires --confirm");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing Supabase env");

const sb = createClient(url, key, { auth: { persistSession: false } });

function bulletsAfter(text, heading) {
  const idx = text.indexOf(heading);
  if (idx < 0) return [];
  const rest = text.slice(idx + heading.length);
  const lines = rest.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (out.length) break;
      continue;
    }
    if (t.startsWith("•") || t.startsWith("-") || t.startsWith("*")) {
      out.push(t.replace(/^[•\-*]\s*/, "").trim());
      continue;
    }
    if (/^[A-Z]/.test(t) && out.length) break;
  }
  return out;
}

function parseObjectives(extractText, sourceLabel) {
  const lessonAims = bulletsAfter(extractText, "Lesson aims");
  const byTheEnd = bulletsAfter(
    extractText,
    "By the end, apprentices should be able to",
  );
  if (!lessonAims.length && !byTheEnd.length) {
    return {
      status: "empty",
      notes: "No clear aims/outcomes extracted; show source lesson plan.",
      sourceLabel,
    };
  }
  return {
    status: "candidate_for_review",
    sourceLabel,
    lessonAims,
    byTheEnd,
    notes:
      "Surfaced from catalogue v4.4 lesson plan extract for human review. Not controlled structured LO rows. Not apprentice-published.",
  };
}

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

  const { data: sessions, error: sErr } = await sb
    .from("gta_programme_sessions")
    .select(
      "id, session_key, spine_item_id, calendar_week, title, topic, learner_facing_content, publish_status",
    )
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .order("sequence");
  if (sErr) die(sErr.message);
  if ((sessions || []).length !== 113) {
    die(`Expected 113 sessions, found ${(sessions || []).length}`);
  }

  const block1 = (sessions || []).filter(
    (s) => s.calendar_week >= 1 && s.calendar_week <= 10,
  );
  const approvedB1 = block1.filter((s) => {
    const st = s.learner_facing_content?.status;
    return st === "approved_published";
  });
  if (approvedB1.length !== 3) {
    die(
      `Refusing: Block 1 approved_published=${approvedB1.length}, expected 3 (W001–W003)`,
    );
  }
  const b1Keys = approvedB1.map((s) => s.session_key).sort().join(",");
  if (b1Keys !== "W001,W002,W003") {
    die(`Refusing: approved Block 1 keys=${b1Keys}`);
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

  const block2Sessions = (sessions || []).filter(
    (s) => s.calendar_week >= 11 && s.calendar_week <= 20,
  );
  if (block2Sessions.length !== 10) {
    die(`Expected 10 Block 2 sessions, found ${block2Sessions.length}`);
  }
  const alreadyApproved = block2Sessions.filter(
    (s) => s.learner_facing_content?.status === "approved_published",
  );
  if (alreadyApproved.length) {
    die(
      `Refusing: Block 2 learner content already approved (${alreadyApproved
        .map((s) => s.session_key)
        .join(",")}). Do not re-run this authoring seed.`,
    );
  }
  const block2SpineId = block2Sessions[0].spine_item_id;
  if (!block2SpineId) die("Block 2 sessions missing spine_item_id");
  if (block2Sessions.some((s) => s.spine_item_id !== block2SpineId)) {
    die("Block 2 sessions do not share one spine item");
  }

  const extractsRoot = path.resolve(
    "tests/artifacts/autocare-v1/evidence-enriched/staging/extracts",
  );

  const resourceDefs = [
    ...LESSON_PLANS.map((p) => ({
      resource_key: p.evidenceId,
      title: `Week ${p.week} lesson plan — ${p.topic} (v4.4)`,
      filename: p.filename,
      source_path: `02_Specialist_Lesson_Plans/${p.filename}`,
      evidence_resource_id: p.evidenceId,
      extract_path: `tests/artifacts/autocare-v1/evidence-enriched/staging/extracts/${p.evidenceId}.txt`,
      metadata: {
        phase: "2A-block2",
        controlledVersion: "SOW v4.4 catalogue",
        desktopProvenance: "v1.0 Word binary exists; MINOR REVISION vs v4.4",
        sessionKey: p.sessionKey,
        calendarWeek: p.week,
      },
    })),
    ...UNPLACED.map((u) => ({
      resource_key: u.evidenceId,
      title: u.title,
      filename: u.filename,
      source_path: u.filename,
      evidence_resource_id: u.evidenceId,
      extract_path: "",
      metadata: {
        phase: "2A-block2",
        unplacedReason: u.reason,
      },
    })),
  ];

  for (const r of resourceDefs) {
    const { error } = await sb.from("gta_programme_resources").upsert(
      {
        programme_version_id: PROGRAMME_VERSION_ID,
        ...r,
      },
      { onConflict: "programme_version_id,resource_key" },
    );
    if (error) die(`resource ${r.resource_key}: ${error.message}`);
  }

  const { data: resources, error: rErr } = await sb
    .from("gta_programme_resources")
    .select("id, resource_key")
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if (rErr) die(rErr.message);
  const byKey = Object.fromEntries(
    (resources || []).map((r) => [r.resource_key, r.id]),
  );

  const { error: delErr } = await sb
    .from("gta_programme_resource_attachments")
    .delete()
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .eq("spine_item_id", block2SpineId);
  if (delErr) die(`clear Block 2 attachments: ${delErr.message}`);

  for (const p of LESSON_PLANS) {
    const session = block2Sessions.find((s) => s.session_key === p.sessionKey);
    if (!session) die(`Missing session ${p.sessionKey}`);
    const resourceId = byKey[p.evidenceId];
    if (!resourceId) die(`Missing resource ${p.evidenceId}`);

    const extractFile = path.join(extractsRoot, `${p.evidenceId}.txt`);
    if (!fs.existsSync(extractFile)) {
      die(`Missing extract ${p.evidenceId}.txt — refusing attach`);
    }
    const extractText = fs.readFileSync(extractFile, "utf8");
    const review = parseObjectives(extractText, p.filename);
    const cand = CANDIDATES[p.sessionKey];
    if (!cand) die(`Missing candidate copy for ${p.sessionKey}`);

    const { error: upSess } = await sb
      .from("gta_programme_sessions")
      .update({
        publish_status: "draft",
        learning_objectives_review: review,
        learner_facing_content: {
          status: "candidate_for_review",
          candidate: {
            ...cand,
            sourceLabel: `${p.filename} (catalogue v4.4 extract)`,
          },
          approved: null,
        },
      })
      .eq("id", session.id)
      .eq("programme_version_id", PROGRAMME_VERSION_ID);
    if (upSess) die(`${p.sessionKey} session update: ${upSess.message}`);

    const { error: attErr } = await sb
      .from("gta_programme_resource_attachments")
      .insert({
        programme_version_id: PROGRAMME_VERSION_ID,
        resource_id: resourceId,
        session_id: session.id,
        spine_item_id: block2SpineId,
        role: "TUTOR_DELIVERY",
        audience: "TUTOR_ONLY",
        sort_order: 10,
        metadata: {
          mapping: `${p.sessionKey} ↔ Week ${p.week} ${p.topic} lesson plan`,
          evidence: "SOW v4.4 + catalogue extract exact week/topic/block",
          confidence: "high",
          versionGate: "MINOR REVISION vs Desktop v1.0; catalogue v4.4 used",
        },
      });
    if (attErr) die(`attach ${p.sessionKey}: ${attErr.message}`);
  }

  for (const [i, u] of UNPLACED.entries()) {
    const resourceId = byKey[u.evidenceId];
    if (!resourceId) die(`Missing unplaced resource ${u.evidenceId}`);
    const { error } = await sb.from("gta_programme_resource_attachments").insert({
      programme_version_id: PROGRAMME_VERSION_ID,
      resource_id: resourceId,
      session_id: null,
      spine_item_id: block2SpineId,
      role: u.role,
      audience: u.audience,
      sort_order: 100 + i,
      metadata: { unplacedReason: u.reason, confidence: "block-level only" },
    });
    if (error) die(`unplaced ${u.evidenceId}: ${error.message}`);
  }

  const { data: afterSessions, error: aErr } = await sb
    .from("gta_programme_sessions")
    .select("session_key, calendar_week, learner_facing_content, publish_status")
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .gte("calendar_week", 1)
    .lte("calendar_week", 20)
    .order("calendar_week");
  if (aErr) die(aErr.message);

  const b1Approved = (afterSessions || []).filter(
    (s) =>
      s.calendar_week <= 10 &&
      s.learner_facing_content?.status === "approved_published",
  );
  const b2PublishedLearners = (afterSessions || []).filter(
    (s) =>
      s.calendar_week >= 11 &&
      s.learner_facing_content?.status === "approved_published",
  );
  const b2LivePublish = (afterSessions || []).filter(
    (s) => s.calendar_week >= 11 && s.publish_status === "published",
  );
  if (b1Approved.length !== 3) {
    die(`Block 1 approved drifted to ${b1Approved.length}`);
  }
  if (b2PublishedLearners.length !== 0) {
    die("Refusing: Block 2 learner content was published");
  }
  if (b2LivePublish.length !== 0) {
    die("Refusing: Block 2 sessions marked Ready for delivery");
  }

  const { count: profilesAfter } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true });
  const { count: apprenticesAfter } = await sb
    .from("apprentices")
    .select("*", { count: "exact", head: true });
  const { count: deliveriesAfter } = await sb
    .from("gta_session_delivery_records")
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

  const { count: attachCount } = await sb
    .from("gta_programme_resource_attachments")
    .select("*", { count: "exact", head: true })
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .eq("spine_item_id", block2SpineId);

  const report = {
    ok: true,
    programmeVersionId: PROGRAMME_VERSION_ID,
    block2SpineId,
    versionGate: "MINOR REVISION × 10 — catalogue v4.4 attached; Desktop v1.0 provenance only",
    sessionsBlocked: [],
    lessonPlanAttachments: 10,
    unplacedAttachments: UNPLACED.length,
    totalBlock2Attachments: attachCount,
    learnerPublishedBlock2: 0,
    powerpointsAttached: 0,
    sessionsStill: 113,
    tasksStill: taskCount,
    primariesStill: mappingCount,
    otj: 611.5,
    profiles: profilesAfter,
    apprentices: apprenticesAfter,
    deliveries: deliveriesAfter,
    block1ApprovedStill: b1Approved.map((s) => s.session_key),
  };
  fs.mkdirSync(".tmp", { recursive: true });
  fs.writeFileSync(
    ".tmp/autocare-phase2a-block2-seed-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
