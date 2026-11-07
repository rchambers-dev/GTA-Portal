import { logClientError } from "../shared/log-error.js";

export { logClientError };

// User-facing text and logs must not include tokens, keys, or raw server bodies.
const SENSITIVE =
  /bearer\s+[a-z0-9._~+/-]{8,}|eyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}|<(?:!doctype|html|script)\b|api[_-]?key\s*[:=]|authorization\s*[:=]\s*\S+|service_role|sb_secret|sb_publishable|postgres:\/\//i;

export function clientMessage(error, fallback) {
  const raw = typeof error === "string" ? error : error?.message;
  const message = String(raw || "").replace(/\s+/g, " ").trim();
  if (!message || message.length > 180 || SENSITIVE.test(message) || /^\s*[\[{]/.test(message)) {
    return fallback;
  }
  return message;
}

export async function readResponseJson(response, label) {
  try {
    return await response.json();
  } catch {
    logClientError(label, response?.status);
    return null;
  }
}
