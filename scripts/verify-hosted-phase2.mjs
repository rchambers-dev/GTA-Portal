/**
 * Post-034 hosted verification + transactional smoke tests.
 * Smoke DML is rolled back. Does not keep test rows.
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

const env = { ...process.env, ...loadEnvLocal() };
const dbPassword = env.SUPABASE_DB_PASSWORD?.trim();
const ref = "cjtgjxgghfiskqnuttzd";
if (!dbPassword) {
  console.log("STOP: missing SUPABASE_DB_PASSWORD");
  process.exit(2);
}

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
  {
    hostname: `aws-1-eu-west-2.pooler.supabase.com`,
    port: 6543,
    user: `postgres.${ref}`,
  },
];

let client;
for (const spec of candidateSpecs) {
  const resolvedHosts = await resolveHosts(spec.hostname);
  for (const resolved of resolvedHosts) {
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
if (!client) {
  console.log("CONNECT_FAILED");
  process.exit(3);
}

const q = async (label, sql, params) => {
  const result = params
    ? await client.query(sql, params)
    : await client.query(sql);
  console.log(label, JSON.stringify(result.rows, null, 2));
  return result.rows;
};

try {
  await q(
    "MIGRATIONS_TAIL",
    `select filename, applied_at from public.schema_migrations
     where filename >= '032' order by filename`,
  );

  await q(
    "CTG_SCHEMA",
    `
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'cohort_teaching_groups'
    order by ordinal_position
    `,
  );

  await q(
    "CTG_FKS",
    `
    select tc.constraint_name, kcu.column_name, ccu.table_name as foreign_table,
           rc.delete_rule
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    join information_schema.referential_constraints rc
      on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
    where tc.table_schema = 'public' and tc.table_name = 'cohort_teaching_groups'
      and tc.constraint_type = 'FOREIGN KEY'
    order by tc.constraint_name
    `,
  );

  await q(
    "CTG_CHECKS",
    `
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.cohort_teaching_groups'::regclass and contype = 'c'
    `,
  );

  await q(
    "MEMBERSHIP_COLUMNS",
    `
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'teaching_group_memberships'
    order by ordinal_position
    `,
  );

  await q(
    "MEMBERSHIP_INDEXES",
    `
    select indexname, indexdef
    from pg_indexes
    where schemaname = 'public' and tablename = 'teaching_group_memberships'
    order by indexname
    `,
  );

  await q(
    "MEMBERSHIP_CHECKS",
    `
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.teaching_group_memberships'::regclass
    order by conname
    `,
  );

  await q(
    "GROUP_RESULTS",
    `
    select
      id, name, cohort_id, gta_programme_version_id, status,
      version_review_required, tutor_name, college_days, capacity
    from public.cohort_teaching_groups
    `,
  );

  await q(
    "PIN_SUMMARY",
    `
    select
      count(*)::int as total,
      count(*) filter (where gta_programme_version_id is not null and not version_review_required)::int as auto_pinned,
      count(*) filter (where version_review_required)::int as review_required,
      count(*) filter (where version_review_required and not exists (
        select 1 from public.apprentice_programmes ap
        where ap.teaching_group_id = g.id
          and ap.status not in ('withdrawn', 'completed')
      ))::int as empty_review_required
    from public.cohort_teaching_groups g
    `,
  );

  await q(
    "MEMBERSHIP_BACKFILL",
    `
    select
      (select count(*)::int from public.apprentice_programmes where teaching_group_id is not null) as pointers,
      (select count(*)::int from public.teaching_group_memberships) as memberships,
      (select count(*)::int from public.teaching_group_memberships where is_current) as current_memberships,
      (select count(*)::int from public.teaching_group_memberships
        where source = 'legacy_backfill' and joined_at is null and is_current) as honest_legacy,
      (select count(*)::int from public.teaching_group_memberships
        where source = 'legacy_backfill' and joined_at is not null) as invented_dates
    `,
  );

  await q(
    "POINTER_MISMATCHES",
    `
    with current_m as (
      select apprentice_programme_id, teaching_group_id
      from public.teaching_group_memberships
      where is_current
    ),
    multi as (
      select apprentice_programme_id
      from public.teaching_group_memberships
      where is_current
      group by apprentice_programme_id
      having count(*) > 1
    )
    select 'pointer_without_current' as kind, ap.id
    from public.apprentice_programmes ap
    left join current_m m on m.apprentice_programme_id = ap.id
    where ap.teaching_group_id is not null and m.apprentice_programme_id is null
    union all
    select 'current_without_pointer', m.apprentice_programme_id
    from current_m m
    join public.apprentice_programmes ap on ap.id = m.apprentice_programme_id
    where ap.teaching_group_id is null
    union all
    select 'pointer_differs_from_current', ap.id
    from public.apprentice_programmes ap
    join current_m m on m.apprentice_programme_id = ap.id
    where ap.teaching_group_id is distinct from m.teaching_group_id
    union all
    select 'multiple_current', apprentice_programme_id from multi
    `,
  );

  await q(
    "COMPATIBILITY",
    `
    select
      ap.id as enrolment_id,
      a.display_name,
      ap.cohort_uuid,
      c.standard_code as cohort_code,
      c.standard_version as cohort_version,
      ap.gta_programme_version_id,
      ss.standard_code as gta_code,
      ssv.external_version as gta_version,
      g.gta_programme_version_id as group_pin,
      g.version_review_required,
      case
        when ap.gta_programme_version_id is null then 'unpinned_learner'
        when ap.cohort_uuid is null then 'learner_has_no_cohort'
        when ss.standard_code is null then 'programme_version_unresolved'
        when c.standard_code is distinct from ss.standard_code
          or c.standard_version is distinct from ssv.external_version
          then 'cohort_conflicts_with_gta_pin'
        when g.gta_programme_version_id is not null
          and g.gta_programme_version_id is distinct from ap.gta_programme_version_id
          then 'group_conflicts_with_learner_pin'
        else 'compatible'
      end as finding
    from public.apprentice_programmes ap
    left join public.apprentices a on a.id = ap.apprentice_id
    left join public.cohorts c on c.id = ap.cohort_uuid
    left join public.gta_programme_versions gpv on gpv.id = ap.gta_programme_version_id
    left join public.gta_programmes gp on gp.id = gpv.programme_id
    left join public.se_standards ss on ss.id = gp.standard_id
    left join public.se_standard_versions ssv on ssv.id = gpv.standard_version_id
    left join public.cohort_teaching_groups g on g.id = ap.teaching_group_id
    where ap.status not in ('withdrawn', 'completed')
    `,
  );

  await q(
    "GROUP_COHORT_VS_PIN",
    `
    select
      g.id,
      c.standard_code as cohort_code,
      c.standard_version as cohort_version,
      ss.standard_code as group_pin_code,
      ssv.external_version as group_pin_version
    from public.cohort_teaching_groups g
    left join public.cohorts c on c.id = g.cohort_id
    left join public.gta_programme_versions gpv on gpv.id = g.gta_programme_version_id
    left join public.gta_programmes gp on gp.id = gpv.programme_id
    left join public.se_standards ss on ss.id = gp.standard_id
    left join public.se_standard_versions ssv on ssv.id = gpv.standard_version_id
    `,
  );

  await q(
    "CAPACITY_STATUS",
    `
    select
      g.id, g.name, g.status, g.capacity, g.version_review_required,
      count(ap.id) filter (where ap.status not in ('withdrawn', 'completed'))::int as live_members
    from public.cohort_teaching_groups g
    left join public.apprentice_programmes ap on ap.teaching_group_id = g.id
    group by g.id, g.name, g.status, g.capacity, g.version_review_required
    `,
  );

  await q(
    "RELEASE_COUNTS",
    `
    select
      (select count(*)::int from public.gta_session_learning_releases) as learning_releases,
      (select count(*)::int from public.gta_session_review_releases) as review_releases,
      (select count(*)::int from public.gta_session_learning_releases
        where teaching_group_id = '7eff1889-1f7c-4b2e-b07b-483d9c71585c') as learning_with_original_group
    `,
  );

  await q(
    "ORIGINAL_GROUP_PRESERVED",
    `
    select id, name from public.cohort_teaching_groups
    where id = '7eff1889-1f7c-4b2e-b07b-483d9c71585c'
    `,
  );

  console.log("\n=== SMOKE TESTS (transaction rolled back) ===");
  await client.query("begin");
  const smoke = {};
  try {
    const pin = "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";

    const independent = await client.query(
      `
      insert into public.cohort_teaching_groups (
        name, tutor_name, college_days, capacity, notes, cohort_id,
        gta_programme_version_id, status, version_review_required
      ) values (
        'PHASE25 TEMP Independent Group',
        'PHASE25 TEMP Tutor',
        'Monday',
        2,
        'temporary phase 2.5 smoke',
        null,
        $1,
        'active',
        false
      )
      returning id, cohort_id, gta_programme_version_id, status
      `,
      [pin],
    );
    smoke.independent_create = {
      ok: independent.rows.length === 1 && independent.rows[0].cohort_id === null,
      row: independent.rows[0],
    };

    const groupB = await client.query(
      `
      insert into public.cohort_teaching_groups (
        name, tutor_name, college_days, capacity, notes, cohort_id,
        gta_programme_version_id, status, version_review_required
      ) values (
        'PHASE25 TEMP Group B',
        'PHASE25 TEMP Tutor',
        'Tuesday',
        9,
        'temporary phase 2.5 smoke',
        null,
        $1,
        'active',
        false
      )
      returning id
      `,
      [pin],
    );
    const groupAId = independent.rows[0].id;
    const groupBId = groupB.rows[0].id;

    const inactive = await client.query(
      `
      insert into public.cohort_teaching_groups (
        name, tutor_name, college_days, capacity, notes, cohort_id,
        gta_programme_version_id, status, version_review_required
      ) values (
        'PHASE25 TEMP Inactive',
        'PHASE25 TEMP Tutor',
        'Wednesday',
        9,
        'temporary phase 2.5 smoke',
        null,
        $1,
        'inactive',
        false
      )
      returning id, status
      `,
      [pin],
    );

    const full = await client.query(
      `
      insert into public.cohort_teaching_groups (
        name, tutor_name, college_days, capacity, notes, cohort_id,
        gta_programme_version_id, status, version_review_required
      ) values (
        'PHASE25 TEMP Full',
        'PHASE25 TEMP Tutor',
        'Thursday',
        1,
        'temporary phase 2.5 smoke',
        null,
        $1,
        'active',
        false
      )
      returning id, capacity
      `,
      [pin],
    );

    const mismatchGroup = await client.query(
      `
      insert into public.gta_programme_versions (
        programme_id, standard_version_id, internal_version, status
      )
      select programme_id, standard_version_id, 'PHASE25-TEMP', 'draft'
      from public.gta_programme_versions
      where id = $1
      returning id
      `,
      [pin],
    );
    const mismatchPin = mismatchGroup.rows[0].id;
    const mismatchTg = await client.query(
      `
      insert into public.cohort_teaching_groups (
        name, tutor_name, college_days, capacity, notes, cohort_id,
        gta_programme_version_id, status, version_review_required
      ) values (
        'PHASE25 TEMP Mismatch Group',
        'PHASE25 TEMP Tutor',
        'Friday',
        9,
        'temporary phase 2.5 smoke',
        null,
        $1,
        'active',
        false
      )
      returning id
      `,
      [mismatchPin],
    );

    const cohortA = await client.query(
      `
      insert into public.cohorts (
        name, programme_name, standard_code, standard_version, start_date,
        teaching_group, college_days, tutor_name, status, notes, delivery_spine, locked
      ) values (
        'PHASE25 TEMP Intake A', '', 'ST0499', '1.3', '2026-09-01',
        '', '', '', 'planned', 'phase 2.5 smoke', 'groups', false
      )
      returning id
      `,
    );
    const cohortB = await client.query(
      `
      insert into public.cohorts (
        name, programme_name, standard_code, standard_version, start_date,
        teaching_group, college_days, tutor_name, status, notes, delivery_spine, locked
      ) values (
        'PHASE25 TEMP Intake B', '', 'ST0499', '1.3', '2027-01-01',
        '', '', '', 'planned', 'phase 2.5 smoke', 'groups', false
      )
      returning id
      `,
    );

    const apprA = await client.query(
      `insert into public.apprentices (display_name, apprentice_reference, email, notes)
       values ('PHASE25 TEMP Learner A', 'PHASE25-A', 'phase25-temp-a@example.invalid', 'phase 2.5 smoke')
       returning id`,
    );
    const apprB = await client.query(
      `insert into public.apprentices (display_name, apprentice_reference, email, notes)
       values ('PHASE25 TEMP Learner B', 'PHASE25-B', 'phase25-temp-b@example.invalid', 'phase 2.5 smoke')
       returning id`,
    );
    const apprC = await client.query(
      `insert into public.apprentices (display_name, apprentice_reference, email, notes)
       values ('PHASE25 TEMP Learner C', 'PHASE25-C', 'phase25-temp-c@example.invalid', 'phase 2.5 smoke')
       returning id`,
    );

    const enrA = await client.query(
      `
      insert into public.apprentice_programmes (
        apprentice_id, programme_name, standard_code, start_date,
        original_planned_end_date, status, cohort_uuid, teaching_group_id,
        gta_programme_version_id, tutor_name, college_days, notes
      ) values (
        $1, 'PHASE25', 'ST0499', '2026-09-01', '2028-08-31', 'active',
        $2, $3, $4, 'PHASE25 TEMP Tutor', 'Monday', 'phase 2.5 smoke'
      )
      returning id, cohort_uuid, start_date, original_planned_end_date, gta_programme_version_id
      `,
      [apprA.rows[0].id, cohortA.rows[0].id, groupAId, pin],
    );
    const enrB = await client.query(
      `
      insert into public.apprentice_programmes (
        apprentice_id, programme_name, standard_code, start_date,
        original_planned_end_date, status, cohort_uuid, teaching_group_id,
        gta_programme_version_id, tutor_name, college_days, notes
      ) values (
        $1, 'PHASE25', 'ST0499', '2027-01-05', '2029-01-04', 'active',
        $2, $3, $4, 'PHASE25 TEMP Tutor', 'Monday', 'phase 2.5 smoke'
      )
      returning id, cohort_uuid
      `,
      [apprB.rows[0].id, cohortB.rows[0].id, groupAId, pin],
    );

    await client.query(
      `
      insert into public.teaching_group_memberships (
        apprentice_programme_id, teaching_group_id, joined_at, is_current, source, notes
      ) values
        ($1, $3, now(), true, 'staff', 'phase 2.5 smoke'),
        ($2, $3, now(), true, 'staff', 'phase 2.5 smoke')
      `,
      [enrA.rows[0].id, enrB.rows[0].id, groupAId],
    );

    const mixed = await client.query(
      `
      select ap.id, ap.cohort_uuid, ap.gta_programme_version_id, ap.teaching_group_id
      from public.apprentice_programmes ap
      where ap.id in ($1::uuid, $2::uuid)
      `,
      [enrA.rows[0].id, enrB.rows[0].id],
    );
    smoke.mixed_intakes = {
      ok:
        mixed.rows.length === 2 &&
        mixed.rows[0].teaching_group_id === mixed.rows[1].teaching_group_id &&
        mixed.rows[0].cohort_uuid !== mixed.rows[1].cohort_uuid &&
        mixed.rows[0].gta_programme_version_id === pin &&
        mixed.rows[1].gta_programme_version_id === pin &&
        String(enrA.rows[0].cohort_uuid) === String(cohortA.rows[0].id) &&
        String(enrB.rows[0].cohort_uuid) === String(cohortB.rows[0].id),
      rows: mixed.rows,
    };

    // Version mismatch is not a DB constraint. Record that SQL allows it.
    const mismatchInsert = await client.query(
      `
      insert into public.apprentice_programmes (
        apprentice_id, programme_name, standard_code, start_date,
        original_planned_end_date, status, teaching_group_id,
        gta_programme_version_id, notes
      ) values (
        $1, 'PHASE25', 'ST0499', '2026-09-01', '2028-08-31', 'active',
        $2, $3, 'phase 2.5 smoke mismatch'
      )
      returning id
      `,
      [apprC.rows[0].id, mismatchTg.rows[0].id, pin],
    );
    smoke.version_mismatch_db_allows = {
      ok: mismatchInsert.rows.length === 1,
      note: "Hosted SQL does not reject version mismatch; server-side placement must.",
    };

    const unpinned = await client.query(
      `
      insert into public.apprentice_programmes (
        apprentice_id, programme_name, standard_code, start_date,
        original_planned_end_date, status, teaching_group_id, notes
      ) values (
        $1, 'PHASE25', 'ST0499', '2026-09-01', '2028-08-31', 'draft',
        $2, 'phase 2.5 smoke unpinned'
      )
      returning id, gta_programme_version_id
      `,
      [apprC.rows[0].id, groupAId],
    );
    smoke.unpinned_db_allows = {
      ok: unpinned.rows[0].gta_programme_version_id === null,
      note: "Hosted SQL allows unpinned pointer; server-side placement must reject.",
    };

    const inactiveMember = await client.query(
      `
      insert into public.apprentice_programmes (
        apprentice_id, programme_name, standard_code, start_date,
        original_planned_end_date, status, teaching_group_id,
        gta_programme_version_id, notes
      ) values (
        $1, 'PHASE25', 'ST0499', '2026-09-01', '2028-08-31', 'active',
        $2, $3, 'phase 2.5 smoke inactive'
      )
      returning id
      `,
      [apprC.rows[0].id, inactive.rows[0].id, pin],
    );
    smoke.inactive_db_allows = {
      ok: inactiveMember.rows.length === 1,
      note: "Hosted SQL allows placement into inactive groups; server-side placement must reject.",
    };

    await client.query(
      `
      insert into public.apprentice_programmes (
        apprentice_id, programme_name, standard_code, start_date,
        original_planned_end_date, status, teaching_group_id,
        gta_programme_version_id, notes
      ) values (
        $1, 'PHASE25', 'ST0499', '2026-09-01', '2028-08-31', 'active',
        $2, $3, 'phase 2.5 smoke filler'
      )
      `,
      [apprC.rows[0].id, full.rows[0].id, pin],
    );
    const overCap = await client.query(
      `
      insert into public.apprentice_programmes (
        apprentice_id, programme_name, standard_code, start_date,
        original_planned_end_date, status, teaching_group_id,
        gta_programme_version_id, notes
      ) values (
        $1, 'PHASE25', 'ST0499', '2026-09-01', '2028-08-31', 'active',
        $2, $3, 'phase 2.5 smoke over cap'
      )
      returning id
      `,
      [apprA.rows[0].id, full.rows[0].id, pin],
    );
    smoke.full_db_allows = {
      ok: overCap.rows.length === 1,
      note: "Hosted SQL has no capacity trigger; server-side placement must reject unless override.",
    };

    const before = { ...enrA.rows[0] };
    await client.query(
      `
      update public.teaching_group_memberships
      set is_current = false, left_at = now()
      where apprentice_programme_id = $1 and is_current
      `,
      [enrA.rows[0].id],
    );
    await client.query(
      `
      insert into public.teaching_group_memberships (
        apprentice_programme_id, teaching_group_id, joined_at, is_current, source
      ) values ($1, $2, now(), true, 'staff')
      `,
      [enrA.rows[0].id, groupBId],
    );
    await client.query(
      `
      update public.apprentice_programmes
      set teaching_group_id = $2
      where id = $1
      `,
      [enrA.rows[0].id, groupBId],
    );
    const after = await client.query(
      `
      select
        ap.teaching_group_id,
        ap.cohort_uuid,
        ap.start_date,
        ap.original_planned_end_date,
        ap.gta_programme_version_id,
        (select count(*)::int from public.teaching_group_memberships
          where apprentice_programme_id = ap.id and is_current) as current_count,
        (select left_at is not null from public.teaching_group_memberships
          where apprentice_programme_id = ap.id and teaching_group_id = $2
          order by recorded_at desc limit 1) as old_left_at_set,
        (select teaching_group_id from public.teaching_group_memberships
          where apprentice_programme_id = ap.id and is_current) as current_group
      from public.apprentice_programmes ap
      where ap.id = $1
      `,
      [enrA.rows[0].id, groupAId],
    );
    const t = after.rows[0];
    smoke.transfer = {
      ok:
        String(t.teaching_group_id) === String(groupBId) &&
        String(t.current_group) === String(groupBId) &&
        t.current_count === 1 &&
        t.old_left_at_set === true &&
        String(t.cohort_uuid) === String(before.cohort_uuid) &&
        String(t.gta_programme_version_id) === String(before.gta_programme_version_id) &&
        String(t.start_date) === String(before.start_date) &&
        String(t.original_planned_end_date) === String(before.original_planned_end_date),
      row: t,
    };

    let uniqueRejected = false;
    try {
      await client.query(
        `
        insert into public.teaching_group_memberships (
          apprentice_programme_id, teaching_group_id, is_current, source
        ) values ($1, $2, true, 'staff')
        `,
        ["a58f3062-cb5e-4614-8e24-92ea27d38875", groupAId],
      );
    } catch (err) {
      uniqueRejected = err.code === "23505";
      smoke.one_current_constraint = {
        ok: uniqueRejected,
        code: err.code,
        message: err.message,
      };
    }
    if (!uniqueRejected && !smoke.one_current_constraint) {
      smoke.one_current_constraint = {
        ok: false,
        note: "Duplicate current membership insert did not fail",
      };
    }
  } catch (err) {
    smoke.fatal = { message: err.message, code: err.code };
  } finally {
    await client.query("rollback");
    console.log("SMOKE_ROLLED_BACK");
  }

  console.log("SMOKE_RESULTS", JSON.stringify(smoke, null, 2));

  await q(
    "POST_SMOKE_GROUP_COUNT",
    `select count(*)::int as total from public.cohort_teaching_groups`,
  );
  await q(
    "POST_SMOKE_RELEASES",
    `
    select
      (select count(*)::int from public.gta_session_learning_releases) as learning_releases,
      (select count(*)::int from public.gta_session_review_releases) as review_releases
    `,
  );
} finally {
  await client.end();
}
