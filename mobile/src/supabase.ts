import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseConfig } from "./config";

export type PortalClient = SupabaseClient;

export function createPortalClient(config: SupabaseConfig): PortalClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
