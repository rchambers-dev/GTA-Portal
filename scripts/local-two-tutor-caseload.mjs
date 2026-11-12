import { readFileSync } from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const status = JSON.parse(readFileSync("/tmp/supabase-native-start.json", "utf8"));
const apiUrl = status.env.API_URL;
const dbUrl = status.env.DB_URL;
if (!String(apiUrl).includes("127.0.0.1") || !String(dbUrl).includes("127.0.0.1")) {
  throw new Error("Refusing a non-local database.");
}
if (String(apiUrl).includes("cjtgjxgghfiskqnuttzd") || String(dbUrl).includes("cjtgjxgghfiskqnuttzd")) {
  throw new Error("Refusing the hosted target.");
}

const tutorA = "11111111-1111-4111-8111-111111111111";
const tutorB = "2222222-2222-4222-8222-222222222222";
const apprenticeA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const apprenticeB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const programmeA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const programmeB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const db = new pg.Client({ connectionString: dbUrl });
await db.connect();
await db.query(`
  alter table public.profiles add column if not exists display_name text;
  alter table public.profiles add column if not exists base_role text;
  alter table public.profiles add column if not exists workspace text;
  alter table public.apprentices add column if not exists display_name text;
  create table if not exists public.apprentice_programmes (
    id uuid primary key,
    apprentice_id uuid
  );
  create table if not exists public.staff_assignments (
    id uuid primary key,
    profile_id uuid,
    learner_programme_id uuid,
    role text,
    active boolean
  );
`);
await db.query("delete from public.staff_assignments where profile_id in ($1, $2)", [tutorA, "22222222-2222-4222-8222-222222222222"]);
const tutorBFixed = "22222222-2222-4222-8222-222222222222";
await db.query(
  `insert into public.profiles (id, display_name, base_role, workspace) values
     ($1, 'Synthetic Tutor A', 'Tutor', 'staff'),
     ($2, 'Synthetic Tutor B', 'Tutor', 'staff')
   on conflict (id) do update set display_name = excluded.display_name`,
  [tutorA, tutorBFixed],
);
await db.query(
  `insert into public.apprentices (id, display_name) values ($1, 'Synthetic Apprentice A'), ($2, 'Synthetic Apprentice B')
   on conflict (id) do update set display_name = excluded.display_name`,
  [apprenticeA, apprenticeB],
);
await db.query(
  `insert into public.apprentice_programmes (id, apprentice_id) values ($1, $2), ($3, $4)
   on conflict (id) do update set apprentice_id = excluded.apprentice_id`,
  [programmeA, apprenticeA, programmeB, apprenticeB],
);
await db.query("delete from public.staff_assignments where profile_id in ($1, $2)", [tutorA, tutorBFixed]);
await db.query(
  `insert into public.staff_assignments (id, profile_id, learner_programme_id, role, active) values
     ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', $1, $2, 'tutor', true),
     ('ffffffff-ffff-4fff-8fff-ffffffffffff', $3, $4, 'tutor', true)`,
  [tutorA, programmeA, tutorBFixed, programmeB],
);

const supabase = createClient(apiUrl, status.env.SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function caseload(profileId) {
  const result = await db.query(
    `select programmes.apprentice_id
     from public.staff_assignments assignments
     join public.apprentice_programmes programmes on programmes.id = assignments.learner_programme_id
     where assignments.profile_id = $1 and assignments.role = 'tutor' and assignments.active = true
     order by programmes.apprentice_id`,
    [profileId],
  );
  return result.rows.map((row) => row.apprentice_id);
}

const a = await caseload(tutorA);
const b = await caseload(tutorBFixed);
if (JSON.stringify(a) !== JSON.stringify([apprenticeA])) throw new Error(`Tutor A saw ${a.join(",")}`);
if (JSON.stringify(b) !== JSON.stringify([apprenticeB])) throw new Error(`Tutor B saw ${b.join(",")}`);

const first = await supabase.rpc("rate_limit_hit", {
  actor_id: tutorA,
  bucket_key: "review-reword-proof",
  bucket_start: new Date().toISOString(),
  max_hits: 1,
});
const second = await supabase.rpc("rate_limit_hit", {
  actor_id: tutorA,
  bucket_key: "review-reword-proof",
  bucket_start: first.data === true ? (await db.query("select bucket from public.tutor_reword_rate where user_id = $1 and bucket_key = 'review-reword-proof'", [tutorA])).rows[0].bucket : new Date().toISOString(),
  max_hits: 1,
});
if (first.error) throw new Error(first.error.message);
if (first.data !== true) throw new Error("First rate limit call should allow.");
if (second.data !== false) throw new Error(`Second rate limit call should deny, got ${second.data}`);

await db.query("delete from public.tutor_reword_rate where user_id = $1", [tutorA]);
await db.query("delete from public.staff_assignments where profile_id in ($1, $2)", [tutorA, tutorBFixed]);
await db.query("delete from public.apprentice_programmes where id in ($1, $2)", [programmeA, programmeB]);
await db.query("delete from public.apprentices where id in ($1, $2)", [apprenticeA, apprenticeB]);
await db.query("delete from public.profiles where id in ($1, $2)", [tutorA, tutorBFixed]);
await db.end();
console.log("PASS local canonical caseload isolation");
console.log("PASS local rate_limit_hit denies the second hit");
