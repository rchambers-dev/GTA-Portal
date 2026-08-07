/**
 * Persist / load GTA programme spines + Block↔KSB mappings in Supabase.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BlockKsbMapping,
  GtaProgrammeVersion,
  LearningIntent,
  MappingSource,
  ProgrammeDeliveryParameters,
  RecommendationProvider,
  SpineItem,
  SpineItemType,
} from "./types";
import { isLearningIntent } from "./block-ksb-mappings";

type ProgrammeVersionRow = {
  id: string;
  programme_id: string;
  standard_version_id: string;
  internal_version: string;
  status: string;
};

type SpineItemRow = {
  id: string;
  item_type: string;
  gateway_type: string | null;
  title: string;
  sequence: number;
  planned_weeks: number | null;
  planned_otj_hours: number | string;
  counts_towards_learning_hours: boolean;
  metadata: Record<string, unknown> | null;
};

type MappingRow = {
  id: string;
  spine_item_id: string;
  ksb_id: string;
  is_primary: boolean;
  learning_intent: string;
  mapping_source: string;
  recommendation_provider: string | null;
  recommendation_feature: string | null;
  recommended_intent: string | null;
  recommendation_accepted: boolean | null;
  confidence: number | null;
  ai_reason_summary: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export async function findProgrammeVersionByStandard(
  supabase: SupabaseClient,
  standardCode: string,
): Promise<{
  programmeVersionId: string;
  programmeId: string;
  standardVersionId: string;
  title: string;
} | null> {
  const code = standardCode.trim().toUpperCase();
  const { data: standard, error: sErr } = await supabase
    .from("se_standards")
    .select("id, title, standard_code")
    .eq("standard_code", code)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!standard) return null;

  const { data: prog, error: pErr } = await supabase
    .from("gta_programmes")
    .select("id, title")
    .eq("standard_id", standard.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!prog) return null;

  const { data: version, error: vErr } = await supabase
    .from("gta_programme_versions")
    .select("id, programme_id, standard_version_id, internal_version, status")
    .eq("programme_id", prog.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!version) return null;

  return {
    programmeVersionId: version.id,
    programmeId: prog.id,
    standardVersionId: version.standard_version_id,
    title: prog.title,
  };
}

export async function loadProgrammeSpine(
  supabase: SupabaseClient,
  programmeVersionId: string,
): Promise<{
  spineItems: SpineItem[];
  ksbMappings: BlockKsbMapping[];
  version: ProgrammeVersionRow | null;
} | null> {
  const { data: version, error: vErr } = await supabase
    .from("gta_programme_versions")
    .select("id, programme_id, standard_version_id, internal_version, status")
    .eq("id", programmeVersionId)
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!version) return null;

  const { data: spine, error: spineErr } = await supabase
    .from("gta_spines")
    .select("id")
    .eq("programme_version_id", programmeVersionId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (spineErr) throw new Error(spineErr.message);
  if (!spine) {
    return { spineItems: [], ksbMappings: [], version: version as ProgrammeVersionRow };
  }

  const { data: items, error: itemsErr } = await supabase
    .from("gta_spine_items")
    .select(
      "id, item_type, gateway_type, title, sequence, planned_weeks, planned_otj_hours, counts_towards_learning_hours, metadata",
    )
    .eq("spine_id", spine.id)
    .order("sequence", { ascending: true });
  if (itemsErr) throw new Error(itemsErr.message);

  const itemRows = (items ?? []) as SpineItemRow[];
  const spineItems: SpineItem[] = itemRows.map((row) => ({
    id: row.id,
    itemType: row.item_type as SpineItemType,
    gatewayType: (row.gateway_type as SpineItem["gatewayType"]) ?? null,
    title: row.title,
    sequence: row.sequence,
    plannedWeeks: row.planned_weeks,
    plannedOtjHours: Number(row.planned_otj_hours) || 0,
    countsTowardsLearningHours: row.counts_towards_learning_hours,
    metadata: row.metadata ?? {},
  }));

  const itemIds = itemRows.map((i) => i.id);
  if (itemIds.length === 0) {
    return { spineItems, ksbMappings: [], version: version as ProgrammeVersionRow };
  }

  const { data: mapRows, error: mapErr } = await supabase
    .from("gta_spine_item_ksbs")
    .select(
      "id, spine_item_id, ksb_id, is_primary, learning_intent, mapping_source, recommendation_provider, recommendation_feature, recommended_intent, recommendation_accepted, confidence, ai_reason_summary, created_by, created_at, updated_at",
    )
    .in("spine_item_id", itemIds);
  if (mapErr) throw new Error(mapErr.message);

  const ksbIds = [...new Set((mapRows ?? []).map((r) => r.ksb_id))];
  const codeById = new Map<string, string>();
  if (ksbIds.length) {
    const { data: ksbs, error: kErr } = await supabase
      .from("se_ksbs")
      .select("id, ksb_code")
      .in("id", ksbIds);
    if (kErr) throw new Error(kErr.message);
    for (const k of ksbs ?? []) {
      codeById.set(k.id, String(k.ksb_code).toUpperCase());
    }
  }

  const blockIdSet = new Set(
    spineItems.filter((i) => i.itemType === "block").map((i) => i.id),
  );

  const ksbMappings: BlockKsbMapping[] = ((mapRows ?? []) as MappingRow[])
    .map((row) => {
      const code = codeById.get(row.ksb_id);
      if (!code) return null;
      if (!blockIdSet.has(row.spine_item_id)) return null;
      const intent = isLearningIntent(row.learning_intent)
        ? row.learning_intent
        : ("practise" as LearningIntent);
      const source = (
        ["manual", "ai_suggested", "imported"] as MappingSource[]
      ).includes(row.mapping_source as MappingSource)
        ? (row.mapping_source as MappingSource)
        : "manual";
      const provider = (
        ["portal_ai", "heuristic"] as RecommendationProvider[]
      ).includes(row.recommendation_provider as RecommendationProvider)
        ? (row.recommendation_provider as RecommendationProvider)
        : null;
      const recommended = isLearningIntent(row.recommended_intent)
        ? row.recommended_intent
        : null;
      return {
        id: row.id,
        blockId: row.spine_item_id,
        ksbCode: code,
        isPrimary: Boolean(row.is_primary),
        learningIntent: intent,
        mappingSource: source,
        recommendationProvider: provider,
        recommendationFeature: row.recommendation_feature,
        recommendedIntent: recommended,
        recommendationAccepted:
          row.recommendation_accepted == null
            ? null
            : Boolean(row.recommendation_accepted),
        confidence: row.confidence == null ? null : Number(row.confidence),
        aiReasonSummary: row.ai_reason_summary,
        createdBy: row.created_by || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      } satisfies BlockKsbMapping;
    })
    .filter(Boolean) as BlockKsbMapping[];

  return {
    spineItems,
    ksbMappings,
    version: version as ProgrammeVersionRow,
  };
}

export async function saveProgrammeSpine(
  supabase: SupabaseClient,
  input: {
    programmeId: string;
    programmeVersionId: string;
    programmeTitle: string;
    standardCode: string;
    standardVersionId: string;
    status: string;
    internalVersion: string;
    spineItems: SpineItem[];
    ksbMappings: BlockKsbMapping[];
    parameters?: ProgrammeDeliveryParameters;
  },
): Promise<void> {
  const code = input.standardCode.trim().toUpperCase();

  // Ensure standard + programme rows exist
  const { data: standard, error: sErr } = await supabase
    .from("se_standards")
    .select("id")
    .eq("standard_code", code)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!standard) {
    throw new Error(
      `Standard ${code} is not in the database — load the official pack first.`,
    );
  }

  const { error: progUpsertErr } = await supabase.from("gta_programmes").upsert(
    {
      id: input.programmeId,
      standard_id: standard.id,
      title: input.programmeTitle,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (progUpsertErr) throw new Error(progUpsertErr.message);

  const { error: verErr } = await supabase.from("gta_programme_versions").upsert(
    {
      id: input.programmeVersionId,
      programme_id: input.programmeId,
      standard_version_id: input.standardVersionId,
      internal_version: input.internalVersion || "1",
      status: input.status || "draft",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (verErr) throw new Error(verErr.message);

  let spineId: string;
  const { data: existingSpine, error: spineFindErr } = await supabase
    .from("gta_spines")
    .select("id")
    .eq("programme_version_id", input.programmeVersionId)
    .limit(1)
    .maybeSingle();
  if (spineFindErr) throw new Error(spineFindErr.message);

  if (existingSpine?.id) {
    spineId = existingSpine.id;
  } else {
    const { data: created, error: spineCreateErr } = await supabase
      .from("gta_spines")
      .insert({
        programme_version_id: input.programmeVersionId,
        title: "Main spine",
      })
      .select("id")
      .single();
    if (spineCreateErr) throw new Error(spineCreateErr.message);
    spineId = created.id;
  }

  // Replace spine items
  const { data: oldItems, error: oldErr } = await supabase
    .from("gta_spine_items")
    .select("id")
    .eq("spine_id", spineId);
  if (oldErr) throw new Error(oldErr.message);
  const oldIds = (oldItems ?? []).map((r) => r.id);
  if (oldIds.length) {
    await supabase.from("gta_spine_item_ksbs").delete().in("spine_item_id", oldIds);
    await supabase.from("gta_spine_items").delete().in("id", oldIds);
  }

  if (input.spineItems.length) {
    const { error: insertItemsErr } = await supabase.from("gta_spine_items").insert(
      input.spineItems.map((item) => ({
        id: item.id,
        spine_id: spineId,
        item_type: item.itemType,
        gateway_type: item.gatewayType,
        title: item.title,
        sequence: item.sequence,
        planned_weeks: item.plannedWeeks,
        planned_otj_hours: item.plannedOtjHours,
        counts_towards_learning_hours: item.countsTowardsLearningHours,
        metadata: item.metadata ?? {},
      })),
    );
    if (insertItemsErr) throw new Error(insertItemsErr.message);
  }

  if (!input.ksbMappings.length) return;

  // Resolve KSB codes → se_ksbs ids for this standard version
  const { data: ksbRows, error: ksbErr } = await supabase
    .from("se_ksbs")
    .select("id, ksb_code")
    .eq("standard_version_id", input.standardVersionId);
  if (ksbErr) throw new Error(ksbErr.message);
  const idByCode = new Map(
    (ksbRows ?? []).map((r) => [String(r.ksb_code).toUpperCase(), r.id as string]),
  );

  const blockIds = new Set(
    input.spineItems.filter((i) => i.itemType === "block").map((i) => i.id),
  );

  const mappingInserts = input.ksbMappings
    .map((m) => {
      if (!blockIds.has(m.blockId)) return null;
      const ksbId = idByCode.get(m.ksbCode.toUpperCase());
      if (!ksbId) return null;
      return {
        id: m.id,
        spine_item_id: m.blockId,
        ksb_id: ksbId,
        programme_version_id: input.programmeVersionId,
        is_primary: m.isPrimary,
        learning_intent: m.learningIntent,
        mapping_source: m.mappingSource,
        recommendation_provider: m.recommendationProvider,
        recommendation_feature: m.recommendationFeature,
        recommended_intent: m.recommendedIntent,
        recommendation_accepted: m.recommendationAccepted,
        confidence: m.confidence,
        ai_reason_summary: m.aiReasonSummary,
        created_by: m.createdBy || "",
        created_at: m.createdAt,
        updated_at: m.updatedAt,
      };
    })
    .filter(
      (row): row is NonNullable<typeof row> => row != null,
    );

  if (mappingInserts.length) {
    // Insert non-primary first, then primaries, to reduce unique-index churn
    const nonPrimary = mappingInserts.filter((m) => !m.is_primary);
    const primary = mappingInserts.filter((m) => m.is_primary);
    if (nonPrimary.length) {
      const { error } = await supabase
        .from("gta_spine_item_ksbs")
        .insert(nonPrimary);
      if (error) throw new Error(error.message);
    }
    if (primary.length) {
      const { error } = await supabase.from("gta_spine_item_ksbs").insert(primary);
      if (error) throw new Error(error.message);
    }
  }
}

export function toClientProgramme(
  base: Partial<GtaProgrammeVersion> & {
    id: string;
    programmeId: string;
    programmeTitle: string;
    standardVersionId: string;
    standardCode: string;
    externalVersion: string;
  },
  loaded: {
    spineItems: SpineItem[];
    ksbMappings: BlockKsbMapping[];
    version: ProgrammeVersionRow | null;
  },
): GtaProgrammeVersion {
  const now = new Date().toISOString();
  return {
    id: base.id,
    programmeId: base.programmeId,
    programmeTitle: base.programmeTitle,
    standardVersionId: base.standardVersionId,
    standardCode: base.standardCode,
    externalVersion: base.externalVersion,
    internalVersion: loaded.version?.internal_version || "1",
    status: (loaded.version?.status as GtaProgrammeVersion["status"]) || "draft",
    spineItems: loaded.spineItems,
    ksbMappings: loaded.ksbMappings,
    parameters: base.parameters!,
    hasEnrolledApprentices: Boolean(base.hasEnrolledApprentices),
    createdAt: base.createdAt || now,
    updatedAt: now,
  };
}
