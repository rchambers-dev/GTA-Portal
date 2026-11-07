import { supabaseAdmin } from "../server/supabase-admin.js";
import { logClientError } from "../shared/log-error.js";
import { sendPreflight } from "../server/cors.js";
import { staffRole } from "../server/roles.js";
import { handleStateApi } from "../server/state-route.js";

const OFFICE_ROLES = new Set(["admin", "office"]);

async function requireOffice(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }

  try {
    const { client } = supabaseAdmin();
    const { data, error: authError } = await client.auth.getUser(token);

    if (authError || !data?.user) {
      const error = new Error("Invalid or expired token.");
      error.status = 401;
      throw error;
    }

    const role = staffRole(data.user);
    if (role === "tutor") {
      const error = new Error("Access denied. Tutors must use /api/tutor-state.");
      error.status = 403;
      throw error;
    }
    if (!OFFICE_ROLES.has(role)) {
      const error = new Error("Access denied. Admin or office role required.");
      error.status = 403;
      throw error;
    }

    return { user: data.user, role };
  } catch (error) {
    if (error.status) throw error;
    const authError = new Error("Authentication failed.");
    authError.status = 401;
    throw authError;
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    sendPreflight(res);
    return;
  }
  try {
    const { user } = await requireOffice(req);
    await handleStateApi(req, res, { actorId: user.id });
  } catch (error) {
    logClientError("State request failed.", {
      status: error?.status || 500,
      code: error?.code,
      route: "/api/state",
    });
    if (!res.writableEnded) {
      const status = error.status || 500;
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error:
            status === 401 || status === 403 || status === 400
              ? error.message
              : "An error occurred.",
        }),
      );
    }
  }
}
