/** Public Portal project. These are the same client values the website already ships. */
export const PUBLIC_SUPABASE_URL = "https://cjtgjxgghfiskqnuttzd.supabase.co";
export const PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_SjLAYAI9Y8xTLjj7dI6r3Q_5vt1P8GC";

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

/**
 * Uses the public Portal project unless EXPO_PUBLIC_SUPABASE_URL or
 * EXPO_PUBLIC_SUPABASE_ANON_KEY is set. A service-role key is rejected.
 */
export function readSupabaseConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseConfig | null {
  const url = (env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "") || PUBLIC_SUPABASE_URL;
  const anonKey = (env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() || PUBLIC_SUPABASE_ANON_KEY;
  if (!/^https:\/\//i.test(url)) return null;
  if (keyRole(anonKey) === "service_role") return null;
  return { url, anonKey };
}

export function keyRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const json = JSON.parse(decodeBase64Url(parts[1])) as { role?: unknown };
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return globalThis.atob(padded);
}
