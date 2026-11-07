import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.js";

export function supabaseAdmin() {
  const env = loadEnv();
  const url = env.supabaseUrl;
  const secret = env.supabaseSecretKey;
  if (!url || !secret) {
    const error = new Error("Missing Supabase URL or secret key.");
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }
  return {
    url,
    secret,
    anon: env.supabaseAnonKey,
    client: createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

// A separate anon client for a one-off password check. It must not be the
// service-role client, and the caller signs it out when the check is done.
export function supabaseAuthClient() {
  const { url, anon } = supabaseAdmin();
  if (!url || !anon) {
    const error = new Error("Missing Supabase URL or anon key.");
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function projectRef(url) {
  try {
    return new URL(url).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}
