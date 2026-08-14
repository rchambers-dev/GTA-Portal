/**
 * Read-only invariant check after the Programme Builder security pass.
 * Does not write curriculum, staff, or test accounts.
 */
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

const VID = "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";

const { data: version } = await sb
  .from("gta_programme_versions")
  .select("id, parameters")
  .eq("id", VID)
  .single();
const params = version?.parameters || {};

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

const { data: staff } = await sb
  .from("profiles")
  .select("id, email, display_name, base_role, workspace, permissions")
  .like("email", "%@doncastergta.co.uk");

const { count: profiles } = await sb
  .from("profiles")
  .select("*", { count: "exact", head: true });

const { data: testApprentice } = await sb
  .from("apprentices")
  .select("id, apprentice_reference, display_name")
  .eq("apprentice_reference", "TEST-GTA-2026-B1DELIVERY")
  .maybeSingle();

const { data: testTutor } = await sb
  .from("profiles")
  .select("id, email, display_name, base_role, workspace, permissions")
  .eq("email", "test-autocare-tutor@example.invalid")
  .maybeSingle();

const { count: deliveries } = await sb
  .from("gta_session_delivery_records")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", VID);

const { count: unlocks } = await sb
  .from("gta_enrolment_block_unlocks")
  .select("*", { count: "exact", head: true });

const { data: block2 } = await sb
  .from("gta_programme_sessions")
  .select("session_key, publish_status, learner_facing_content")
  .eq("programme_version_id", VID)
  .gte("calendar_week", 11)
  .lte("calendar_week", 20)
  .order("calendar_week");

const { data: block3 } = await sb
  .from("gta_programme_sessions")
  .select("session_key, publish_status, learner_facing_content")
  .eq("programme_version_id", VID)
  .gte("calendar_week", 21)
  .lte("calendar_week", 30)
  .order("calendar_week");

const { data: w011Res } = await sb
  .from("gta_programme_resources")
  .select("id, resource_key, title")
  .eq("programme_version_id", VID)
  .eq("resource_key", "test_learner_resource_w011_visibility")
  .maybeSingle();

const b2 = (block2 || []).map((s) => ({
  key: s.session_key,
  publish: s.publish_status,
  learner: s.learner_facing_content?.status || "",
}));
const b3 = (block3 || []).map((s) => ({
  key: s.session_key,
  publish: s.publish_status,
  learner: s.learner_facing_content?.status || "",
}));

const report = {
  expectedOtjHours: Number(params.expectedOtjHours),
  controlTag: params.controlTag,
  sessions,
  tasks,
  primaries: primaries ?? 0,
  realStaff: (staff || []).length,
  profiles,
  testApprentice: testApprentice
    ? {
        id: testApprentice.id,
        ref: testApprentice.apprentice_reference,
      }
    : null,
  testTutor: testTutor
    ? {
        id: testTutor.id,
        email: testTutor.email,
        role: testTutor.base_role,
        workspace: testTutor.workspace,
        permissions: testTutor.permissions,
      }
    : null,
  deliveries,
  unlocks: unlocks ?? 0,
  block2: b2,
  block3: b3,
  w011SafeTestResource: Boolean(w011Res),
};

console.log(JSON.stringify(report, null, 2));
