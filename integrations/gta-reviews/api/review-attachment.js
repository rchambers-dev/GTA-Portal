import { handleReviewApi } from "../server/api.js";
import { logClientError } from "../shared/log-error.js";
import { supabaseAdmin } from "../server/supabase-admin.js";
import { sendPreflight } from "../server/cors.js";
import { staffRole } from "../server/roles.js";

const STAFF_ROLES = ["office", "admin", "tutor"];

async function requireStaff(req) {
  const authHeader = req.headers.authorization || "";
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
    if (!role || !STAFF_ROLES.includes(role)) {
      const error = new Error("Access denied. Staff role required.");
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

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    sendPreflight(res);
    return;
  }
  try {
    const { user, role } = await requireStaff(req);
    
    const url = new URL(req.url || "/api/review-attachment", "http://127.0.0.1");
    if (!url.pathname.startsWith("/api/review-attachment")) {
      url.pathname = "/api/review-attachment";
      req.url = `${url.pathname}${url.search}`;
    }
    const handled = await handleReviewApi(req, res, { user, role });
    if (!handled && !res.writableEnded) {
      res.statusCode = 404;
      res.end();
    }
  } catch (error) {
    logClientError("Review attachment request failed.", {
      status: error?.status || 500,
      code: error?.code,
      route: "/api/review-attachment",
    });
    if (!res.writableEnded) {
      const status = error.status || 500;
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: status === 401 || status === 403 || status === 400 ? error.message : "An error occurred.",
      }));
    }
  }
}