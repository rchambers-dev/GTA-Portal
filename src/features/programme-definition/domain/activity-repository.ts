import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProgrammeActivityEntry,
  ProgrammeActivityKind,
} from "./types";

type ActivityRow = {
  id: string;
  occurred_at: string;
  kind: string;
  summary: string;
  actor: string;
  standard_code: string;
  external_version: string;
  programme_id: string | null;
  detail: Record<string, string | number | boolean | null> | null;
};

const KIND_SET = new Set<ProgrammeActivityKind>([
  "api_request",
  "api_ok",
  "api_error",
  "new_version",
  "official_cached",
  "draft_reopened",
  "programme_created",
  "spine_saved",
  "parameters_saved",
  "formula_published",
  "spine_published",
  "title_saved",
  "primary_moved",
  "version_forked",
]);

function rowToEntry(row: ActivityRow): ProgrammeActivityEntry {
  const kind = KIND_SET.has(row.kind as ProgrammeActivityKind)
    ? (row.kind as ProgrammeActivityKind)
    : "api_ok";
  return {
    id: row.id,
    at: row.occurred_at,
    kind,
    summary: row.summary || "",
    actor: row.actor || "Unknown staff",
    standardCode: row.standard_code || undefined,
    externalVersion: row.external_version || undefined,
    programmeId: row.programme_id || undefined,
    detail: row.detail ?? {},
  };
}

export async function listActivityForStandard(
  supabase: SupabaseClient,
  standardCode: string,
  limit = 100,
): Promise<ProgrammeActivityEntry[]> {
  const code = standardCode.trim().toUpperCase();
  if (!code) return [];

  const { data, error } = await supabase
    .from("gta_programme_activity")
    .select(
      "id, occurred_at, kind, summary, actor, standard_code, external_version, programme_id, detail",
    )
    .eq("standard_code", code)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as ActivityRow[]).map(rowToEntry);
}

export async function insertActivity(
  supabase: SupabaseClient,
  entry: Omit<ProgrammeActivityEntry, "id"> & { id?: string },
): Promise<ProgrammeActivityEntry> {
  const id = entry.id || crypto.randomUUID();
  const standardCode = (entry.standardCode || "").trim().toUpperCase();
  const row = {
    id,
    occurred_at: entry.at || new Date().toISOString(),
    kind: entry.kind,
    summary: entry.summary,
    actor: entry.actor || "Unknown staff",
    standard_code: standardCode,
    external_version: entry.externalVersion || "",
    programme_id: entry.programmeId || null,
    detail: entry.detail ?? {},
  };

  const { data, error } = await supabase
    .from("gta_programme_activity")
    .insert(row)
    .select(
      "id, occurred_at, kind, summary, actor, standard_code, external_version, programme_id, detail",
    )
    .single();

  if (error) throw new Error(error.message);
  return rowToEntry(data as ActivityRow);
}

/**
 * If staff imported a pack before shared history existed, seed one row from the
 * official import timestamp so History is not blank.
 */
export async function ensureSeedActivityFromOfficial(
  supabase: SupabaseClient,
  standardCode: string,
): Promise<ProgrammeActivityEntry | null> {
  const code = standardCode.trim().toUpperCase();
  if (!code) return null;

  const existing = await listActivityForStandard(supabase, code, 1);
  if (existing.length > 0) return null;

  const { data: standard, error: stdErr } = await supabase
    .from("se_standards")
    .select("id, standard_code, title")
    .eq("standard_code", code)
    .maybeSingle();
  if (stdErr) throw new Error(stdErr.message);
  if (!standard) return null;

  const { data: version, error: verErr } = await supabase
    .from("se_standard_versions")
    .select("external_version, imported_at")
    .eq("standard_id", standard.id)
    .order("is_current", { ascending: false })
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (verErr) throw new Error(verErr.message);
  if (!version) return null;

  return insertActivity(supabase, {
    at: version.imported_at,
    kind: "official_cached",
    summary: `Official pack on file: ${standard.title || code} v${version.external_version}`,
    actor: "System",
    standardCode: code,
    externalVersion: version.external_version,
    detail: {
      source: "backfill_from_se_standard_versions",
      note: "Seeded because shared activity history was empty for this standard.",
    },
  });
}
