/**
 * Read-only dump of W003 resources, attachments, binaries, and extracts.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const out = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

const env = { ...process.env, ...loadEnvLocal() };
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  { auth: { persistSession: false } },
);

const VID = "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";
const GROUP_NAME = "TEST Autocare Teaching Group (SAFE DEMO)";

const { data: session, error: sErr } = await sb
  .from("gta_programme_sessions")
  .select(
    "id, session_key, title, spine_item_id, foundation_skill_code, publish_status, learner_facing_content",
  )
  .eq("programme_version_id", VID)
  .eq("session_key", "W003")
  .maybeSingle();
if (sErr) throw new Error(sErr.message);
if (!session) throw new Error("W003 not found");

const { data: attachments } = await sb
  .from("gta_programme_resource_attachments")
  .select(
    "id, resource_id, session_id, spine_item_id, role, audience, sort_order, metadata",
  )
  .eq("programme_version_id", VID)
  .eq("session_id", session.id);

const resourceIds = [...new Set((attachments || []).map((a) => a.resource_id))];
const { data: resources } =
  resourceIds.length > 0
    ? await sb
        .from("gta_programme_resources")
        .select(
          "id, resource_key, title, filename, source_path, evidence_resource_id, extract_path, metadata",
        )
        .in("id", resourceIds)
    : { data: [] };

const { data: group } = await sb
  .from("cohort_teaching_groups")
  .select("id, name")
  .eq("name", GROUP_NAME)
  .maybeSingle();

const { data: enrolments } = await sb
  .from("apprentice_programmes")
  .select("id, apprentice_id")
  .eq("teaching_group_id", group.id);

const { data: releases } = await sb
  .from("gta_session_learning_releases")
  .select("id, source, released_at, released_by_name, apprentice_programme_id")
  .eq("session_id", session.id)
  .eq("apprentice_programme_id", enrolments[0].id);

const { count: staff } = await sb
  .from("profiles")
  .select("*", { count: "exact", head: true })
  .like("email", "%@doncastergta.co.uk");
const { count: sessions } = await sb
  .from("gta_programme_sessions")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", VID);
const { count: tasks } = await sb
  .from("gta_course_tasks")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", VID);
const { count: primaries } = await sb
  .from("gta_spine_item_ksbs")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", VID)
  .eq("is_primary", true);
const { count: unlocks } = await sb
  .from("gta_enrolment_block_unlocks")
  .select("*", { count: "exact", head: true });
const { count: deliveries } = await sb
  .from("gta_session_delivery_records")
  .select("*", { count: "exact", head: true });
const { count: allReleases } = await sb
  .from("gta_session_learning_releases")
  .select("*", { count: "exact", head: true });

function fileExists(p) {
  if (!p) return false;
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  return fs.existsSync(abs);
}

function extractSnippet(p) {
  if (!fileExists(p)) return null;
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  const text = fs.readFileSync(abs, "utf8");
  const hasAnswers =
    /Question 1|Question 2|Which statement is true|How does a full hybrid/i.test(
      text,
    );
  const answerSlides = [];
  if (/===== SLIDE 13 =====/.test(text) && /kinetic energy/i.test(text)) {
    answerSlides.push(13);
  }
  if (/===== SLIDE 15 =====/.test(text) && /full hybrid runs mainly/i.test(text)) {
    answerSlides.push(15);
  }
  return {
    bytes: Buffer.byteLength(text),
    hasQuizAnswerSlides: hasAnswers,
    answerSlideNumbers: answerSlides,
    head: text.slice(0, 400),
  };
}

const inventory = (attachments || []).map((a) => {
  const r = (resources || []).find((row) => row.id === a.resource_id) || {};
  const ext = path.extname(r.filename || "").toLowerCase();
  const originalCandidates = [
    r.source_path,
    r.filename,
    `tests/artifacts/${r.filename || ""}`,
  ].filter(Boolean);
  const originalExists = originalCandidates.some((p) => fileExists(p));
  return {
    attachmentId: a.id,
    resourceId: r.id,
    resourceKey: r.resource_key,
    title: r.title,
    filename: r.filename,
    fileType: ext || "(none)",
    role: a.role,
    audience: a.audience,
    attachedDirectlyToW003: a.session_id === session.id,
    tutorCanOpen: a.audience === "TUTOR_ONLY" || a.role === "TUTOR_DELIVERY" || a.audience === "LEARNER_VISIBLE",
    apprenticeCanOpenIfReleased: a.audience === "LEARNER_VISIBLE",
    sourcePath: r.source_path || "",
    extractPath: r.extract_path || "",
    evidenceResourceId: r.evidence_resource_id || "",
    originalBinaryExistsInRepo: originalExists,
    extractExists: fileExists(r.extract_path),
    extract: extractSnippet(r.extract_path),
    metadata: r.metadata || {},
    attachmentMetadata: a.metadata || {},
  };
});

const dump = {
  session: {
    id: session.id,
    key: session.session_key,
    title: session.title,
    foundationSkillCode: session.foundation_skill_code,
    publishStatus: session.publish_status,
    learnerFacingStatus: session.learner_facing_content?.status || "",
  },
  releasedForSafeTestApprentice: (releases || []).length > 0,
  releases: releases || [],
  attachmentCount: inventory.length,
  learnerVisibleCount: inventory.filter((r) => r.audience === "LEARNER_VISIBLE")
    .length,
  tutorOnlyCount: inventory.filter((r) => r.audience === "TUTOR_ONLY").length,
  inventory,
  whyLearnerSeesNoExtraMaterials:
    inventory.filter((r) => r.audience === "LEARNER_VISIBLE").length === 0
      ? "W003 has no LEARNER_VISIBLE attachments. The learner page only lists audience=LEARNER_VISIBLE resources. Tutor-only lesson plan and Hybrid PPT are correctly excluded."
      : "LEARNER_VISIBLE attachments exist — if the page is still empty, check learner view filtering.",
  invariants: {
    realStaff: staff,
    sessions,
    tasks,
    primaries,
    unlocks,
    deliveryRecords: deliveries,
    learningReleases: allReleases,
  },
};

console.log(JSON.stringify(dump, null, 2));
