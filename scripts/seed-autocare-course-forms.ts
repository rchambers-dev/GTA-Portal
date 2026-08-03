/**
 * Upsert Autocare Groups Course Builder forms via service role.
 * Requires public.course_pack_task_forms (migration 009).
 *
 * Run: node --experimental-strip-types scripts/seed-autocare-course-forms.ts
 */

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  buildAutocareGroupsSeedFormsForPack,
  listAutocareGroupsSeedTaskIds,
} from "../src/features/programme-delivery/domain/autocare-groups-forms.ts";

function loadEnvLocal() {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, i).trim()] = value;
  }
  return out;
}

const PACK_IDS = [
  "cea-autocare-st0499-v1.3",
  "cea-autocare-st0499-v1.2",
  "cea-autocare-st0499-v1.1",
];

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const probe = await supabase.from("course_pack_task_forms").select("id").limit(1);
if (probe.error) {
  throw new Error(
    `course_pack_task_forms not available (${probe.error.message}). Apply supabase/migrations/009_course_builder_forms.sql first.`,
  );
}

const rows = [];
for (const packId of PACK_IDS) {
  const forms = buildAutocareGroupsSeedFormsForPack(packId);
  for (const [key, form] of Object.entries(forms)) {
    const taskId = key.split("::")[1]!;
    rows.push({
      pack_id: packId,
      task_id: taskId,
      title: form.title,
      scenario: form.scenario,
      status: form.status ?? "pending",
      modules: form.modules,
    });
  }
}

const chunkSize = 40;
let upserted = 0;
for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize);
  const { error } = await supabase.from("course_pack_task_forms").upsert(chunk, {
    onConflict: "pack_id,task_id",
  });
  if (error) throw new Error(error.message);
  upserted += chunk.length;
  console.log(`Upserted ${upserted}/${rows.length}`);
}

const { count, error: countErr } = await supabase
  .from("course_pack_task_forms")
  .select("*", { count: "exact", head: true })
  .like("pack_id", "cea-autocare-st0499-%");

if (countErr) throw new Error(countErr.message);

console.log(
  `Done. Autocare form rows in DB: ${count}. Tasks per pack: ${listAutocareGroupsSeedTaskIds().length}.`,
);
