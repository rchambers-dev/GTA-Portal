import { createSupabaseServerClient } from "@/adapters/supabase/client";
import type { ClosureSpan } from "./open-days";

export type ClosureRow = ClosureSpan & {
  id: string;
  kind: string;
  source: string;
  locked: boolean;
  notes: string | null;
};

export async function loadClosureSpans(): Promise<{ date: string; name: string }[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase
      .from("calendar_closures")
      .select("name, starts_on, ends_on, removed_at")
      .is("removed_at", null);
    if (result.error || !result.data) return [];
    const days: { date: string; name: string }[] = [];
    for (const row of result.data as { name: string; starts_on: string; ends_on: string }[]) {
      const start = new Date(`${row.starts_on.slice(0, 10)}T00:00:00Z`);
      const end = new Date(`${row.ends_on.slice(0, 10)}T00:00:00Z`);
      for (let cursor = start; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        days.push({ date: cursor.toISOString().slice(0, 10), name: row.name });
      }
    }
    return days;
  } catch {
    return [];
  }
}

export async function loadClosures(year: number): Promise<{ rows: ClosureRow[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase.rpc("list_calendar_closures", { p_year: year });
    if (result.error) return { rows: [], error: result.error.message };
    const rows = (Array.isArray(result.data) ? result.data : []) as ClosureRow[];
    return { rows, error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : "Closed days could not be loaded." };
  }
}
