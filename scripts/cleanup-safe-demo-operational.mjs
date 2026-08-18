/**
 * Delete ONLY proven SAFE DEMO operational records from hosted Supabase.
 * Does not delete programme/curriculum/Skills England/GTA version/resources.
 */
import fs from "fs";
import path from "path";
import dns from "node:dns";
import pg from "pg";

dns.setDefaultResultOrder("ipv6first");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

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

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const env = { ...process.env, ...loadEnvLocal() };
const dbPassword = env.SUPABASE_DB_PASSWORD?.trim();
const ref = "cjtgjxgghfiskqnuttzd";
if (!dbPassword) die("Missing SUPABASE_DB_PASSWORD");

async function resolveHosts(hostname) {
  const hosts = [];
  try {
    for (const addr of await dns.promises.resolve6(hostname)) {
      hosts.push({ host: addr, display: `${hostname} [IPv6]` });
    }
  } catch {
    // no AAAA
  }
  try {
    for (const addr of await dns.promises.resolve4(hostname)) {
      hosts.push({ host: addr, display: `${hostname} [IPv4]` });
    }
  } catch {
    // no A
  }
  if (hosts.length === 0) hosts.push({ host: hostname, display: hostname });
  return hosts;
}

const candidateSpecs = [
  { hostname: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
  {
    hostname: `aws-1-eu-west-2.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
  },
];

let client;
for (const spec of candidateSpecs) {
  for (const resolved of await resolveHosts(spec.hostname)) {
    const next = new pg.Client({
      host: resolved.host,
      port: spec.port,
      user: spec.user,
      password: dbPassword,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });
    try {
      await next.connect();
      client = next;
      console.log(`CONNECTED via ${resolved.display}:${spec.port}`);
      break;
    } catch {
      try {
        await next.end();
      } catch {
        // ignore
      }
    }
  }
  if (client) break;
}
if (!client) die("CONNECT_FAILED");

const EXPECTED = {
  cohortId: "6ca01800-5e96-4363-8c7c-a00d2653570e",
  groupId: "7eff1889-1f7c-4b2e-b07b-483d9c71585c",
  apprenticeId: "ea587505-487a-4b81-aeec-963cda86e47d",
  enrolmentId: "a58f3062-cb5e-4614-8e24-92ea27d38875",
  tutorProfileId: "d7f99919-c254-484a-9027-943480ad9a59",
  apprenticeProfileId: "a87c7478-ef61-4bf0-99ad-a7e0a260a3f2",
  versionId: "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662",
};

async function counts() {
  const { rows } = await client.query(`
    select
      (select count(*)::int from public.cohorts) as cohorts,
      (select count(*)::int from public.cohort_teaching_groups) as groups,
      (select count(*)::int from public.apprentices) as apprentices,
      (select count(*)::int from public.apprentice_programmes) as enrolments,
      (select count(*)::int from public.teaching_group_memberships) as memberships,
      (select count(*)::int from public.gta_session_learning_releases) as learning_releases,
      (select count(*)::int from public.gta_session_review_releases) as review_releases,
      (select count(*)::int from public.gta_session_delivery_records) as delivery_records,
      (select count(*)::int from public.profiles) as profiles,
      (select count(*)::int from public.profiles where email ilike '%@doncastergta.co.uk') as real_staff,
      (select count(*)::int from public.gta_programmes) as gta_programmes,
      (select count(*)::int from public.gta_programme_versions) as gta_versions,
      (select count(*)::int from public.gta_programme_sessions) as sessions,
      (select count(*)::int from public.gta_spine_items) as spine_items,
      (select count(*)::int from public.se_standards) as se_standards,
      (select count(*)::int from public.se_standard_versions) as se_versions,
      (select count(*)::int from public.programmes) as programmes,
      (select count(*)::int from public.gta_programme_resources) as resources,
      (select count(*)::int from public.gta_course_tasks) as tasks
  `);
  return rows[0];
}

try {
  const materialCols = await client.query(`
    select column_name from information_schema.columns
    where table_schema='public' and table_name='gta_session_material_attachments'
    order by ordinal_position
  `);
  console.log(
    "MATERIAL_ATTACHMENT_COLS",
    materialCols.rows.map((r) => r.column_name),
  );

  const programmes = await client.query(
    `select id, name from public.programmes order by name`,
  );
  console.log(
    "PROGRAMMES",
    programmes.rows.map((r) => r.name),
  );

  const authCols = await client.query(`
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'auth'
      and table_name in ('users', 'identities', 'sessions', 'refresh_tokens')
      and column_name in ('id', 'user_id', 'email')
    order by table_name, ordinal_position
  `);
  console.log("AUTH_COLS", JSON.stringify(authCols.rows));

  const cohort = (
    await client.query(`select * from public.cohorts where id = $1`, [
      EXPECTED.cohortId,
    ])
  ).rows[0];
  const group = (
    await client.query(`select * from public.cohort_teaching_groups where id = $1`, [
      EXPECTED.groupId,
    ])
  ).rows[0];
  const apprentice = (
    await client.query(
      `select id, display_name, apprentice_reference, email, pack
       from public.apprentices where id = $1`,
      [EXPECTED.apprenticeId],
    )
  ).rows[0];
  const enrolment = (
    await client.query(
      `select id, apprentice_id, teaching_group_id, notes, employer_name
       from public.apprentice_programmes where id = $1`,
      [EXPECTED.enrolmentId],
    )
  ).rows[0];
  const tutor = (
    await client.query(
      `select id, email, display_name, department, enabled_by
       from public.profiles where id = $1`,
      [EXPECTED.tutorProfileId],
    )
  ).rows[0];
  const apprenticeProfile = (
    await client.query(
      `select id, email, display_name, linked_apprentice_id, base_role
       from public.profiles where id = $1`,
      [EXPECTED.apprenticeProfileId],
    )
  ).rows[0];

  if (!cohort || !/SAFE TEST intake fixture/i.test(cohort.notes || "")) {
    die("Refusing: cohort is not the SAFE TEST intake fixture");
  }
  if (!group || group.name !== "TEST Autocare Teaching Group (SAFE DEMO)") {
    die("Refusing: teaching group is not the SAFE DEMO group");
  }
  if (
    !apprentice ||
    apprentice.apprentice_reference !== "TEST-GTA-2026-B1DELIVERY" ||
    apprentice.pack?.isTest !== true
  ) {
    die("Refusing: apprentice is not the SAFE DEMO fixture");
  }
  if (!enrolment || !/SAFE TEST enrolment/i.test(enrolment.notes || "")) {
    die("Refusing: enrolment is not the SAFE DEMO fixture");
  }
  if (
    enrolment.apprentice_id !== EXPECTED.apprenticeId ||
    enrolment.teaching_group_id !== EXPECTED.groupId
  ) {
    die("Refusing: enrolment pointers do not match the SAFE DEMO set");
  }
  if (
    !tutor ||
    tutor.email !== "test-autocare-tutor@example.invalid" ||
    tutor.enabled_by !== "SAFE TEST seed"
  ) {
    die("Refusing: tutor profile is not the SAFE DEMO fixture");
  }
  if (
    !apprenticeProfile ||
    apprenticeProfile.email !== "test-block1-delivery@example.invalid" ||
    apprenticeProfile.linked_apprentice_id !== EXPECTED.apprenticeId
  ) {
    die("Refusing: apprentice profile is not the SAFE DEMO fixture");
  }

  const extraGroups = await client.query(
    `select id, name from public.cohort_teaching_groups where id <> $1`,
    [EXPECTED.groupId],
  );
  const extraApprentices = await client.query(
    `select id, display_name from public.apprentices where id <> $1`,
    [EXPECTED.apprenticeId],
  );
  const extraCohorts = await client.query(
    `select id, name from public.cohorts where id <> $1`,
    [EXPECTED.cohortId],
  );
  if (extraGroups.rows.length || extraApprentices.rows.length || extraCohorts.rows.length) {
    die(
      `Refusing: unexpected extra operational rows groups=${extraGroups.rows.length} apprentices=${extraApprentices.rows.length} cohorts=${extraCohorts.rows.length}`,
    );
  }

  const before = await counts();
  console.log("BEFORE", JSON.stringify(before));

  await client.query("begin");
  const deleted = {};
  try {
    deleted.learning_releases = (
      await client.query(
        `delete from public.gta_session_learning_releases
         where apprentice_programme_id = $1
         returning id`,
        [EXPECTED.enrolmentId],
      )
    ).rowCount;
    deleted.review_releases = (
      await client.query(
        `delete from public.gta_session_review_releases
         where apprentice_programme_id = $1
         returning id`,
        [EXPECTED.enrolmentId],
      )
    ).rowCount;
    deleted.delivery_records = (
      await client.query(
        `delete from public.gta_session_delivery_records
         where apprentice_programme_id = $1
         returning id`,
        [EXPECTED.enrolmentId],
      )
    ).rowCount;
    deleted.memberships = (
      await client.query(
        `delete from public.teaching_group_memberships
         where apprentice_programme_id = $1
         returning id`,
        [EXPECTED.enrolmentId],
      )
    ).rowCount;
    await client.query(
      `update public.profiles set linked_apprentice_id = null where id = $1`,
      [EXPECTED.apprenticeProfileId],
    );
    deleted.enrolments = (
      await client.query(
        `delete from public.apprentice_programmes where id = $1 returning id`,
        [EXPECTED.enrolmentId],
      )
    ).rowCount;
    deleted.apprentices = (
      await client.query(`delete from public.apprentices where id = $1 returning id`, [
        EXPECTED.apprenticeId,
      ])
    ).rowCount;
    deleted.teaching_groups = (
      await client.query(
        `delete from public.cohort_teaching_groups where id = $1 returning id`,
        [EXPECTED.groupId],
      )
    ).rowCount;
    deleted.cohorts = (
      await client.query(`delete from public.cohorts where id = $1 returning id`, [
        EXPECTED.cohortId,
      ])
    ).rowCount;

    const demoAuthIds = [
      EXPECTED.tutorProfileId,
      EXPECTED.apprenticeProfileId,
    ];
    for (const table of ["identities", "sessions", "refresh_tokens", "mfa_factors", "one_time_tokens"]) {
      try {
        await client.query(
          `delete from auth.${table} where user_id::text = any($1::text[])`,
          [demoAuthIds],
        );
      } catch (err) {
        if (err.code !== "42P01" && err.code !== "42703") throw err;
        console.log(`skip auth.${table}: ${err.message}`);
      }
    }
    deleted.auth_users = (
      await client.query(
        `delete from auth.users
         where id::text = any($1::text[])
           and email = any($2::text[])
         returning id, email`,
        [
          demoAuthIds,
          [
            "test-autocare-tutor@example.invalid",
            "test-block1-delivery@example.invalid",
          ],
        ],
      )
    ).rowCount;
    deleted.profiles = (
      await client.query(
        `delete from public.profiles
         where id = any($1::uuid[])
           and email = any($2::text[])
         returning id, email`,
        [
          [EXPECTED.tutorProfileId, EXPECTED.apprenticeProfileId],
          [
            "test-autocare-tutor@example.invalid",
            "test-block1-delivery@example.invalid",
          ],
        ],
      )
    ).rowCount;

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  }

  const after = await counts();
  console.log("DELETED", JSON.stringify(deleted));
  console.log("AFTER", JSON.stringify(after));

  const leftovers = await client.query(`
    select
      (select count(*)::int from public.cohorts where notes ilike '%SAFE TEST%' or name ilike '%SAFE DEMO%' or programme_name ilike '%[TEST]%') as demo_cohorts,
      (select count(*)::int from public.cohort_teaching_groups where name ilike '%SAFE DEMO%') as demo_groups,
      (select count(*)::int from public.apprentices where apprentice_reference = 'TEST-GTA-2026-B1DELIVERY' or display_name ilike '%SAFE DEMO%') as demo_apprentices,
      (select count(*)::int from public.apprentice_programmes) as enrolments,
      (select count(*)::int from public.teaching_group_memberships) as memberships,
      (select count(*)::int from public.apprentice_programmes where teaching_group_id is not null) as dangling_pointers,
      (select count(*)::int from public.profiles where email ilike '%example.invalid%') as demo_profiles,
      (select count(*)::int from auth.users where email ilike '%example.invalid%') as demo_auth,
      (select count(*)::int from public.gta_programme_versions where id = $1) as version_still_there,
      (select count(*)::int from public.gta_programme_resources where title ilike '%SAFE DEMO%') as demo_resources_kept
  `, [EXPECTED.versionId]);
  console.log("LEFTOVERS", JSON.stringify(leftovers.rows[0]));

  if (after.real_staff !== 26) die(`Integrity fail: real staff is ${after.real_staff}, expected 26`);
  if (after.gta_versions !== before.gta_versions) die("Integrity fail: GTA versions changed");
  if (after.sessions !== before.sessions) die("Integrity fail: sessions changed");
  if (after.resources !== before.resources) die("Integrity fail: resources changed");
  if (after.se_standards !== before.se_standards) die("Integrity fail: SE standards changed");
  if (after.cohorts !== 0 || after.apprentices !== 0 || after.groups !== 0) {
    die("Integrity fail: operational demo rows still present");
  }
  console.log("CLEANUP_OK");
} finally {
  await client.end();
}
