"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/adapters/supabase/client";
import { ANALYTICS_REFRESH_MS, ANALYTICS_TABLES, queueRefresh } from "../domain/analytics-live";
import { revalidateAnalytics } from "../domain/revalidate-analytics";

/** Listens for Portal edits and loads Analytics again. It renders nothing. */
export function AnalyticsLive() {
  const router = useRouter();
  useEffect(() => {
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }
    const kick = queueRefresh(
      (run, wait) => window.setTimeout(run, wait),
      (id) => window.clearTimeout(id),
      () => {
        void revalidateAnalytics().finally(() => router.refresh());
      },
      ANALYTICS_REFRESH_MS,
    );
    const channel = supabase.channel("analytics-live");
    for (const table of ANALYTICS_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, kick);
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);
  return null;
}
