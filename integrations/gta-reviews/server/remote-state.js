import { mergeLearnerRecords, mergePreservedPlanLocks } from "../src/plan-locks.js";
import { supabaseAdmin } from "./supabase-admin.js";

export const STATE_BUCKET = "review-app";
export const STATE_PATH = "state.json";
export const ATTACH_BUCKET = "review-attachments";

export function peopleCount(state) {
  return (
    (state?.learners?.length || 0) +
    (state?.followUps?.length || 0) +
    (state?.archive?.length || 0)
  );
}

// A present app_state payload wins, even when it lists fewer people than
// Storage or SQLite. Those copies are only used when app_state has no row.
export function authoritativeState(appPayload, fileState, local) {
  if (appPayload != null) return appPayload;
  if (fileState != null) return fileState;
  return local ?? null;
}

export function preferRicherState(a, b) {
  if (!a) return b;
  if (!b) return a;
  const aPeople = peopleCount(a);
  const bPeople = peopleCount(b);
  let winner;
  if (aPeople !== bPeople) winner = aPeople > bPeople ? a : b;
  else {
    const aTime = Date.parse(a.savedAt || "") || 0;
    const bTime = Date.parse(b.savedAt || "") || 0;
    if (aTime !== bTime) winner = aTime > bTime ? a : b;
    else {
      winner =
        (a.savedReviews?.length || 0) >= (b.savedReviews?.length || 0) ? a : b;
    }
  }
  const loser = winner === a ? b : a;
  mergePreservedPlanLocks(winner, loser);
  return mergeLearnerRecords(winner, loser) || winner;
}

export async function ensureBuckets(client) {
  for (const id of [STATE_BUCKET, ATTACH_BUCKET]) {
    const { data } = await client.storage.getBucket(id);
    if (data) continue;
    const { error } = await client.storage.createBucket(id, {
      public: false,
      fileSizeLimit: id === STATE_BUCKET ? 50 * 1024 * 1024 : 25 * 1024 * 1024,
    });
    if (error && !/already exists/i.test(error.message || "")) throw error;
  }
}

export async function readRemoteState(client = supabaseAdmin().client) {
  const { data, error } = await client.storage.from(STATE_BUCKET).download(STATE_PATH);
  if (error || !data) return null;
  const text = await data.text();
  return text ? JSON.parse(text) : null;
}

export async function writeRemoteState(state, client = supabaseAdmin().client) {
  const bytes = Buffer.from(JSON.stringify(state), "utf8");
  const { error } = await client.storage.from(STATE_BUCKET).upload(STATE_PATH, bytes, {
    upsert: true,
    contentType: "application/json",
    cacheControl: "0",
  });
  if (error) throw error;
}

