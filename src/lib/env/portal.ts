export function isDemoModeEnabled(): boolean {
  // Explicit opt-in only. Production and local live both stay off demo/fiction.
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function getDataAdapterMode(): "fiction" | "supabase" {
  return process.env.DATA_ADAPTER === "supabase" ? "supabase" : "fiction";
}

export function useSupabaseMode(): boolean {
  return getDataAdapterMode() === "supabase" && !isDemoModeEnabled();
}

export function getPortalBaseUrl(): string {
  return process.env.NEXT_PUBLIC_PORTAL_BASE_URL?.trim() || "http://localhost:3000";
}
