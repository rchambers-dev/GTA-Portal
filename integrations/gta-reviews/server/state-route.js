import { loadPayload } from "./db.js";
import {
  commitVersionedState,
  conflictBody,
  isOutdatedBuild,
  outdatedBuildBody,
  readAppStatePayload,
  sameSavedContent,
  verifiedActorId,
  versionOf,
} from "./app-state.js";
import { supabaseAdmin } from "./supabase-admin.js";
import { authoritativeState, readRemoteState } from "./remote-state.js";
import { onVercel } from "./runtime.js";
import { logClientError } from "../shared/log-error.js";
import {
  applyNewerPlanSnapshot,
  mergeLearnerRecords,
  mergePreservedPlanLocks,
} from "../src/plan-locks.js";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function sendError(res, error) {
  const status = error.status || 500;
  logClientError("API error", { status, code: error?.code, route: "/api/state" });
  const clientMessage =
    status === 401 || status === 403 || status === 400 || status === 409 || status === 429
      ? error.message
      : "An error occurred.";
  sendJson(res, status, { error: clientMessage });
}

// Vercel may already have parsed JSON onto req.body. The desktop server
// leaves the body on the request stream. Read whichever one is present.
function readJsonBody(req) {
  const existing = req.body;
  if (existing != null && existing !== "") {
    if (typeof existing === "string" || Buffer.isBuffer(existing)) {
      const raw = Buffer.isBuffer(existing) ? existing.toString("utf8") : existing;
      return Promise.resolve(raw ? JSON.parse(raw) : {});
    }
    if (typeof existing === "object") return Promise.resolve(existing);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function localPayload() {
  if (onVercel()) return null;
  return loadPayload();
}

// Shared by the desktop local server and the Vercel api/state.js function.
// Callers that need a JWT check it before invoking this. actorId is the
// verified user id from that check. The desktop server has no JWT, so it
// passes nothing. The request body is never the source of this id.
export async function handleStateApi(req, res, { actorId = null } = {}) {
  const verifiedActor = verifiedActorId(actorId);
  try {
    if (req.method === "GET") {
      const local = localPayload();
      let state = null;
      try {
        const { client } = supabaseAdmin();
        const fileState = await readRemoteState(client);
        const { data, error } = await client.from("app_state").select("payload").eq("id", "default").maybeSingle();
        if (error) throw error;
        state = authoritativeState(data?.payload ?? null, fileState, local);
      } catch (error) {
        logClientError("Failed to read remote state.", {
          status: 503,
          code: error?.code,
          route: "/api/state",
        });
        sendJson(res, 503, { error: "Could not read the stored state. Try again." });
        return;
      }
      sendJson(res, 200, { state });
      return;
    }
    if (req.method === "PUT" || req.method === "POST") {
      const state = await readJsonBody(req);
      const clientBuild = state.appBuild;
      delete state.appBuild;
      if (isOutdatedBuild(clientBuild)) {
        sendJson(res, 426, outdatedBuildBody());
        return;
      }
      const existing = localPayload();
      let stored = null;

      try {
        const read = await readAppStatePayload();
        stored = read.payload;
      } catch (error) {
        logClientError("Failed to load stored state for version check.", {
          status: 503,
          code: error?.code,
          route: "/api/state",
        });
        sendJson(res, 503, { error: "Could not read the stored state. Try again." });
        return;
      }

      const clientVersion = Number(state.version) || 1;
      const storedVersion = versionOf(stored);

      if (clientVersion !== storedVersion) {
        sendJson(res, 409, conflictBody(clientVersion, storedVersion, stored));
        return;
      }

      const base = Date.parse(state.baseSavedAt || "") || 0;
      const storedTime = Date.parse(stored?.savedAt || "") || 0;
      const stale = Boolean(base && stored && storedTime > base);
      if (stale) applyNewerPlanSnapshot(state, stored);
      else {
        mergePreservedPlanLocks(state, existing);
        mergeLearnerRecords(state, existing, stored);
      }

      if (stored && sameSavedContent(state, stored)) {
        sendJson(res, 200, {
          ok: true,
          unchanged: true,
          version: storedVersion,
          savedAt: stored.savedAt || "",
        });
        return;
      }

      state.version = storedVersion + 1;
      state.savedAt = new Date().toISOString();

      let committed;
      try {
        committed = await commitVersionedState(state, clientVersion, {
          preserveLocks: !stale,
          actorId: verifiedActor,
        });
      } catch (error) {
        if (error.status === 409) {
          let latest = stored;
          let latestVersion = storedVersion;
          try {
            const again = await readAppStatePayload();
            if (again.payload) {
              latest = again.payload;
              latestVersion = versionOf(again.payload);
            }
          } catch (readError) {
            logClientError("Failed to reread app_state after conflict.", {
              status: readError?.status,
              code: readError?.code,
              route: "/api/state",
            });
          }
          sendJson(res, 409, conflictBody(clientVersion, latestVersion, latest));
          return;
        }
        logClientError("Failed to save state.", {
          status: error?.status,
          code: error?.code,
          route: "/api/state",
        });
        sendJson(res, error.status || 500, { error: "Failed to save." });
        return;
      }

      const body = { ok: true, version: state.version, savedAt: state.savedAt };
      if (committed?.warning) body.warning = true;
      sendJson(res, 200, body);
      return;
    }
    res.statusCode = 405;
    res.end();
  } catch (error) {
    sendError(res, error);
  }
}
