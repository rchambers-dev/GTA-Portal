export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

/**
 * The companion app uses the same public Supabase URL and anon (or publishable) key
 * as the Portal. A service-role key is rejected so it cannot be bundled into the phone.
 */
export function readSupabaseConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseConfig | null {
  const url = (env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  const anonKey = (env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !anonKey) return null;
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
