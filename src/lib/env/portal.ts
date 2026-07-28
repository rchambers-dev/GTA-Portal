export function isDemoModeEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return true;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function getDataAdapterMode(): "fiction" | "supabase" {
  return process.env.DATA_ADAPTER === "supabase" ? "supabase" : "fiction";
}

export function useSupabaseMode(): boolean {
  return !isDemoModeEnabled() && getDataAdapterMode() === "supabase";
}

export function getPortalBaseUrl(): string {
  return process.env.NEXT_PUBLIC_PORTAL_BASE_URL?.trim() || "http://localhost:3000";
}
