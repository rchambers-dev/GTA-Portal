import { createSupabaseServerClient } from "@/adapters/supabase/client";
import type { ClosureSpan } from "./open-days";

export type ClosureRow = ClosureSpan & {
  id: string;
  kind: string;
  source: string;
  locked: boolean;
  notes: string | null;
  updatedAt: string | null;
};

type RawClosure = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  kind: string;
  source: string;
  locked: boolean;
  notes: string | null;
  updated_at: string | null;
  removed_at: string | null;
};

export async function loadClosureSpans(): Promise<{ date: string; name: string }[]> {
  const loaded = await loadClosures();
  const days: { date: string; name: string }[] = [];
  for (const row of loaded.rows) {
    const start = new Date(`${row.startsOn}T00:00:00Z`);
    const end = new Date(`${row.endsOn}T00:00:00Z`);
    for (let cursor = start; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      days.push({ date: cursor.toISOString().slice(0, 10), name: row.name });
    }
  }
  return days;
}

export async function loadClosures(): Promise<{ rows: ClosureRow[]; lastChecked: string | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase
      .from("calendar_closures")
      .select("id, name, starts_on, ends_on, kind, source, locked, notes, updated_at, removed_at")
      .is("removed_at", null)
      .order("starts_on");
    if (result.error) return { rows: [], lastChecked: null, error: result.error.message };
    const raw = (result.data ?? []) as RawClosure[];
    const rows = raw.map((row) => ({
      id: row.id,
      name: row.name,
      startsOn: row.starts_on.slice(0, 10),
      endsOn: row.ends_on.slice(0, 10),
      kind: row.kind,
      source: row.source,
      locked: row.locked,
      notes: row.notes,
      updatedAt: row.updated_at,
    }));
    const checked = raw
      .filter((row) => row.source === "gov_uk" && row.updated_at)
      .map((row) => row.updated_at as string)
      .sort();
    return { rows, lastChecked: checked.at(-1) ?? null, error: null };
  } catch (error) {
    return { rows: [], lastChecked: null, error: error instanceof Error ? error.message : "Closed days could not be loaded." };
  }
}
