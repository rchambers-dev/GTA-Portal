/**
 * Phase 2A — Block 1 session authoring pilot seed.
 *
 * Guards:
 *   ALLOW_HOSTED_PB_AUTHORING_RESET=1
 *   --confirm
 *
 * Does NOT: touch staff, learners, Primaries, Golden B, Blocks 2–10 mappings,
 * invent Task release weeks, invent learner PowerPoints.
 *
 * Usage:
 *   ALLOW_HOSTED_PB_AUTHORING_RESET=1 node --env-file=.env.local scripts/seed-autocare-phase2a-block1.mjs --confirm
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const CONTROL_TAG = "autocare-st0499-v1.3-phase1-controlled";
const PROGRAMME_VERSION_ID =
  process.env.AUTOCARE_PHASE1_VERSION_ID?.trim() ||
  "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";

const FS_LESSON_PLANS = [
  {
    fs: "FS01",
    week: 1,
    sessionKey: "W001",
    evidenceId: "res_lp_8f67680b4ed9",
    filename: "Foundation_Skills_FS01_Week_1_Lesson_Plan_v1.2.docx",
  },
  {
    fs: "FS02",
    week: 2,
    sessionKey: "W002",
    evidenceId: "res_lp_a1de2dadb565",
    filename: "Foundation_Skills_FS02_Week_2_Lesson_Plan_v1.2.docx",
  },
  {
    fs: "FS03",
    week: 3,
    sessionKey: "W003",
    evidenceId: "res_lp_f7ae4503f880",
    filename: "Foundation_Skills_FS03_Week_3_Lesson_Plan_v1.2.docx",
  },
  {
    fs: "FS04",
    week: 4,
    sessionKey: "W004",
    evidenceId: "res_lp_4e5d5534a1f4",
    filename: "Foundation_Skills_FS04_Week_4_Lesson_Plan_v1.2.docx",
  },
  {
    fs: "FS05",
    week: 5,
    sessionKey: "W005",
    evidenceId: "res_lp_f311ff09e560",
    filename: "Foundation_Skills_FS05_Week_5_Lesson_Plan_v1.2.docx",
  },
  {
    fs: "FS06",
    week: 6,
    sessionKey: "W006",
    evidenceId: "res_lp_c67c9df7ff7b",
    filename: "Foundation_Skills_FS06_Week_6_Lesson_Plan_v1.2.docx",
  },
  {
    fs: "FS07",
    week: 7,
    sessionKey: "W007",
    evidenceId: "res_lp_7561f4aaf78a",
    filename: "Foundation_Skills_FS07_Week_7_Lesson_Plan_v1.2.docx",
  },
  {
    fs: "FS08",
    week: 8,
    sessionKey: "W008",
    evidenceId: "res_lp_8afb61732d53",
    filename: "Foundation_Skills_FS08_Week_8_Lesson_Plan_v1.2.docx",
  },
  {
    fs: "FS09",
    week: 9,
    sessionKey: "W009",
    evidenceId: "res_lp_5792e033a5a0",
    filename: "Foundation_Skills_FS09_Week_9_Lesson_Plan_v1.2.docx",
  },
  {
    fs: "FS10",
    week: 10,
    sessionKey: "W010",
    evidenceId: "res_lp_76cd8f807cd7",
    filename: "Foundation_Skills_FS10_Week_10_Lesson_Plan_v1.2.docx",
  },
];

const UNPLACED = [
  {
    evidenceId: "res_prac_938cf7eba750",
    filename: "Block_1_Task_3_Vehicle_Safety_Inspection_v2.0.pdf",
    title: "Block 1 Task 3 practical (v2.0)",
    role: "PRACTICE",
    audience: "TUTOR_ONLY",
    reason: "Block-scoped practical PDF; exact session placement not locked in Phase 2A",
  },
  {
    evidenceId: "res_prac_f59376934078",
    filename: "Block_1_Task_4_Basic_Braking_and_Tyre_Check_v2.0.pdf",
    title: "Block 1 Task 4 practical (v2.0)",
    role: "PRACTICE",
    audience: "TUTOR_ONLY",
    reason: "Block-scoped practical PDF; exact session placement not locked in Phase 2A",
  },
  {
    evidenceId: "res_ski_b6f8500110ad",
    filename: "Block_1_Skills_Progress_Review_v2.0.pdf",
    title: "Block 1 Skills Progress Review",
    role: "ASSESSMENT_PREP",
    audience: "TUTOR_ONLY",
    reason: "Supporting review form; not mapped to a single SOW session",
  },
  {
    evidenceId: "res_lea_c686091b2483",
    filename: "Block_1_Learning_Impact_Record_v2.1.pdf",
    title: "Block 1 Learning Impact Record",
    role: "ASSESSMENT_PREP",
    audience: "TUTOR_ONLY",
    reason: "Not the controlled Task 5 form; retained unplaced pending authoring decision",
  },
];

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (process.env.ALLOW_HOSTED_PB_AUTHORING_RESET !== "1") {
  die("Requires ALLOW_HOSTED_PB_AUTHORING_RESET=1");
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
      "Surfaced from lesson plan extract for human review. Not controlled structured LO rows.",
  };
}

async function main() {
  const { count: profilesBefore } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { data: version, error: vErr } = await sb
    .from("gta_programme_versions")
    .select("id, parameters, status")
    .eq("id", PROGRAMME_VERSION_ID)
    .maybeSingle();
  if (vErr) die(vErr.message);
  if (!version) die(`Programme version ${PROGRAMME_VERSION_ID} not found`);
  const params = version.parameters || {};
  if (params.controlTag !== CONTROL_TAG) {
    die(`Refusing: controlTag is ${params.controlTag}, expected ${CONTROL_TAG}`);
  }
  if (Number(params.expectedOtjHours) !== 611.5) {
    die(`Refusing: expectedOtjHours=${params.expectedOtjHours}`);
  }

  const { data: sessions, error: sErr } = await sb
    .from("gta_programme_sessions")
    .select("id, session_key, spine_item_id, foundation_skill_code, calendar_week")
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .order("sequence");
  if (sErr) die(sErr.message);
  if ((sessions || []).length !== 113) {
    die(`Expected 113 sessions, found ${(sessions || []).length}`);
  }

  const { count: taskCount } = await sb
    .from("gta_course_tasks")
    .select("*", { count: "exact", head: true })
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if (taskCount !== 50) die(`Expected 50 tasks, found ${taskCount}`);

  const { count: mappingCount } = await sb
    .from("gta_block_ksb_mappings")
    .select("*", { count: "exact", head: true })
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if ((mappingCount ?? 0) !== 0) die(`Expected 0 Primaries, found ${mappingCount}`);

  const block1Sessions = (sessions || []).filter(
    (s) => s.calendar_week >= 1 && s.calendar_week <= 10,
  );
  if (block1Sessions.length !== 10) {
    die(`Expected 10 Block 1 sessions, found ${block1Sessions.length}`);
  }
  const block1SpineId = block1Sessions[0].spine_item_id;
  if (!block1SpineId) die("Block 1 sessions missing spine_item_id");

  const extractsRoot = path.resolve(
    "tests/artifacts/autocare-v1/evidence-enriched/staging/extracts",
  );

  // Upsert resources: FS lesson plans + README + unplaced
  const resourceDefs = [
    ...FS_LESSON_PLANS.map((p) => ({
      resource_key: p.evidenceId,
      title: `${p.fs} lesson plan (v1.2)`,
      filename: p.filename,
      source_path: `01_Shared_Foundation_Skills_FS01-FS10_v1.2/${p.filename}`,
      evidence_resource_id: p.evidenceId,
      extract_path: `tests/artifacts/autocare-v1/evidence-enriched/staging/extracts/${p.evidenceId}.txt`,
      metadata: {
        foundationSkillCode: p.fs,
        controlledVersion: "FS v1.2",
        phase2a: true,
      },
    })),
    {
      resource_key: "res_lp_70e8cb3eeacc",
      title: "Shared Foundation Skills pack README",
      filename: "README.txt",
      source_path: "01_Shared_Foundation_Skills_FS01-FS10_v1.2/README.txt",
      evidence_resource_id: "res_lp_70e8cb3eeacc",
      extract_path: "",
      metadata: {
        phase2a: true,
        multiSessionExample: true,
        note: "Pack-level tutor context spanning Foundation Skills; attached to W001 and W010 to demonstrate multi-session attachment.",
      },
    },
    ...UNPLACED.map((u) => ({
      resource_key: u.evidenceId,
      title: u.title,
      filename: u.filename,
      source_path: u.filename,
      evidence_resource_id: u.evidenceId,
      extract_path: "",
      metadata: { phase2a: true, unplacedReason: u.reason },
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

  // Clear prior Phase 2A attachments for this block (idempotent re-seed)
  await sb
    .from("gta_programme_resource_attachments")
    .delete()
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .eq("spine_item_id", block1SpineId);

  // FS01–FS10 → W001–W010 TUTOR_DELIVERY / TUTOR_ONLY
  for (const p of FS_LESSON_PLANS) {
    const session = block1Sessions.find((s) => s.session_key === p.sessionKey);
    if (!session) die(`Missing session ${p.sessionKey}`);
    const resourceId = byKey[p.evidenceId];
    if (!resourceId) die(`Missing resource ${p.evidenceId}`);

    const extractFile = path.join(extractsRoot, `${p.evidenceId}.txt`);
    let review = {
      status: "empty",
      notes: "Extract file missing; show source lesson plan.",
      sourceLabel: p.filename,
    };
    if (fs.existsSync(extractFile)) {
      review = parseObjectives(
        fs.readFileSync(extractFile, "utf8"),
        p.filename,
      );
    }

    const { error: upSess } = await sb
      .from("gta_programme_sessions")
      .update({
        publish_status: "draft",
        learning_objectives_review: review,
      })
      .eq("id", session.id);
    if (upSess) die(upSess.message);

    const { error: attErr } = await sb
      .from("gta_programme_resource_attachments")
      .insert({
        programme_version_id: PROGRAMME_VERSION_ID,
        resource_id: resourceId,
        session_id: session.id,
        spine_item_id: block1SpineId,
        role: "TUTOR_DELIVERY",
        audience: "TUTOR_ONLY",
        sort_order: 10,
        metadata: {
          mapping: `${p.sessionKey} ↔ ${p.fs} lesson plan`,
          evidence: "catalogue + SOW Foundation Skills sequence",
          confidence: "high",
        },
      });
    if (attErr) die(`attach ${p.sessionKey}: ${attErr.message}`);
  }

  // Multi-session example: pack README on W001 and W010
  const readmeId = byKey["res_lp_70e8cb3eeacc"];
  for (const key of ["W001", "W010"]) {
    const session = block1Sessions.find((s) => s.session_key === key);
    const { error } = await sb.from("gta_programme_resource_attachments").insert({
      programme_version_id: PROGRAMME_VERSION_ID,
      resource_id: readmeId,
      session_id: session.id,
      spine_item_id: block1SpineId,
      role: "TUTOR_DELIVERY",
      audience: "TUTOR_ONLY",
      sort_order: 20,
      metadata: {
        multiSessionExample: true,
        note: "Same resource attached to multiple sessions (pack-level tutor context).",
      },
    });
    if (error) die(`readme ${key}: ${error.message}`);
  }

  // Unplaced at Block 1
  for (const [i, u] of UNPLACED.entries()) {
    const { error } = await sb.from("gta_programme_resource_attachments").insert({
      programme_version_id: PROGRAMME_VERSION_ID,
      resource_id: byKey[u.evidenceId],
      session_id: null,
      spine_item_id: block1SpineId,
      role: u.role,
      audience: u.audience,
      sort_order: 100 + i,
      metadata: { unplacedReason: u.reason },
    });
    if (error) die(`unplaced ${u.evidenceId}: ${error.message}`);
  }

  const { count: profilesAfter } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true });
  const { count: attachCount } = await sb
    .from("gta_programme_resource_attachments")
    .select("*", { count: "exact", head: true })
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .eq("spine_item_id", block1SpineId);
  const { count: sessCount } = await sb
    .from("gta_programme_sessions")
    .select("*", { count: "exact", head: true })
    .eq("programme_version_id", PROGRAMME_VERSION_ID);

  const report = {
    programmeVersionId: PROGRAMME_VERSION_ID,
    block1SpineId,
    fsLessonPlanAttachments: 10,
    multiSessionReadmeAttachments: 2,
    unplacedAttachments: UNPLACED.length,
    totalBlock1Attachments: attachCount,
    sessionsStill: sessCount,
    tasksStill: taskCount,
    primariesStill: mappingCount ?? 0,
    profilesBefore,
    profilesAfter,
    otj: 611.5,
  };
  fs.mkdirSync(".tmp", { recursive: true });
  fs.writeFileSync(
    ".tmp/autocare-phase2a-block1-seed-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
