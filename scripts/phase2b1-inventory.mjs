import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

const env = { ...process.env, ...loadEnvLocal() };
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function count(table, filter) {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n, error } = await q;
  if (error) return { table, error: error.message, count: null };
  return { table, count: n };
}

const CONTROL_TAG = "autocare-st0499-v1.3-phase1-controlled";
const VERSION_ID = "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";

const results = {};
for (const table of [
  "profiles",
  "apprentices",
  "apprentice_programmes",
  "cohorts",
  "gta_programme_sessions",
  "gta_course_tasks",
  "gta_session_delivery_records",
  "gta_enrolment_block_unlocks",
  "gta_block_ksb_mappings",
]) {
  results[table] = await count(table);
}

const cea = await supabase.from("cea_apprentice_states").select("id", {
  count: "exact",
  head: true,
});
results.cea_apprentice_states = cea.error
  ? { missing: true, error: cea.error.message }
  : { count: cea.count };

const { data: version } = await supabase
  .from("gta_programme_versions")
  .select("id, parameters, planned_otj_hours")
  .eq("id", VERSION_ID)
  .maybeSingle();

const { data: sessions } = await supabase
  .from("gta_programme_sessions")
  .select("id, session_key, calendar_week, publish_status")
  .eq("programme_version_id", VERSION_ID);

const { data: tasks } = await supabase
  .from("gta_course_tasks")
  .select("id, task_key, block_ordinal, publish_status")
  .eq("programme_version_id", VERSION_ID);

const { data: apprentices } = await supabase
  .from("apprentices")
  .select("id, display_name, apprentice_reference");

const { data: enrolments } = await supabase
  .from("apprentice_programmes")
  .select(
    "id, apprentice_id, cohort_id, gta_programme_version_id, programme_name, programme_week",
  );

const { data: profiles } = await supabase
  .from("profiles")
  .select("id, role, workspace, email");

const { data: deliveries } = await supabase
  .from("gta_session_delivery_records")
  .select("id, session_id, status");

const { data: block1TaskRows } = await supabase
  .from("gta_course_tasks")
  .select("task_key, title, kind, block_ordinal, task_number, publish_status")
  .eq("programme_version_id", VERSION_ID)
  .eq("block_ordinal", 1)
  .order("task_number");

const { data: versionRow } = await supabase
  .from("gta_programme_versions")
  .select("*")
  .eq("id", VERSION_ID)
  .maybeSingle();

const { data: ceaProbe, error: ceaErr } = await supabase
  .from("cea_apprentice_states")
  .select("id")
  .limit(1);

const block1Tasks = (tasks ?? []).filter((t) => Number(t.block_ordinal) === 1);
const ceaKeys = (tasks ?? []).filter((t) => /^g\d+-t/i.test(t.task_key));
const params = (version?.parameters || {}) ;
const plannedOtj =
  params.plannedEligibleOtjHours ??
  params.planned_eligible_otj_hours ??
  version?.planned_otj_hours ??
  null;

console.log(
  JSON.stringify(
    {
      counts: results,
      version: {
        id: version?.id ?? null,
        controlTag: params.controlTag ?? params.control_tag ?? null,
        plannedOtj,
      },
      sessions: {
        total: sessions?.length ?? 0,
        published: (sessions ?? []).filter((s) => s.publish_status === "published")
          .length,
        block1: (sessions ?? []).filter(
          (s) => Number(s.calendar_week) >= 1 && Number(s.calendar_week) <= 10,
        ).length,
      },
      tasks: {
        total: tasks?.length ?? 0,
        block1: block1Tasks.length,
        block1Keys: block1Tasks.map((t) => t.task_key).sort(),
        ceaGroupKeys: ceaKeys.map((t) => t.task_key),
        draft: (tasks ?? []).filter((t) => t.publish_status === "draft").length,
      },
      apprentices,
      enrolments,
      profileRoles: (profiles ?? []).reduce((acc, p) => {
        const key = `${p.workspace || "unknown"}:${p.role || "unknown"}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      profileCount: profiles?.length ?? 0,
      deliveries: deliveries?.length ?? 0,
      block1TaskRows,
      versionRowKeys: versionRow ? Object.keys(versionRow) : [],
      versionParameters: versionRow?.parameters ?? versionRow?.control_tag ?? null,
      ceaTable:
        ceaErr?.message ||
        (ceaProbe == null ? "dropped-or-empty" : "present"),
    },
    null,
    2,
  ),
);
