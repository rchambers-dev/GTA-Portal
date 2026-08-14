/**
 * Dump controlled programme resources + attachments for ZIP reconciliation.
 * Read-only.
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

const { data: resources, error: rErr } = await sb
  .from("gta_programme_resources")
  .select(
    "id, resource_key, title, filename, source_path, evidence_resource_id, extract_path, metadata",
  )
  .eq("programme_version_id", VID);
if (rErr) throw new Error(rErr.message);

const { data: attachments, error: aErr } = await sb
  .from("gta_programme_resource_attachments")
  .select(
    "id, resource_id, session_id, spine_item_id, role, audience, sort_order, metadata",
  )
  .eq("programme_version_id", VID);
if (aErr) throw new Error(aErr.message);

const { data: sessions } = await sb
  .from("gta_programme_sessions")
  .select("id, session_key, title, calendar_week")
  .eq("programme_version_id", VID);

const sessById = Object.fromEntries((sessions || []).map((s) => [s.id, s]));

const dump = {
  resourceCount: (resources || []).length,
  attachmentCount: (attachments || []).length,
  resources: (resources || []).map((r) => ({
    ...r,
    attachments: (attachments || [])
      .filter((a) => a.resource_id === r.id)
      .map((a) => ({
        ...a,
        sessionKey: sessById[a.session_id]?.session_key || null,
        sessionTitle: sessById[a.session_id]?.title || null,
      })),
  })),
};

fs.mkdirSync(".tmp/source-pack-inventory", { recursive: true });
fs.writeFileSync(
  ".tmp/source-pack-inventory/controlled-resources.json",
  JSON.stringify(dump, null, 2),
);
console.log(
  JSON.stringify(
    {
      ok: true,
      resourceCount: dump.resourceCount,
      attachmentCount: dump.attachmentCount,
      filenames: dump.resources.map((r) => ({
        id: r.id,
        key: r.resource_key,
        filename: r.filename,
        sourcePath: r.source_path,
        sessions: r.attachments.map((a) => `${a.sessionKey || "unplaced"}:${a.audience}`),
      })),
    },
    null,
    2,
  ),
);
