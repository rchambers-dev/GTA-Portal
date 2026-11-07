import { loadPayload, savePayload } from "./db.js";
import { supabaseAdmin } from "./supabase-admin.js";
import { authoritativeState, readRemoteState, writeRemoteState } from "./remote-state.js";
import { logClientError } from "../shared/log-error.js";
import { onVercel } from "./runtime.js";

export const FEEDBACK_READ_ERROR = "Could not load suggestions. Try again.";

export function feedbackFailureBody(error) {
  const status = error?.status || 500;
  if (status === 401 || status === 403 || status === 400) {
    return { status, error: String(error.message || "Could not save that suggestion.") };
  }
  if (status === 503) return { status, error: FEEDBACK_READ_ERROR };
  return { status, error: "An error occurred." };
}

function normaliseItem(value) {
  const message = String(value?.message || "").trim();
  if (!message) return null;
  return {
    id: String(value.id || crypto.randomUUID()),
    email: String(value.email || "").trim(),
    message: message.slice(0, 2000),
    at: String(value.at || new Date().toISOString()),
  };
}

function fromState(state) {
  return (Array.isArray(state?.tutorFeedback) ? state.tutorFeedback : [])
    .map(normaliseItem)
    .filter(Boolean);
}

async function readFeedbackState() {
  const local = loadPayload() || null;
  try {
    const { client } = supabaseAdmin();
    const fileState = await readRemoteState(client);
    const result = await client.from("app_state").select("payload").eq("id", "default").maybeSingle();
    if (result?.error) throw result.error;
    return authoritativeState(result?.data?.payload ?? null, fileState, local) || {};
  } catch (error) {
    // Desktop can run with only SQLite. Vercel has no local database.
    if (!onVercel() && error?.code === "SUPABASE_NOT_CONFIGURED") {
      return local || {};
    }
    logClientError("Failed to read feedback state.", {
      status: 503,
      code: error?.code,
      route: "/api/feedback",
    });
    const failure = new Error(FEEDBACK_READ_ERROR);
    failure.status = 503;
    throw failure;
  }
}

async function writeFeedbackState(state) {
  try {
    const { client } = supabaseAdmin();
    const upserted = await client.from("app_state").upsert({
      id: "default",
      payload: state,
      updated_at: new Date().toISOString(),
    });
    if (upserted?.error) throw upserted.error;
    await writeRemoteState(state, client);
  } catch (error) {
    logClientError("Failed to save feedback remotely.", {
      status: 500,
      code: error?.code,
      route: "/api/feedback",
    });
    const failure = new Error("Could not save that suggestion.");
    failure.status = 500;
    throw failure;
  }
  try {
    savePayload(state);
  } catch (error) {
    logClientError("Failed to save feedback locally.", {
      status: 500,
      code: error?.code,
      route: "/api/feedback",
    });
    const failure = new Error("Could not save that suggestion.");
    failure.status = 500;
    throw failure;
  }
}

export async function listTutorFeedback() {
  return fromState(await readFeedbackState());
}

function validateEmail(email) {
  if (!email) return true;
  const trimmed = String(email).trim();
  if (trimmed.length > 500) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

export async function addTutorFeedback({ email, message } = {}) {
  if (typeof message !== "string") {
    const error = new Error("Message must be a string.");
    error.status = 400;
    throw error;
  }
  
  const trimmedMessage = message.trim();
  if (trimmedMessage.length < 3) {
    const error = new Error("Message must be at least 3 characters.");
    error.status = 400;
    throw error;
  }
  
  if (trimmedMessage.length > 2000) {
    const error = new Error("Message must not exceed 2000 characters.");
    error.status = 400;
    throw error;
  }
  
  if (email && !validateEmail(email)) {
    const error = new Error("Invalid email format.");
    error.status = 400;
    throw error;
  }
  
  const item = normaliseItem({
    email,
    message,
    at: new Date().toISOString(),
  });
  if (!item) {
    const error = new Error("Write a suggestion first.");
    error.status = 400;
    throw error;
  }
  const state = (await readFeedbackState()) || {};
  const items = [...fromState(state), item];
  await writeFeedbackState({ ...state, tutorFeedback: items });
  return items;
}
