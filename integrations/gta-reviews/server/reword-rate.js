import { logClientError } from "../shared/log-error.js";
import { supabaseAdmin } from "./supabase-admin.js";

const WINDOW_MS = 60 * 1000;
const MAX_HITS = 10;
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const memoryCounts = new Map();

export function resetRewordMemory() {
  memoryCounts.clear();
}

function limitError() {
  const error = new Error("Rate limit exceeded. Please try again later.");
  error.status = 429;
  return error;
}

function checkMemoryLimit(key, maxHits = MAX_HITS, windowMs = WINDOW_MS) {
  const now = Date.now();
  const entry = memoryCounts.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count += 1;
    if (entry.count > maxHits) throw limitError();
  }
  memoryCounts.set(key, entry);
}

function bucketStart(windowMs) {
  return new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
}

// Counts one reword for this user. A shared database count is used for a
// real user id. Anything else, including a store error, uses the in-memory
// count so one process still has a limit.
export async function allowReword(userId) {
  const id = String(userId || "").trim();
  if (!USER_ID.test(id)) {
    checkMemoryLimit(id || "desktop");
    return;
  }
  try {
    const { client } = supabaseAdmin();
    const result = await client.rpc("rate_limit_hit", {
      actor_id: id,
      bucket_key: "reword",
      bucket_start: bucketStart(WINDOW_MS),
      max_hits: MAX_HITS,
    });
    if (result?.error) throw result.error;
    if (result?.data !== true) throw limitError();
  } catch (error) {
    if (error?.status === 429) throw error;
    logClientError("Tutor reword rate limit store failed. Using the in-memory limit.", {
      status: 500,
      code: error?.code,
      route: "/api/tutor-reword",
    });
    checkMemoryLimit(id);
  }
}

const PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const PASSWORD_MAX_HITS = 5;
const PASSWORD_KEY = "password-changed";

// Password guesses do not share tutor reword's counter. Five tries in
// fifteen minutes, then the same 429. The database row is keyed by
// bucket_key so a reword in the same minute is a different count.
export async function allowPasswordChange(userId) {
  const id = String(userId || "").trim();
  const memoryKey = `${PASSWORD_KEY}:${id || "desktop"}`;
  if (!USER_ID.test(id)) {
    checkMemoryLimit(memoryKey, PASSWORD_MAX_HITS, PASSWORD_WINDOW_MS);
    return;
  }
  try {
    const { client } = supabaseAdmin();
    const result = await client.rpc("rate_limit_hit", {
      actor_id: id,
      bucket_key: PASSWORD_KEY,
      bucket_start: bucketStart(PASSWORD_WINDOW_MS),
      max_hits: PASSWORD_MAX_HITS,
    });
    if (result?.error) throw result.error;
    if (result?.data !== true) throw limitError();
  } catch (error) {
    if (error?.status === 429) throw error;
    logClientError("Password change rate limit store failed. Using the in-memory limit.", {
      status: 500,
      code: error?.code,
      route: "/api/password-changed",
    });
    checkMemoryLimit(memoryKey, PASSWORD_MAX_HITS, PASSWORD_WINDOW_MS);
  }
}
