/**
 * Read-only dump of SAFE TEST teaching-group release walkthrough state.
 * Does not write. Does not release W003.
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
const GROUP_NAME = "TEST Autocare Teaching Group (SAFE DEMO)";

const { data: group } = await sb
  .from("cohort_teaching_groups")
  .select("id, name, tutor_name, college_days, notes")
  .eq("name", GROUP_NAME)
  .maybeSingle();

const { data: enrolments } = await sb
  .from("apprentice_programmes")
  .select(
    "id, apprentice_id, status, teaching_group_id, programme_week, gta_programme_version_id",
  )
  .eq("teaching_group_id", group.id);

const { data: ap } = await sb
  .from("apprentices")
  .select("id, display_name, apprentice_reference")
  .eq("id", enrolments[0].apprentice_id)
  .maybeSingle();

const { data: sessions } = await sb
  .from("gta_programme_sessions")
  .select("id, session_key, title, learner_facing_content")
  .eq("programme_version_id", VID)
  .in("session_key", ["W001", "W002", "W003"]);

const { data: releases } = await sb
  .from("gta_session_learning_releases")
  .select(
    "id, session_id, source, released_at, released_by_name, teaching_group_id, apprentice_programme_id",
  )
  .eq("apprentice_programme_id", enrolments[0].id);

const { data: deliveries } = await sb
  .from("gta_session_delivery_records")
  .select("id, session_id")
  .eq("apprentice_programme_id", enrolments[0].id);

const { data: atts } = await sb
  .from("gta_programme_resource_attachments")
  .select("session_id, audience, role, resource_id")
  .in(
    "session_id",
    sessions.map((s) => s.id),
  );

const { data: staff } = await sb
  .from("profiles")
  .select("id")
  .like("email", "%@doncastergta.co.uk");

const { count: tasks } = await sb
  .from("gta_course_tasks")
  .select("*", { count: "exact", head: true })
  .eq("programme_version_id", VID);

const { count: sessionCount } = await sb
  .from("gta_programme_sessions")
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

const keyById = Object.fromEntries(sessions.map((s) => [s.id, s.session_key]));
const dump = {
  teachingGroup: group,
  roster: [
    {
      enrolmentId: enrolments[0].id,
      displayName: ap.display_name,
      reference: ap.apprentice_reference,
      programmeWeek: enrolments[0].programme_week,
    },
  ],
  sessions: sessions.map((s) => ({
    key: s.session_key,
    title: s.title,
    learnerStatus: s.learner_facing_content?.status || "",
    released: releases.some((r) => r.session_id === s.id),
    deliveryRecordKept: deliveries.some((d) => d.session_id === s.id),
    attachments: atts
      .filter((a) => a.session_id === s.id)
      .map((a) => ({ audience: a.audience, role: a.role })),
  })),
  releases: releases.map((r) => ({
    sessionKey: keyById[r.session_id],
    source: r.source,
    releasedByName: r.released_by_name,
    releasedAt: r.released_at,
  })),
  invariants: {
    realStaff: (staff || []).length,
    sessions: sessionCount,
    tasks,
    primaries,
    unlocks,
    deliveryRecords: (deliveries || []).length,
    learningReleases: (releases || []).length,
  },
};

console.log(JSON.stringify(dump, null, 2));
