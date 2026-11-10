import { logClientError } from "../shared/log-error.js";
import { allowPasswordChange } from "./reword-rate.js";
import { sendPreflight } from "./cors.js";
import { staffRole } from "./roles.js";
import { supabaseAdmin, supabaseAuthClient } from "./supabase-admin.js";

const STAFF_ROLES = new Set(["office", "admin", "tutor"]);

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === "string") return Promise.resolve(parseJson(req.body));
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(parseJson(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function parseJson(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw httpError("Invalid JSON.", 400);
  }
}

async function requireStaff(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw httpError("Authentication required.", 401);
  const { client } = supabaseAdmin();
  const { data, error: authError } = await client.auth.getUser(token);
  if (authError || !data?.user) throw httpError("Invalid or expired token.", 401);
  const role = staffRole(data.user);
  if (!STAFF_ROLES.has(role)) throw httpError("Access denied. Staff role required.", 403);
  return { client, user: data.user };
}

// Verifies the current password, then sets the new password and the server
// flag together. The flag is not written unless that password update runs.
export async function changeStaffPassword(client, user, body) {
  const current = String(body?.currentPassword || "");
  const next = String(body?.nextPassword || "");
  if (!current || !next) throw httpError("Current and new passwords are required.", 400);
  if (next.length < 8) throw httpError("Use at least 8 characters for the new password.", 400);
  if (next === current) throw httpError("Pick a new password, not the one you were given.", 400);

  await allowPasswordChange(user.id);

  const email = String(user.email || "").trim();
  const checker = supabaseAuthClient();
  let opened = false;
  try {
    const check = await checker.auth.signInWithPassword({ email, password: current });
    if (check?.error) throw httpError("Current password is wrong.", 400);
    opened = true;

    const appMetadata = { ...(user.app_metadata || {}), password_changed: true };
    const { data, error } = await client.auth.admin.updateUserById(user.id, {
      password: next,
      app_metadata: appMetadata,
    });
    if (error) {
      const failure = httpError("Could not record the password change.", 500);
      failure.code = error.code;
      throw failure;
    }
    return data?.user || { ...user, app_metadata: appMetadata };
  } finally {
    if (opened) {
      await checker.auth.signOut({ scope: "local" }).catch(() => {});
    }
  }
}

export async function handlePasswordChanged(req, res) {
  if (req.method === "OPTIONS") {
    sendPreflight(res);
    return;
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }
  try {
    const { client, user } = await requireStaff(req);
    const body = await readBody(req);
    await changeStaffPassword(client, user, body);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    logClientError("Password change flag failed.", {
      status: error?.status || 500,
      code: error?.code,
      route: "/api/password-changed",
    });
    const status = error.status || 500;
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      error: status === 401 || status === 403 || status === 400 || status === 429
        ? error.message
        : "Could not record the password change.",
    }));
  }
}
