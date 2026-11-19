import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { formatTutorDate } from "@/features/administration/domain/apprentice-tutor";
import { methodLabel } from "./plan-due";

export type ArchiveReview = {
  id: string;
  gtaId: string;
  name: string;
  plannedOn: string;
  actualOn: string;
  method: string;
  shelved: boolean;
};

export type ArchivePage = {
  reviews: ArchiveReview[];
  shelveReady: boolean;
  loadError: string | null;
};

export async function loadArchivePage(): Promise<ArchivePage> {
  const supabase = await createSupabaseServerClient();
  return readArchivePage(supabase);
}

export async function readArchivePage(supabase: SupabaseClient): Promise<ArchivePage> {
  const withShelf = await supabase
    .from("reviews")
    .select("id, gta_id, planned_on, actual_on, method, status, shelved_at")
    .eq("status", "completed")
    .order("actual_on", { ascending: false })
    .limit(400);
  const shelveReady = !withShelf.error;
  const plain = shelveReady
    ? withShelf
    : await supabase
        .from("reviews")
        .select("id, gta_id, planned_on, actual_on, method, status")
        .eq("status", "completed")
        .order("actual_on", { ascending: false })
        .limit(400);
  if (plain.error) return { reviews: [], shelveReady: false, loadError: plain.error.message };
  const rows = (plain.data ?? []) as {
    id: string;
    gta_id: string;
    planned_on: string | null;
    actual_on: string | null;
    method: string | null;
    shelved_at?: string | null;
  }[];
  const ids = [...new Set(rows.map((row) => row.gta_id))];
  const apprentices = ids.length
    ? await supabase.from("apprentices").select("gta_id, first_name, middle_names, last_name").in("gta_id", ids)
    : { data: [] };
  const names = new Map(
    ((apprentices.data ?? []) as { gta_id: string; first_name: string | null; middle_names: string | null; last_name: string | null }[]).map((row) => [
      row.gta_id,
      [row.first_name, row.middle_names, row.last_name].filter(Boolean).join(" "),
    ]),
  );
  return {
    shelveReady,
    loadError: null,
    reviews: rows.map((row) => ({
      id: row.id,
      gtaId: row.gta_id,
      name: names.get(row.gta_id) || row.gta_id,
      plannedOn: row.planned_on ? formatTutorDate(row.planned_on) : "—",
      actualOn: row.actual_on ? formatTutorDate(row.actual_on) : "—",
      method: row.method ? methodLabel(row.method) : "—",
      shelved: Boolean(row.shelved_at),
    })),
  };
}
