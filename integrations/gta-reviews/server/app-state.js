import { savePayload } from "./db.js";
import { supabaseAdmin } from "./supabase-admin.js";
import { writeRemoteState } from "./remote-state.js";
import { onVercel } from "./runtime.js";
import { logClientError } from "../shared/log-error.js";
import { APP_BUILD, isOutdatedBuild } from "../shared/app-build.js";

export { APP_BUILD, isOutdatedBuild };

export function outdatedBuildBody() {
  return {
    error: "This tab is out of date. Reload the page before saving.",
    code: "outdated-build",
    appBuild: APP_BUILD,
  };
}

const STAMP_KEYS = ["savedAt", "baseSavedAt", "version", "appBuild"];

function stableValue(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableValue(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function sameSavedContent(left, right) {
  if (!left || !right) return false;
  const strip = (state) => {
    const copy = { ...state };
    for (const key of STAMP_KEYS) delete copy[key];
    return copy;
  };
  return stableValue(strip(left)) === stableValue(strip(right));
}

// Matches save_app_state_if_version: missing, non-numeric, and non-positive
// versions (including 0 and "0") compare as 1.
export function versionOf(payload) {
  const text = payload?.version == null ? "" : String(payload.version);
  if (!/^\d+$/.test(text)) return 1;
  const version = Number(text);
  return version > 0 ? version : 1;
}

export function conflictBody(clientVersion, storedVersion, stored) {
  return {
    error: "Version conflict",
    clientVersion,
    storedVersion,
    state: stored || null,
    message: "Data was modified elsewhere. Please reload and try again.",
  };
}

export async function readAppStatePayload() {
  const { client } = supabaseAdmin();
  const result = await client.from("app_state").select("payload").eq("id", "default").maybeSingle();
  if (result?.error) throw result.error;
  return { client, payload: result?.data?.payload || null };
}

export function verifiedActorId(value) {
  const id = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

function rpcMissesActor(error) {
  const code = String(error?.code || "");
  return code === "PGRST202" || code === "PGRST203";
}

// The new server sends actor_id. If the database still has only the
// two-argument function, PostgREST reports PGRST202 and this retries
// without actor_id so a deploy before the migration still saves.
async function saveAppStateIfVersion(client, expectedVersion, nextPayload, actorId) {
  const result = await client.rpc("save_app_state_if_version", {
    expected_version: expectedVersion,
    next_payload: nextPayload,
    actor_id: verifiedActorId(actorId),
  });
  if (rpcMissesActor(result?.error)) {
    const again = await client.rpc("save_app_state_if_version", {
      expected_version: expectedVersion,
      next_payload: nextPayload,
    });
    if (again?.error) throw again.error;
    return Number(again?.data) || 0;
  }
  if (result?.error) throw result.error;
  return Number(result?.data) || 0;
}

// app_state first (conditional update), then Storage, then SQLite on the desktop.
// Once app_state has committed, a Storage mirror failure is retried once and
// then reported as warning: true with HTTP 200. The client must adopt the new
// version; a 500 here would leave it on the old version and 409 its own edit.
// The thrown error is not logged: Storage client errors can include bucket
// policy text. Vercel has no local database. A desktop SQLite failure after
// the remote steps is also warning: true and is not a 500.
async function writeStorageMirror(state, client) {
  try {
    await writeRemoteState(state, client);
    return true;
  } catch (error) {
    try {
      await writeRemoteState(state, client);
      return true;
    } catch (retryError) {
      logClientError("Failed to save storage state.", {
        code: retryError?.code || error?.code,
        route: "/api/state",
      });
      return false;
    }
  }
}

export async function commitVersionedState(state, expectedVersion, { preserveLocks = true, actorId = null } = {}) {
  const { client } = supabaseAdmin();
  let updated = 0;
  try {
    updated = await saveAppStateIfVersion(client, expectedVersion, state, actorId);
  } catch (error) {
    logClientError("Failed to save app_state.", {
      status: 500,
      code: error?.code,
      route: "/api/state",
    });
    const failure = new Error("Failed to save.");
    failure.status = 500;
    throw failure;
  }
  if (updated < 1) {
    const conflict = new Error("Version conflict");
    conflict.status = 409;
    throw conflict;
  }
  const mirrored = await writeStorageMirror(state, client);
  if (onVercel()) return { warning: !mirrored };
  try {
    savePayload(state, { preserveLocks });
  } catch (error) {
    logClientError("Failed to save SQLite state.", {
      status: error?.status,
      code: error?.code,
      route: "/api/state",
    });
    return { warning: true };
  }
  return { warning: !mirrored };
}
