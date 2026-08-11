import fs from "fs";
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
const report = JSON.parse(
  fs.readFileSync(".tmp-autocare-phase1-seed-report.json", "utf8"),
);
const vid = report.programmeVersionId;

const { data: v } = await sb
  .from("gta_programme_versions")
  .select("id,status,parameters,internal_version")
  .eq("id", vid)
  .single();
const { data: items } = await sb
  .from("gta_spine_items")
  .select(
    "sequence,item_type,title,planned_otj_hours,planned_weeks,metadata",
  )
  .order("sequence");
const { count: sess } = await sb
  .from("gta_programme_sessions")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", vid);
const { data: tasks } = await sb
  .from("gta_course_tasks")
  .select(
    "block_ordinal,task_number,kind,title,source_pdf,curriculum_purposes",
  )
  .eq("programme_version_id", vid)
  .order("block_ordinal")
  .order("task_number");
const { data: sessionsSample } = await sb
  .from("gta_programme_sessions")
  .select(
    "sequence,calendar_week,session_index_in_week,session_key,title,foundation_skill_code,spine_item_id",
  )
  .eq("programme_version_id", vid)
  .order("sequence")
  .limit(15);
const { data: week112 } = await sb
  .from("gta_programme_sessions")
  .select("session_key,title,calendar_week,session_index_in_week")
  .eq("programme_version_id", vid)
  .eq("calendar_week", 112);
const { count: maps } = await sb
  .from("gta_spine_item_ksbs")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", vid);
const { count: ksb } = await sb
  .from("se_ksbs")
  .select("*", { count: "exact", head: true });
const { count: prof } = await sb
  .from("profiles")
  .select("*", { count: "exact", head: true });

const curriculum = (items || []).filter((i) =>
  ["block", "gateway", "epa"].includes(i.item_type),
);
const otjSum = curriculum.reduce(
  (a, b) => a + Number(b.planned_otj_hours),
  0,
);

const out = {
  programmeVersionId: vid,
  status: v.status,
  otj: v.parameters?.expectedOtjHours,
  tag: v.parameters?.controlTag,
  spine: (items || []).map((i) => ({
    seq: i.sequence,
    type: i.item_type,
    title: i.title,
    otj: Number(i.planned_otj_hours),
    weeks: i.planned_weeks,
    blockNumber: i.metadata?.blockNumber ?? null,
    weekStart: i.metadata?.weekStart ?? null,
    weekEnd: i.metadata?.weekEnd ?? null,
  })),
  sessions: sess,
  week112,
  sessionHead: sessionsSample,
  tasks: tasks?.length,
  block1Tasks: (tasks || []).filter((t) => t.block_ordinal === 1),
  mappings: maps,
  ksbs: ksb,
  profiles: prof,
  otjSum,
};
fs.writeFileSync(
  ".tmp-autocare-phase1-verify.json",
  JSON.stringify(out, null, 2),
);
console.log(JSON.stringify(out, null, 2));
