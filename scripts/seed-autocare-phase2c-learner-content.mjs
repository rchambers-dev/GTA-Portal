/**
 * Phase 2C — Block 1 learner-facing content workflow seed.
 *
 * - W001–W010: staff-side candidates from existing FS lesson-plan LOR + extract
 * - W001–W003 only: approved/published apprentice copy (rewritten from source)
 * - Does not invent W004–W010 apprentice copy
 * - Does not move Task 3/4 PDFs onto Sessions
 * - Does not change OTJ, Primaries, staff, or SAFE TEST identity
 *
 *   ALLOW_PHASE2C_LEARNER_CONTENT=1 node --env-file=.env.local scripts/seed-autocare-phase2c-learner-content.mjs --confirm
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const CONTROL_TAG = "autocare-st0499-v1.3-phase1-controlled";
const PROGRAMME_VERSION_ID =
  process.env.AUTOCARE_PHASE1_VERSION_ID?.trim() ||
  "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (process.env.ALLOW_PHASE2C_LEARNER_CONTENT !== "1") {
  die("Requires ALLOW_PHASE2C_LEARNER_CONTENT=1");
}
if (!process.argv.includes("--confirm")) {
  die("Requires --confirm");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing Supabase env");

const sb = createClient(url, key, { auth: { persistSession: false } });

const EXTRACTS_ROOT = path.resolve(
  "tests/artifacts/autocare-v1/evidence-enriched/staging/extracts",
);

function loadExtractText(extractPath, evidenceId) {
  const tryRead = (abs) => {
    if (!abs || !fs.existsSync(abs)) return "";
    const rel = path.relative(EXTRACTS_ROOT, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return "";
    return fs.readFileSync(abs, "utf8");
  };
  if (extractPath) {
    const abs = path.isAbsolute(extractPath)
      ? extractPath
      : path.resolve(process.cwd(), extractPath);
    const text = tryRead(abs);
    if (text) return text;
  }
  if (evidenceId) {
    const text = tryRead(path.join(EXTRACTS_ROOT, `${evidenceId}.txt`));
    if (text) return text;
  }
  return "";
}

function extractCandidateActivities(extractText) {
  if (!extractText.trim()) return [];
  const lines = extractText.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!/OTJ$/i.test(line)) continue;
    if (!/^\d+(\.\d+)?\s*OTJ$/i.test(line) && line !== "OTJ") continue;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const cand = lines[j].trim();
      if (!cand) continue;
      if (/^(Break|Lunch|Non-eligible|Time \/ status|Excluded)/i.test(cand)) {
        break;
      }
      if (cand.length > 40 && !/^\d{2}:\d{2}/.test(cand)) {
        out.push(cand);
        break;
      }
    }
  }
  return [...new Set(out)].slice(0, 6);
}

function candidateFromSource(input) {
  const aims = (input.lessonAims || []).map((s) => String(s).trim()).filter(Boolean);
  const ends = (input.byTheEnd || []).map((s) => String(s).trim()).filter(Boolean);
  const activities = (input.activityLines || [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  const learningParts = [];
  if (aims.length) learningParts.push(aims.join(" "));
  if (ends.length) {
    learningParts.push(`By the end you should be able to: ${ends.join(" ")}`);
  }
  return {
    summary: (input.topic || "").trim(),
    learningContent: learningParts.join("\n\n"),
    activityPractice: activities.join("\n\n"),
    sourceLabel: (input.sourceLabel || "Source extract").trim(),
  };
}

const APPROVED_PILOT = {
  W001: {
    summary:
      "Workshop Safety, Hazards, Housekeeping and Occupational Expectations",
    learningContent:
      "This session is about working safely and professionally in the training centre and workplace. You will learn to spot common workshop hazards, choose suitable controls, and understand your responsibilities for housekeeping, tools, communication and when to report a problem.\n\nBy the end you should be able to identify hazards and controls, explain common safety signs and reporting routes, and complete a short safe-work-area or hazard record.",
    activityPractice:
      "You will take part in a guided workshop safety walk and a team hazard-identification task. You will inspect an area, choose controls, and complete a concise safe-work-area or hazard record. This is session practice — not a formal Task.",
    sourceLabel: "FS01 lesson plan extract",
  },
  W002: {
    summary: "Health and Safety, Tools, Equipment and Safe Vehicle Support",
    learningContent:
      "This session builds on workshop safety and covers safe selection, inspection and use of tools and equipment, including safe lifting and supporting. You will learn why safe working load, equipment condition and calibration matter, and when equipment must be taken out of use.\n\nBy the end you should be able to complete a dynamic risk assessment for a lifting or support task and use appropriate tools safely under supervision.",
    activityPractice:
      "You will complete a guided lifting/support checklist and a supervised practical: prepare the area, complete a dynamic risk assessment, use selected tools correctly and restore the area. This is session practice — not a formal Task.",
    sourceLabel: "FS02 lesson plan extract",
  },
  W003: {
    summary: "Hybrid and High-Voltage Vehicle Awareness",
    learningContent:
      "This session is about recognising hybrid and electric vehicles, their warning systems, and how to approach them safely. You will learn the limits of what you may do and when work must stop so an authorised person can take over.\n\nBy the end you should be able to identify common hybrid/EV labels and high-voltage colours, explain significant hazards and controls, and complete a safe-approach checklist.",
    activityPractice:
      "You will complete a guided vehicle-identification and safe-approach activity, then work through practical hazard scenarios to decide whether work can proceed or must stop and be referred. This is session practice — not a formal Task.",
    sourceLabel: "FS03 lesson plan extract",
  },
};

async function main() {
  const { count: profilesBefore } = await sb
    .from("profiles")
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
      "id, session_key, calendar_week, topic, title, foundation_skill_code, learning_objectives_review",
    )
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .gte("calendar_week", 1)
    .lte("calendar_week", 10)
    .order("calendar_week");
  if (sErr) die(sErr.message);
  if ((sessions || []).length !== 10) {
    die(`Expected 10 Block 1 sessions, found ${(sessions || []).length}`);
  }

  const { data: resources, error: rErr } = await sb
    .from("gta_programme_resources")
    .select("id, title, filename, extract_path, evidence_resource_id, metadata")
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if (rErr) die(rErr.message);

  const { count: taskCount } = await sb
    .from("gta_course_tasks")
    .select("*", { count: "exact", head: true })
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if (taskCount !== 50) die(`Expected 50 tasks, found ${taskCount}`);

  let candidates = 0;
  let approved = 0;
  for (const session of sessions) {
    const lor = session.learning_objectives_review || {};
    const fs = session.foundation_skill_code;
    const resource = (resources || []).find((r) => {
      const meta = r.metadata || {};
      if (fs && meta.foundationSkillCode === fs) return true;
      if (fs && new RegExp(`${fs}\\s+lesson plan`, "i").test(r.title || "")) {
        return true;
      }
      return false;
    });
    const extractText = resource
      ? loadExtractText(resource.extract_path || "", resource.evidence_resource_id || "")
      : "";
    const candidate = candidateFromSource({
      sourceLabel: lor.sourceLabel || (fs ? `${fs} lesson plan` : "Source extract"),
      topic: session.topic || session.title || "",
      lessonAims: Array.isArray(lor.lessonAims) ? lor.lessonAims : [],
      byTheEnd: Array.isArray(lor.byTheEnd) ? lor.byTheEnd : [],
      activityLines: extractCandidateActivities(extractText),
    });
    const pilot = APPROVED_PILOT[session.session_key];
    const payload = {
      status: pilot ? "approved_published" : "candidate_for_review",
      candidate,
      approved: pilot
        ? {
            ...pilot,
            approvedAt: new Date().toISOString(),
            approvedByName: "Phase 2C curriculum-owner pilot",
          }
        : null,
    };
    const { error: uErr } = await sb
      .from("gta_programme_sessions")
      .update({ learner_facing_content: payload })
      .eq("id", session.id)
      .eq("programme_version_id", PROGRAMME_VERSION_ID);
    if (uErr) die(uErr.message);
    candidates += 1;
    if (pilot) approved += 1;
  }

  const { count: profilesAfter } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true });
  if (profilesBefore !== profilesAfter) {
    die(`Refusing: profile count changed ${profilesBefore} → ${profilesAfter}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        candidates,
        approvedPublished: approved,
        leftEmptyForLearners: candidates - approved,
        profiles: profilesAfter,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));
