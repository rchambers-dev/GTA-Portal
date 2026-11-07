import { createClient } from "@supabase/supabase-js";

import { isOfficeSession, isAdminSession } from "./staff.js";
import { isTutorSession, tutorFromEmail } from "./tutors.js";

export { isOfficeSession, isAdminSession, isTutorSession, tutorFromEmail };

const url = String(
  import.meta.env.NODE_SUPABASE_URL ||
    "https://gzeeofbhcgbgcbykdvez.supabase.co",
).trim();
const key = String(
  import.meta.env.NODE_SUPABASE_ANON_KEY ||
    "sb_publishable_LCBgN5P6X2QlS-2igEw-NA_1VuKV4Rk",
).trim();
const REMEMBER_KEY = "review-assistant-remember";
const EMAIL_KEY = "review-assistant-email";
const AUTH_STORAGE_KEY = "review-assistant-auth";

let client = null;
let clientRemember = null;

export function authConfigured() {
  return /^https:\/\//.test(url) && Boolean(key);
}

export function rememberLoginEnabled() {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(REMEMBER_KEY) !== "0";
}

export function rememberedEmail() {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(EMAIL_KEY) || "";
}

export function setRememberLogin(remember, email = "") {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  if (remember && email) localStorage.setItem(EMAIL_KEY, email);
  else localStorage.removeItem(EMAIL_KEY);
}

function authStorage(remember) {
  if (typeof window === "undefined") return undefined;
  return remember ? window.localStorage : window.sessionStorage;
}

export function supabaseClient(remember = rememberLoginEnabled()) {
  if (!authConfigured()) return null;
  if (client && clientRemember === remember) return client;
  clientRemember = remember;
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: authStorage(remember),
      storageKey: AUTH_STORAGE_KEY,
    },
  });
  return client;
}

export async function currentSession() {
  const supabase = supabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

function refreshFailedOnNetwork(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || "");
  if (name === "TypeError" || name === "AuthRetryableFetchError") return true;
  if (error?.status === 0) return true;
  return /network|failed to fetch|fetch failed|load failed/i.test(message);
}

export async function refreshAccessToken() {
  const supabase = supabaseClient();
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (refreshFailedOnNetwork(error)) throw error;
    return !error && Boolean(data?.session?.access_token);
  } catch (error) {
    if (refreshFailedOnNetwork(error)) throw error;
    return false;
  }
}

export async function signIn(email, password, remember = rememberLoginEnabled()) {
  setRememberLogin(remember, email);
  const supabase = supabaseClient(remember);
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || "").trim(),
    password,
  });
  if (error) throw error;
  return data.session;
}

export async function signOut(scope = "global") {
  const supabase = supabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope });
  if (error) throw error;
}

export function needsPasswordChange(session) {
  const user = session?.user;
  if (!user || (!isTutorSession(session) && !isOfficeSession(session) && !isAdminSession(session))) return false;
  const serverFlag = user.app_metadata?.password_changed;
  if (serverFlag === true || serverFlag === false) return serverFlag === false;
  // Until the backfill has written app_metadata, keep the previous check.
  return user.user_metadata?.password_changed === false;
}

export async function changePassword(currentPassword, nextPassword) {
  const supabase = supabaseClient();
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const session = await currentSession();
  const email = String(session?.user?.email || "").trim();
  if (!email) throw new Error("Sign in first.");
  const current = String(currentPassword || "");
  const next = String(nextPassword || "");
  if (next.length < 8) throw new Error("Use at least 8 characters for the new password.");
  if (next === current) throw new Error("Pick a new password, not the one you were given.");
  const token = String(session?.access_token || "");
  const response = await fetch("/api/password-changed", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ currentPassword: current, nextPassword: next }),
  });
  if (!response.ok) {
    let message = "Could not update the password.";
    try {
      const payload = await response.json();
      if (payload?.error) message = String(payload.error);
    } catch {
      // The server did not return JSON. Keep the generic message.
    }
    throw new Error(message);
  }
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data?.user) {
    throw new Error("Password saved. Sign in again with the new password.");
  }
  return data.user;
}

export function onAuthChange(callback) {
  const supabase = supabaseClient();
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}
