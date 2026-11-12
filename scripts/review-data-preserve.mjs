import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const TABLES = [
  "public.app_state",
  "public.app_state_history",
  "public.tutor_reword_rate",
  "public.review_assistant_attachments",
  "public.staff_page_access",
];

function refuseRemote(databaseUrl) {
  const text = String(databaseUrl || "");
  const blocked = ["cjtgjxgghfiskqnuttzd", "gzeeofbhcgbgcbykdvez", "supabase.co", "supabase.com"];
  for (const name of blocked) {
    if (text.includes(name)) {
      throw new Error(`Refusing ${name}. This script is for a disposable local database only.`);
    }
  }
  const local = /@(127\.0\.0\.1|localhost)(?::|\/|$)/.test(text) || text.includes("host=/var/run/postgresql");
  if (!local) throw new Error("Refusing a database URL that is not on localhost.");
}

async function existingTables(client) {
  const found = [];
  for (const table of TABLES) {
    const result = await client.query("select to_regclass($1) as name", [table]);
    if (result.rows[0]?.name) found.push(table);
  }
  return found;
}

export async function backupReviewData(databaseUrl, outDir) {
  refuseRemote(databaseUrl);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const tables = await existingTables(client);
    const payload = { tables: {} };
    for (const table of tables) {
      const rows = await client.query(`select * from ${table}`);
      payload.tables[table] = rows.rows;
    }
    mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, "review-data.json");
    writeFileSync(file, JSON.stringify(payload));
    return { file, counts: Object.fromEntries(tables.map((table) => [table, payload.tables[table].length])) };
  } finally {
    await client.end();
  }
}

export async function restoreReviewData(databaseUrl, outDir) {
  refuseRemote(databaseUrl);
  const payload = JSON.parse(readFileSync(path.join(outDir, "review-data.json"), "utf8"));
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("begin");
    for (const [table, rows] of Object.entries(payload.tables)) {
      const present = await client.query("select to_regclass($1) as name", [table]);
      if (!present.rows[0]?.name) throw new Error(`${table} is missing from the restore database.`);
      const count = await client.query(`select count(*)::int as count from ${table}`);
      if (count.rows[0].count !== 0) throw new Error(`${table} is not empty. Restore refuses to overwrite rows.`);
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = columns.map((column) => row[column]);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        await client.query(
          `insert into ${table} (${columns.map((column) => `"${column}"`).join(", ")}) values (${placeholders})`,
          values,
        );
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

const command = process.argv[2];
const databaseUrl = process.argv[3];
const directory = process.argv[4];
if (command === "backup") {
  const result = await backupReviewData(databaseUrl, directory);
  console.log(JSON.stringify(result));
} else if (command === "restore") {
  await restoreReviewData(databaseUrl, directory);
  console.log(JSON.stringify({ restored: true }));
}
