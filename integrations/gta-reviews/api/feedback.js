import { addTutorFeedback, feedbackFailureBody, listTutorFeedback } from "../server/feedback.js";
import { logClientError } from "../shared/log-error.js";
import { supabaseAdmin } from "../server/supabase-admin.js";
import { sendPreflight } from "../server/cors.js";
import { staffRole } from "../server/roles.js";

const STAFF_ROLES = ["office", "admin", "tutor"];
const ADMIN_OFFICE_ROLES = ["office", "admin"];

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

async function requireAdminOrOffice(req) {
  const { user, role } = await requireStaff(req);
  if (!ADMIN_OFFICE_ROLES.includes(role)) {
    const error = new Error("Access denied. Admin or office role required.");
    error.status = 403;
    throw error;
  }
  return { user, role };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    sendPreflight(res);
    return;
  }
  try {
    if (req.method === "GET") {
      // Viewing feedback inbox requires admin/office role
      await requireAdminOrOffice(req);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ items: await listTutorFeedback() }));
      return;
    }
    if (req.method === "POST") {
      // All staff can submit feedback
      await requireStaff(req);
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const items = await addTutorFeedback(body);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ items }));
      return;
    }
    res.statusCode = 405;
    res.end();
  } catch (error) {
    logClientError("Feedback request failed", {
      status: error?.status,
      code: error?.code,
      route: "/api/feedback",
    });
    const body = feedbackFailureBody(error);
    res.statusCode = body.status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: body.error }));
  }
}
