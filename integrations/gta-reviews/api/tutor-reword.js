import { rewordTutorText } from "../server/tutor-ai.js";
import { allowReword } from "../server/reword-rate.js";
import { logClientError } from "../shared/log-error.js";
import { supabaseAdmin } from "../server/supabase-admin.js";
import { sendPreflight } from "../server/cors.js";
import { staffRole } from "../server/roles.js";

const STAFF_ROLES = ["office", "admin", "tutor"];
const MAX_INPUT_LENGTH = 5000;

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

function invalidJson() {
  const error = new Error("Invalid JSON.");
  error.status = 400;
  return error;
}

function parseJson(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw invalidJson();
  }
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

export default async function handler(req, res) {
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
    const { user } = await requireStaff(req);

    const body = await readBody(req);
    
    if (!body.text || typeof body.text !== "string") {
      const error = new Error("Text is required.");
      error.status = 400;
      throw error;
    }
    
    if (body.text.length > MAX_INPUT_LENGTH) {
      const error = new Error(`Text too long. Maximum ${MAX_INPUT_LENGTH} characters allowed.`);
      error.status = 400;
      throw error;
    }

    await allowReword(user.id);
    const text = await rewordTutorText(body);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ text }));
  } catch (error) {
    logClientError("Tutor reword request failed.", {
      status: error?.status || 500,
      code: error?.code,
      route: "/api/tutor-reword",
    });
    const status = error.status || 500;
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      error: status === 401 || status === 403 || status === 400 || status === 429 ? error.message : "An error occurred.",
    }));
  }
}
