/**
 * Emit Autocare Groups Course Builder forms as upsert SQL (no DB connection).
 * Run: node --experimental-strip-types scripts/generate-autocare-forms-sql.ts
 */

import fs from "fs";
import path from "path";
import {
  buildAutocareGroupsSeedFormsForPack,
  listAutocareGroupsSeedTaskIds,
} from "../src/features/programme-delivery/domain/autocare-groups-forms";

const PACK_IDS = [
  "cea-autocare-st0499-v1.3",
  "cea-autocare-st0499-v1.2",
  "cea-autocare-st0499-v1.1",
];

function sqlString(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

const lines: string[] = [];
lines.push("-- Generated Autocare Groups learner forms for Course Builder");
lines.push("-- Do not edit by hand; regenerate via scripts/generate-autocare-forms-sql.ts");
lines.push("");

let count = 0;
for (const packId of PACK_IDS) {
  const forms = buildAutocareGroupsSeedFormsForPack(packId);
  for (const [key, form] of Object.entries(forms)) {
    const taskId = key.split("::")[1]!;
    lines.push(`insert into public.course_pack_task_forms (`);
    lines.push(`  pack_id, task_id, title, scenario, status, modules`);
    lines.push(`) values (`);
    lines.push(`  ${sqlString(packId)},`);
    lines.push(`  ${sqlString(taskId)},`);
    lines.push(`  ${sqlString(form.title)},`);
    lines.push(`  ${sqlString(form.scenario)},`);
    lines.push(`  ${sqlString(form.status ?? "pending")},`);
    lines.push(`  ${sqlJson(form.modules)}`);
    lines.push(`)`);
    lines.push(`on conflict (pack_id, task_id) do update set`);
    lines.push(`  title = excluded.title,`);
    lines.push(`  scenario = excluded.scenario,`);
    lines.push(`  status = excluded.status,`);
    lines.push(`  modules = excluded.modules,`);
    lines.push(`  updated_at = now();`);
    lines.push("");
    count += 1;
  }
}

lines.push(
  `-- Seeded ${count} forms (${listAutocareGroupsSeedTaskIds().length} tasks × ${PACK_IDS.length} pack versions).`,
);

const outDir = path.resolve("supabase/seeds");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "autocare-groups-forms.sql");
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${outPath} (${count} upserts)`);
