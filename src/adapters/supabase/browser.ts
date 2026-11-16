import { createBrowserClient } from "@supabase/ssr";

function getSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return value;
}

function getSupabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!value) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return value;
}

/** Browser-only. Do not import next/headers here. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
