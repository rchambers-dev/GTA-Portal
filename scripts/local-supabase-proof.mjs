import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
const status = JSON.parse(readFileSync("/tmp/supabase-native-start.json", "utf8"));
const apiUrl = status.env.API_URL;
const dbUrl = status.env.DB_URL;
const serviceKey = status.env.SERVICE_ROLE_KEY;
for (const value of [apiUrl, dbUrl]) {
  if (!String(value).includes("127.0.0.1")) throw new Error("Local stack URL is not loopback.");
  if (String(value).includes("cjtgjxgghfiskqnuttzd") || String(value).includes("gzeeofbhcgbgcbykdvez")) {
    throw new Error("Refusing a hosted project URL.");
  }
}
if (status.runtime !== "native") throw new Error(`Expected native runtime, got ${status.runtime}`);

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
await client.query("create table if not exists public.profiles (id uuid primary key)");
await client.query("create table if not exists public.apprentices (id uuid primary key)");
for (const file of [
  "supabase/migrations/035_review_assistant_store.sql",
  "supabase/migrations/036_review_assistant_portal.sql",
]) {
  await client.query(readFileSync(path.join(root, file), "utf8"));
}
await client.end();

const supabase = createClient(apiUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const hidden = await supabase.schema("reviews_private").rpc("save_app_state_if_version", {
  expected_version: 1,
  next_payload: { version: 2 },
  actor_id: null,
});
if (!hidden.error) throw new Error("reviews_private was callable through PostgREST.");

const saved = await supabase.rpc("save_app_state_if_version", {
  expected_version: 1,
  next_payload: { version: 2, learners: [{ id: "review-learner-42", name: "Synthetic Fixture Learner" }] },
  actor_id: null,
});
if (saved.error || saved.data !== 1) throw new Error(saved.error?.message || "public RPC did not save");
const again = await supabase.rpc("save_app_state_if_version", {
  expected_version: 1,
  next_payload: { version: 2, learners: [] },
  actor_id: null,
});
if (again.error || again.data !== 0) throw new Error("stale public RPC was not rejected");

const history = await supabase.from("app_state_history").select("version").order("version");
if (history.error || history.data?.[0]?.version !== 2) throw new Error(history.error?.message || "history missing");

async function uploadBound(id, learnerId, bytes) {
  const uploaded = await supabase.storage.from("review-attachments").upload(id, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploaded.error) throw new Error(uploaded.error.message);
  const inserted = await supabase.from("review_assistant_attachments").insert({
    id,
    review_learner_id: learnerId,
    portal_apprentice_id: null,
    actor_id: null,
    filename: `${id}.pdf`,
    content_type: "application/pdf",
    size_bytes: bytes.length,
    storage_bucket: "review-attachments",
    storage_path: id,
  });
  if (inserted.error) {
    const removed = await supabase.storage.from("review-attachments").remove([id]);
    if (removed.error) throw new Error(`metadata failed and object ${id} needs reconciliation`);
    throw new Error(inserted.error.message);
  }
}
const firstId = "synthetic-fixture.pdf";
const otherId = "other-fixture.pdf";
await uploadBound(firstId, "review-learner-42", Buffer.from("%PDF-1.4 synthetic"));
await uploadBound(otherId, "review-learner-other", Buffer.from("%PDF-1.4 other"));
const downloaded = await supabase.storage.from("review-attachments").download(firstId);
if (downloaded.error) throw new Error(downloaded.error.message);
const bytes = Buffer.from(await downloaded.data.arrayBuffer());
if (!bytes.includes("synthetic")) throw new Error("downloaded bytes did not match the first learner");
const bindings = await supabase
  .from("review_assistant_attachments")
  .select("review_learner_id, storage_path")
  .in("review_learner_id", ["review-learner-42", "review-learner-other"]);
if (bindings.error || bindings.data?.length !== 2) throw new Error(bindings.error?.message || "bindings missing");

const orphanId = "orphan-fixture.pdf";
const orphanUpload = await supabase.storage.from("review-attachments").upload(orphanId, Buffer.from("%PDF-1.4 orphan"), {
  contentType: "application/pdf",
  upsert: false,
});
if (orphanUpload.error) throw new Error(orphanUpload.error.message);
const removed = await supabase.storage.from("review-attachments").remove([orphanId]);
if (removed.error) throw new Error(removed.error.message);
const leftover = await supabase.storage.from("review-attachments").download(orphanId);
if (!leftover.error) throw new Error("orphaned storage object was not removed");

console.log(JSON.stringify({
  runtime: status.runtime,
  api: apiUrl,
  rpc: "public.save_app_state_if_version",
  privateSchemaBlocked: true,
  historyVersion: history.data[0].version,
  learners: bindings.data.map((row) => row.review_learner_id),
  compensationRemoved: orphanId,
}));
