/**
 * Client store for Programme Builder preview.
 * Mirrors DB model; persists to localStorage until Supabase write-path is wired.
 */

import { displayApprenticeshipTitle } from "./programme-apprenticeships";
import { defaultWeightedKsbCapParams, formulaHasIncludedLetters } from "./rpl-formulas";
import type {
  GtaProgrammeVersion,
  OfficialStandardVersion,
  ProgrammeActivityEntry,
  ProgrammeActivityKind,
  ProgrammeDefinitionState,
  ProgrammeDeliveryParameters,
  RplFormulaKey,
  RplFormulaStatus,
  SpineItem,
} from "./types";
import { emptyState, isStructureLocked } from "./validation";

const STORAGE_KEY = "gta.programmeDefinition.v4";
const LEGACY_KEYS = [
  "gta.programmeDefinition.v3",
  "gta.programmeDefinition.v2",
] as const;
const ACTIVITY_CAP = 250;
const DEFAULT_ACTOR = "Unknown staff";
/** Skills England / import rate-friendly cadence. */
export const API_PING_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const API_PING_INTERVAL_LABEL = "every 6 hours";

/** Signed-in member name for activity log entries. */
let activityActor = DEFAULT_ACTOR;

/** Stable reference for useSyncExternalStore getServerSnapshot (must not allocate each call). */
const SERVER_SNAPSHOT: ProgrammeDefinitionState = emptyState();

let state: ProgrammeDefinitionState = emptyState();
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

function nowIso() {
  return new Date().toISOString();
}

/** Set from the signed-in portal session so history shows the real member. */
export function setProgrammeActivityActor(name: string | null | undefined) {
  const trimmed = name?.trim();
  activityActor = trimmed || DEFAULT_ACTOR;
}

function pushActivity(
  entry: Omit<ProgrammeActivityEntry, "id" | "at" | "actor"> & {
    actor?: string;
    at?: string;
  },
  options?: {
    coalesceKind?: ProgrammeActivityKind;
    coalesceMs?: number;
    /** Only merge into the newest row when this key matches (e.g. same param field). */
    coalesceKey?: string;
  },
) {
  const at = entry.at ?? nowIso();
  const nextEntry: ProgrammeActivityEntry = {
    id: crypto.randomUUID(),
    at,
    actor: entry.actor?.trim() || activityActor,
    kind: entry.kind,
    summary: entry.summary,
    standardCode: entry.standardCode,
    externalVersion: entry.externalVersion,
    programmeId: entry.programmeId,
    detail: {
      ...(entry.detail ?? {}),
      ...(options?.coalesceKey ? { coalesceKey: options.coalesceKey } : {}),
    },
  };

  const log = [...(state.activityLog || [])];
  if (options?.coalesceKind) {
    const windowMs = options.coalesceMs ?? 45_000;
    const newest = log[0];
    const sameCoalesceKey =
      !options.coalesceKey ||
      String(newest?.detail?.coalesceKey ?? "") === options.coalesceKey;
    if (
      newest &&
      newest.kind === options.coalesceKind &&
      newest.programmeId === nextEntry.programmeId &&
      newest.standardCode === nextEntry.standardCode &&
      sameCoalesceKey &&
      Date.parse(at) - Date.parse(newest.at) < windowMs
    ) {
      log[0] = { ...nextEntry, id: newest.id };
      state = { ...state, activityLog: log.slice(0, ACTIVITY_CAP) };
      return;
    }
  }

  state = {
    ...state,
    activityLog: [nextEntry, ...log].slice(0, ACTIVITY_CAP),
  };
}

/** Public append for UI events (API request start/fail, etc.). */
export function recordProgrammeActivity(
  entry: Omit<ProgrammeActivityEntry, "id" | "at" | "actor"> & {
    actor?: string;
    at?: string;
  },
) {
  hydrate();
  const at = entry.at ?? nowIso();
  pushActivity({ ...entry, at });
  if (
    entry.standardCode &&
    (entry.kind === "api_request" ||
      entry.kind === "api_ok" ||
      entry.kind === "api_error")
  ) {
    markApiCallInternal(entry.standardCode, at);
  }
  persist();
  emit();
}

export function activityForStandard(
  standardCode: string | undefined | null,
): ProgrammeActivityEntry[] {
  hydrate();
  if (!standardCode) return state.activityLog || [];
  return (state.activityLog || []).filter(
    (e) => !e.standardCode || e.standardCode === standardCode,
  );
}

function markApiCallInternal(standardCode: string, atIso: string) {
  const code = standardCode.trim().toUpperCase();
  if (!code) return;
  const atMs = Date.parse(atIso);
  const base = Number.isFinite(atMs) ? atMs : Date.now();
  state = {
    ...state,
    apiPingByStandard: {
      ...(state.apiPingByStandard || {}),
      [code]: {
        lastApiCallAt: new Date(base).toISOString(),
        nextPingAt: new Date(base + API_PING_INTERVAL_MS).toISOString(),
      },
    },
  };
}

/** Ensure a standard has a next-ping time (from last call, or 6h from now). */
export function ensureApiPingSchedule(standardCode: string) {
  hydrate();
  const code = standardCode.trim().toUpperCase();
  if (!code) return;
  const existing = state.apiPingByStandard?.[code];
  if (existing?.nextPingAt) return;
  const now = Date.now();
  const lastFromLog = (state.activityLog || []).find(
    (e) =>
      e.standardCode === code &&
      (e.kind === "api_request" ||
        e.kind === "api_ok" ||
        e.kind === "api_error"),
  );
  const lastMs = lastFromLog ? Date.parse(lastFromLog.at) : NaN;
  const lastApiCallAt = Number.isFinite(lastMs)
    ? new Date(lastMs).toISOString()
    : null;
  const nextFrom = Number.isFinite(lastMs) ? lastMs : now;
  state = {
    ...state,
    apiPingByStandard: {
      ...(state.apiPingByStandard || {}),
      [code]: {
        lastApiCallAt,
        nextPingAt: new Date(nextFrom + API_PING_INTERVAL_MS).toISOString(),
      },
    },
  };
  persist();
  emit();
}

export function getApiPingSchedule(standardCode: string | undefined | null): {
  lastApiCallAt: string | null;
  nextPingAt: string | null;
  intervalMs: number;
  intervalLabel: string;
} {
  hydrate();
  if (!standardCode) {
    return {
      lastApiCallAt: null,
      nextPingAt: null,
      intervalMs: API_PING_INTERVAL_MS,
      intervalLabel: API_PING_INTERVAL_LABEL,
    };
  }
  const code = standardCode.trim().toUpperCase();
  const entry = state.apiPingByStandard?.[code];
  return {
    lastApiCallAt: entry?.lastApiCallAt ?? null,
    nextPingAt: entry?.nextPingAt ?? null,
    intervalMs: API_PING_INTERVAL_MS,
    intervalLabel: API_PING_INTERVAL_LABEL,
  };
}

/** True when a scheduled ping is due (or overdue) for this standard. */
export function isApiPingDue(standardCode: string): boolean {
  hydrate();
  const code = standardCode.trim().toUpperCase();
  const entry = state.apiPingByStandard?.[code];
  if (!entry?.nextPingAt) return false;
  return Date.parse(entry.nextPingAt) <= Date.now();
}

function formatParamDisplay(
  key: keyof ProgrammeDeliveryParameters,
  value: unknown,
): string {
  if (key === "aplMaxFraction") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "empty";
    return `${Math.round(n * 1000) / 10}%`;
  }
  if (typeof value === "boolean") return value ? "on" : "off";
  if (value == null || value === "") return "empty";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "empty";
    return trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed;
  }
  return String(value);
}

const PARAM_LABELS: Record<keyof ProgrammeDeliveryParameters, string> = {
  expectedOtjHours: "Expected OTJ hours",
  formulaKey: "Formula type",
  formulaStatus: "Formula status",
  includeAplK: "Knowledge (K) in formula",
  includeAplS: "Skills (S) in formula",
  includeAplB: "Behaviours (B) in formula",
  aplWeightK: "Weight K",
  aplWeightS: "Weight S",
  aplWeightB: "Weight B",
  aplMaxFraction: "Max APL",
  rplNotes: "RPL notes",
};

function describeParameterChanges(
  before: ProgrammeDeliveryParameters,
  after: ProgrammeDeliveryParameters,
  patch: Partial<ProgrammeDeliveryParameters>,
): { summary: string; changes: string; detail: Record<string, string | number | boolean | null> } {
  const lines: string[] = [];
  const detail: Record<string, string | number | boolean | null> = {};

  for (const key of Object.keys(patch) as (keyof ProgrammeDeliveryParameters)[]) {
    if (patch[key] === undefined) continue;
    const from = formatParamDisplay(key, before[key]);
    const to = formatParamDisplay(key, after[key]);
    if (from === to) continue;
    const label = PARAM_LABELS[key] || key;
    lines.push(`${label}: ${from} → ${to}`);
    detail[`${key}_from`] = from;
    detail[`${key}_to`] = to;
  }

  if (lines.length === 0) {
    return {
      summary: "Delivery parameters unchanged",
      changes: "",
      detail: { changed: false },
    };
  }

  return {
    summary: lines.join("; "),
    changes: lines.join("\n"),
    detail: {
      ...detail,
      changeCount: lines.length,
    },
  };
}

function describeSpineChanges(
  before: SpineItem[],
  after: SpineItem[],
): { summary: string; detail: Record<string, string | number | boolean | null> } {
  const beforeById = new Map(before.map((i) => [i.id, i]));
  const afterById = new Map(after.map((i) => [i.id, i]));
  const added = after.filter((i) => !beforeById.has(i.id));
  const removed = before.filter((i) => !afterById.has(i.id));
  const parts: string[] = [];

  for (const item of added.slice(0, 3)) {
    parts.push(`added ${labelSpineTypeForLog(item.itemType)} “${item.title}”`);
  }
  if (added.length > 3) parts.push(`+${added.length - 3} more added`);

  for (const item of removed.slice(0, 3)) {
    parts.push(`removed ${labelSpineTypeForLog(item.itemType)} “${item.title}”`);
  }
  if (removed.length > 3) parts.push(`+${removed.length - 3} more removed`);

  let edited = 0;
  for (const item of after) {
    const prev = beforeById.get(item.id);
    if (!prev) continue;
    const changes: string[] = [];
    if (prev.title !== item.title) changes.push(`title “${prev.title}” → “${item.title}”`);
    if (prev.plannedOtjHours !== item.plannedOtjHours) {
      changes.push(`OTJ ${prev.plannedOtjHours} → ${item.plannedOtjHours}`);
    }
    if (prev.plannedWeeks !== item.plannedWeeks) {
      changes.push(`weeks ${prev.plannedWeeks ?? "—"} → ${item.plannedWeeks ?? "—"}`);
    }
    const prevKsbs = [...prev.assignedKsbCodes].sort().join(",");
    const nextKsbs = [...item.assignedKsbCodes].sort().join(",");
    if (prevKsbs !== nextKsbs) {
      const gained = item.assignedKsbCodes.filter(
        (c) => !prev.assignedKsbCodes.includes(c),
      );
      const lost = prev.assignedKsbCodes.filter(
        (c) => !item.assignedKsbCodes.includes(c),
      );
      if (gained.length) changes.push(`KSBs +${gained.join(", ")}`);
      if (lost.length) changes.push(`KSBs −${lost.join(", ")}`);
    }
    if (prev.sequence !== item.sequence) changes.push("reordered");
    if (changes.length) {
      edited += 1;
      if (parts.length < 4) {
        parts.push(`edited “${item.title}” (${changes.join(", ")})`);
      }
    }
  }
  if (edited > 3) parts.push(`+${edited - 3} more edited`);

  const beforeOrder = before.map((i) => i.id).join("|");
  const afterOrder = after.map((i) => i.id).join("|");
  if (
    parts.length === 0 &&
    beforeOrder !== afterOrder &&
    before.length === after.length
  ) {
    parts.push("reordered spine items");
  }

  if (parts.length === 0) {
    return {
      summary: `Spine saved (${after.length} items) — no structure change detected`,
      detail: {
        items: after.length,
        blocks: after.filter((i) => i.itemType === "block").length,
      },
    };
  }

  return {
    summary: parts.join("; "),
    detail: {
      items: after.length,
      added: added.length,
      removed: removed.length,
      edited,
      blocks: after.filter((i) => i.itemType === "block").length,
      gateways: after.filter((i) => i.itemType === "gateway").length,
      hasEpa: after.some((i) => i.itemType === "epa"),
    },
  };
}

function labelSpineTypeForLog(type: SpineItem["itemType"]): string {
  switch (type) {
    case "block":
      return "block";
    case "gateway":
      return "gateway";
    case "epa":
      return "EPA";
    case "milestone":
      return "milestone";
    case "break":
      return "break";
    default:
      return type;
  }
}

function clampWeight(n: unknown, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, v);
}

function clampFraction(n: unknown, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(1, Math.max(0, v));
}

function resolveFormulaKey(raw: unknown): RplFormulaKey {
  if (raw === "weighted_ksb_cap_v1") return raw;
  return "weighted_ksb_cap_v1";
}

function resolveFormulaStatus(raw: unknown): RplFormulaStatus {
  if (raw === "published") return "published";
  return "draft";
}

function resolveBool(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === "boolean") return raw;
  return fallback;
}

export function defaultProgrammeParameters(): ProgrammeDeliveryParameters {
  return {
    expectedOtjHours: null,
    ...defaultWeightedKsbCapParams(),
    rplNotes: "",
  };
}

function withParameters(
  programme: GtaProgrammeVersion,
): GtaProgrammeVersion {
  const defaults = defaultProgrammeParameters();
  const incoming = programme.parameters as
    | (Partial<ProgrammeDeliveryParameters> & {
        rplAdjustmentFormula?: string;
      })
    | undefined;
  // Migrate legacy free-text formula into notes once.
  const legacyNotes =
    incoming?.rplNotes != null && String(incoming.rplNotes).trim() !== ""
      ? String(incoming.rplNotes)
      : String(incoming?.rplAdjustmentFormula ?? "");

  return {
    ...programme,
    parameters: {
      expectedOtjHours:
        incoming?.expectedOtjHours == null ||
        Number.isNaN(Number(incoming.expectedOtjHours))
          ? null
          : Math.max(0, Number(incoming.expectedOtjHours)),
      formulaKey: resolveFormulaKey(incoming?.formulaKey),
      formulaStatus: resolveFormulaStatus(incoming?.formulaStatus),
      includeAplK: resolveBool(incoming?.includeAplK, defaults.includeAplK),
      includeAplS: resolveBool(incoming?.includeAplS, defaults.includeAplS),
      includeAplB: resolveBool(incoming?.includeAplB, defaults.includeAplB),
      aplWeightK: clampWeight(incoming?.aplWeightK, defaults.aplWeightK),
      aplWeightS: clampWeight(incoming?.aplWeightS, defaults.aplWeightS),
      aplWeightB: clampWeight(incoming?.aplWeightB, defaults.aplWeightB),
      aplMaxFraction: clampFraction(
        incoming?.aplMaxFraction,
        defaults.aplMaxFraction,
      ),
      rplNotes: legacyNotes,
    },
  };
}

/** Blank spine — nothing until staff builds in Spine Builder. */
export function emptySpine(): SpineItem[] {
  return [];
}

function migrateToV4(parsed: {
  officialVersions?: ProgrammeDefinitionState["officialVersions"];
  programmes?: ProgrammeDefinitionState["programmes"];
  selectedProgrammeId?: string | null;
  activityLog?: ProgrammeDefinitionState["activityLog"];
  apiPingByStandard?: ProgrammeDefinitionState["apiPingByStandard"];
}): ProgrammeDefinitionState {
  return {
    version: 4,
    officialVersions: parsed.officialVersions || [],
    programmes: (parsed.programmes || []).map((p) =>
      withParameters({
        ...p,
        standardCode: p.standardCode || "",
        externalVersion: p.externalVersion || "",
        hasEnrolledApprentices: Boolean(p.hasEnrolledApprentices),
        // Clear starter / template spines — rebuild from empty
        spineItems: emptySpine(),
        updatedAt: new Date().toISOString(),
      }),
    ),
    selectedProgrammeId: parsed.selectedProgrammeId ?? null,
    activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog : [],
    apiPingByStandard:
      parsed.apiPingByStandard && typeof parsed.apiPingByStandard === "object"
        ? parsed.apiPingByStandard
        : {},
  };
}

function normalizeState(
  parsed: ProgrammeDefinitionState,
): ProgrammeDefinitionState {
  return {
    ...parsed,
    version: 4,
    programmes: (parsed.programmes || []).map((p) =>
      withParameters({
        ...p,
        standardCode: p.standardCode || "",
        externalVersion: p.externalVersion || "",
        hasEnrolledApprentices: Boolean(p.hasEnrolledApprentices),
      }),
    ),
    activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog : [],
    apiPingByStandard:
      parsed.apiPingByStandard && typeof parsed.apiPingByStandard === "object"
        ? parsed.apiPingByStandard
        : {},
  };
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const rawV4 = window.localStorage.getItem(STORAGE_KEY);
    if (rawV4) {
      const parsed = JSON.parse(rawV4) as ProgrammeDefinitionState;
      if (parsed?.version === 4) state = normalizeState(parsed);
      return;
    }

    for (const key of LEGACY_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        version?: number;
        officialVersions?: ProgrammeDefinitionState["officialVersions"];
        programmes?: ProgrammeDefinitionState["programmes"];
        selectedProgrammeId?: string | null;
      };
      if (parsed?.version === 2 || parsed?.version === 3) {
        state = migrateToV4(parsed);
        persist();
        for (const legacy of LEGACY_KEYS) {
          window.localStorage.removeItem(legacy);
        }
        return;
      }
    }
  } catch {
    /* ignore */
  }
}

export function subscribeProgrammeDefinition(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProgrammeDefinitionSnapshot(): ProgrammeDefinitionState {
  hydrate();
  return state;
}

export function getProgrammeDefinitionServerSnapshot(): ProgrammeDefinitionState {
  return SERVER_SNAPSHOT;
}

export function replaceOfficialVersion(official: OfficialStandardVersion) {
  hydrate();
  const slim: OfficialStandardVersion = {
    ...official,
    // Keep Programme Builder localStorage small; full raw JSON lives in Supabase.
    occupationRawPayload:
      official.occupationRawPayload &&
      typeof official.occupationRawPayload === "object" &&
      "note" in (official.occupationRawPayload as object)
        ? official.occupationRawPayload
        : { note: "Raw payload kept in database only" },
    apprenticeshipRawPayload: null,
  };
  const priorForStandard = state.officialVersions.filter(
    (v) => v.standardCode === slim.standardCode,
  );
  const existingIdx = state.officialVersions.findIndex(
    (v) =>
      v.standardCode === slim.standardCode &&
      v.externalVersion === slim.externalVersion,
  );
  if (existingIdx >= 0) {
    const kept = state.officialVersions[existingIdx]!;
    pushActivity({
      kind: "official_cached",
      summary: `Official pack already held: ${kept.standardCode} v${kept.externalVersion}`,
      standardCode: kept.standardCode,
      externalVersion: kept.externalVersion,
      detail: {
        sourceHash: kept.sourceHash,
        duties: kept.duties.length,
        ksbs: kept.ksbs.length,
        result: "kept_existing_snapshot",
      },
    });
    persist();
    emit();
    return kept;
  }

  const isNewVersion = priorForStandard.length > 0;
  state = {
    ...state,
    officialVersions: [...state.officialVersions, slim],
  };
  pushActivity({
    kind: isNewVersion ? "new_version" : "api_ok",
    summary: isNewVersion
      ? `New Skills England version detected: ${slim.standardCode} v${slim.externalVersion}`
      : `Official pack stored: ${slim.standardCode} v${slim.externalVersion}`,
    standardCode: slim.standardCode,
    externalVersion: slim.externalVersion,
    detail: {
      sourceHash: slim.sourceHash,
      duties: slim.duties.length,
      ksbs: slim.ksbs.length,
      minHours: slim.minimumComplianceHours,
      title: slim.title,
      priorVersions:
        priorForStandard.map((v) => v.externalVersion).join(", ") || null,
    },
  });
  persist();
  emit();
  return slim;
}

export function createProgrammeForOfficial(official: OfficialStandardVersion) {
  hydrate();
  // Reopen the same GTA draft for this ST + Skills England version (no duplicates).
  const existing = state.programmes.find(
    (p) =>
      p.standardVersionId === official.id ||
      (p.standardCode === official.standardCode &&
        p.externalVersion === official.externalVersion),
  );
  if (existing) {
    const synced: GtaProgrammeVersion = withParameters({
      ...existing,
      standardVersionId: official.id,
      standardCode: official.standardCode,
      externalVersion: official.externalVersion,
    });
    state = {
      ...state,
      programmes: state.programmes.map((p) =>
        p.id === existing.id ? synced : p,
      ),
      selectedProgrammeId: existing.id,
    };
    pushActivity({
      kind: "draft_reopened",
      summary: `Draft reopened: ${synced.programmeTitle}`,
      standardCode: synced.standardCode,
      externalVersion: synced.externalVersion,
      programmeId: synced.id,
      detail: {
        status: synced.status,
        spineItems: synced.spineItems.length,
      },
    });
    persist();
    emit();
    return synced;
  }

  const title = displayApprenticeshipTitle(
    official.standardCode,
    official.title,
  );

  const now = new Date().toISOString();
  const programme: GtaProgrammeVersion = {
    id: crypto.randomUUID(),
    programmeId: crypto.randomUUID(),
    programmeTitle: `${title} — GTA Delivery`,
    standardVersionId: official.id,
    standardCode: official.standardCode,
    externalVersion: official.externalVersion,
    internalVersion: "1",
    status: "draft",
    hasEnrolledApprentices: false,
    spineItems: emptySpine(),
    parameters: defaultProgrammeParameters(),
    createdAt: now,
    updatedAt: now,
  };

  state = {
    ...state,
    programmes: [...state.programmes, programme],
    selectedProgrammeId: programme.id,
  };
  pushActivity({
    kind: "programme_created",
    summary: `GTA draft created: ${programme.programmeTitle}`,
    standardCode: programme.standardCode,
    externalVersion: programme.externalVersion,
    programmeId: programme.id,
    detail: { status: programme.status },
  });
  persist();
  emit();
  return programme;
}

/** @deprecated Prefer createProgrammeForOfficial — no longer seeds Autocare. */
export function upsertAutocareProgramme(official: OfficialStandardVersion) {
  return createProgrammeForOfficial(official);
}

export function selectProgramme(id: string | null) {
  hydrate();
  state = { ...state, selectedProgrammeId: id };
  persist();
  emit();
}

export function updateProgrammeSpine(
  programmeId: string,
  updater: (programme: GtaProgrammeVersion) => GtaProgrammeVersion,
) {
  hydrate();
  const current = state.programmes.find((p) => p.id === programmeId);
  if (!current) return;
  if (isStructureLocked(current)) {
    // Structural lock — ignore spine/KSB mutations.
    return;
  }
  const updated = updater({ ...current, updatedAt: new Date().toISOString() });
  state = {
    ...state,
    programmes: state.programmes.map((p) =>
      p.id === programmeId ? updated : p,
    ),
  };
  const spineChange = describeSpineChanges(
    current.spineItems,
    updated.spineItems,
  );
  pushActivity(
    {
      kind: "spine_saved",
      summary: spineChange.summary,
      standardCode: updated.standardCode,
      externalVersion: updated.externalVersion,
      programmeId: updated.id,
      detail: spineChange.detail,
    },
    { coalesceKind: "spine_saved" },
  );
  persist();
  emit();
}

/** Jon-owned delivery parameters (expected OTJ + RPL formula). Autsaves. */
export function updateProgrammeParameters(
  programmeId: string,
  patch: Partial<ProgrammeDeliveryParameters>,
) {
  hydrate();
  const current = state.programmes.find((p) => p.id === programmeId);
  if (!current) return;
  if (isStructureLocked(current)) return;

  const defaults = defaultProgrammeParameters();
  const formulaLocked =
    resolveFormulaStatus(current.parameters?.formulaStatus) === "published";

  const formulaFieldKeys: (keyof ProgrammeDeliveryParameters)[] = [
    "formulaKey",
    "formulaStatus",
    "includeAplK",
    "includeAplS",
    "includeAplB",
    "aplWeightK",
    "aplWeightS",
    "aplWeightB",
    "aplMaxFraction",
  ];
  if (
    formulaLocked &&
    formulaFieldKeys.some((key) => patch[key] !== undefined)
  ) {
    return;
  }

  const nextExpected =
    patch.expectedOtjHours === undefined
      ? current.parameters?.expectedOtjHours ?? null
      : patch.expectedOtjHours == null || Number.isNaN(Number(patch.expectedOtjHours))
        ? null
        : Math.max(0, Number(patch.expectedOtjHours));

  const nextIncludes = {
    includeAplK: resolveBool(
      patch.includeAplK !== undefined
        ? patch.includeAplK
        : current.parameters?.includeAplK,
      defaults.includeAplK,
    ),
    includeAplS: resolveBool(
      patch.includeAplS !== undefined
        ? patch.includeAplS
        : current.parameters?.includeAplS,
      defaults.includeAplS,
    ),
    includeAplB: resolveBool(
      patch.includeAplB !== undefined
        ? patch.includeAplB
        : current.parameters?.includeAplB,
      defaults.includeAplB,
    ),
  };

  // Keep at least one letter in the formula.
  if (!formulaHasIncludedLetters(nextIncludes)) {
    return;
  }

  state = {
    ...state,
    programmes: state.programmes.map((p) =>
      p.id === programmeId
        ? withParameters({
            ...p,
            parameters: {
              ...defaults,
              ...p.parameters,
              ...patch,
              ...nextIncludes,
              expectedOtjHours: nextExpected,
              formulaKey: resolveFormulaKey(
                patch.formulaKey ?? p.parameters?.formulaKey,
              ),
              formulaStatus: resolveFormulaStatus(
                patch.formulaStatus ?? p.parameters?.formulaStatus,
              ),
              aplWeightK: clampWeight(
                patch.aplWeightK !== undefined
                  ? patch.aplWeightK
                  : p.parameters?.aplWeightK,
                defaults.aplWeightK,
              ),
              aplWeightS: clampWeight(
                patch.aplWeightS !== undefined
                  ? patch.aplWeightS
                  : p.parameters?.aplWeightS,
                defaults.aplWeightS,
              ),
              aplWeightB: clampWeight(
                patch.aplWeightB !== undefined
                  ? patch.aplWeightB
                  : p.parameters?.aplWeightB,
                defaults.aplWeightB,
              ),
              aplMaxFraction: clampFraction(
                patch.aplMaxFraction !== undefined
                  ? patch.aplMaxFraction
                  : p.parameters?.aplMaxFraction,
                defaults.aplMaxFraction,
              ),
              rplNotes:
                patch.rplNotes !== undefined
                  ? patch.rplNotes
                  : (p.parameters?.rplNotes ?? ""),
            },
            updatedAt: new Date().toISOString(),
          })
        : p,
    ),
  };

  const nextProgramme = state.programmes.find((p) => p.id === programmeId);
  const described = nextProgramme
    ? describeParameterChanges(
        current.parameters,
        nextProgramme.parameters,
        patch,
      )
    : null;

  if (described && described.changes) {
    const coalesceKey = Object.keys(patch)
      .filter((k) => patch[k as keyof ProgrammeDeliveryParameters] !== undefined)
      .sort()
      .join("|");
    pushActivity(
      {
        kind: "parameters_saved",
        summary: described.summary,
        standardCode: current.standardCode,
        externalVersion: current.externalVersion,
        programmeId: current.id,
        detail: {
          ...described.detail,
          changes: described.changes,
        },
      },
      {
        // Only merge rapid edits of the *same* field(s); different params get new rows.
        coalesceKind: "parameters_saved",
        coalesceKey,
        coalesceMs: 8_000,
      },
    );
  }
  persist();
  emit();
}

/**
 * Lock the RPL formula snapshot for this programme version.
 * Separate from spine publish.
 */
export function publishProgrammeFormula(
  programmeId: string,
): { ok: true } | { ok: false; error: string } {
  hydrate();
  const current = state.programmes.find((p) => p.id === programmeId);
  if (!current) return { ok: false, error: "Programme not found." };
  if (isStructureLocked(current)) {
    return {
      ok: false,
      error: "This version is locked — the formula cannot be changed.",
    };
  }
  if (current.parameters?.formulaStatus === "published") {
    return { ok: false, error: "This formula is already published." };
  }
  if (!formulaHasIncludedLetters(current.parameters)) {
    return {
      ok: false,
      error: "Include at least one of K, S, or B before publishing the formula.",
    };
  }

  state = {
    ...state,
    programmes: state.programmes.map((p) =>
      p.id === programmeId
        ? withParameters({
            ...p,
            parameters: {
              ...p.parameters,
              formulaStatus: "published",
            },
            updatedAt: new Date().toISOString(),
          })
        : p,
    ),
  };
  pushActivity({
    kind: "formula_published",
    summary: `RPL formula published for ${current.programmeTitle}`,
    standardCode: current.standardCode,
    externalVersion: current.externalVersion,
    programmeId: current.id,
    detail: {
      formulaKey: current.parameters.formulaKey,
      includeK: current.parameters.includeAplK,
      includeS: current.parameters.includeAplS,
      includeB: current.parameters.includeAplB,
      maxAplPercent: Math.round(current.parameters.aplMaxFraction * 100),
    },
  });
  persist();
  emit();
  return { ok: true };
}

/**
 * Mark a programme version published.
 * Structure stays editable until learners are enrolled on this version.
 */
export function publishProgramme(
  programmeId: string,
): { ok: true } | { ok: false; error: string } {
  hydrate();
  const current = state.programmes.find((p) => p.id === programmeId);
  if (!current) return { ok: false, error: "Programme not found." };
  if (isStructureLocked(current)) {
    return {
      ok: false,
      error:
        "This version has learners (or is archived/superseded) and cannot be re-published from here.",
    };
  }
  if (current.status === "published") {
    return { ok: false, error: "This programme is already published." };
  }

  state = {
    ...state,
    programmes: state.programmes.map((p) =>
      p.id === programmeId
        ? {
            ...p,
            status: "published",
            updatedAt: new Date().toISOString(),
          }
        : p,
    ),
  };
  pushActivity({
    kind: "spine_published",
    summary: `Spine published: ${current.programmeTitle}`,
    standardCode: current.standardCode,
    externalVersion: current.externalVersion,
    programmeId: current.id,
    detail: {
      spineItems: current.spineItems.length,
      formulaStatus: current.parameters.formulaStatus,
    },
  });
  persist();
  emit();
  return { ok: true };
}

/** Soft wording update — allowed even when structure is locked. */
export function updateProgrammeTitle(programmeId: string, title: string) {
  hydrate();
  const current = state.programmes.find((p) => p.id === programmeId);
  const trimmed = title.trim();
  if (!trimmed) return;
  state = {
    ...state,
    programmes: state.programmes.map((p) =>
      p.id === programmeId
        ? { ...p, programmeTitle: trimmed, updatedAt: new Date().toISOString() }
        : p,
    ),
  };
  if (current) {
    pushActivity({
      kind: "title_saved",
      summary: `Title updated to “${trimmed}”`,
      standardCode: current.standardCode,
      externalVersion: current.externalVersion,
      programmeId: current.id,
    });
  }
  persist();
  emit();
}

/** Leave the builder detail view; draft remains saved. */
export function goBackToCatalogue() {
  selectProgramme(null);
}

export function clearProgrammeDefinitionPreview() {
  hydrate();
  state = emptyState();
  persist();
  emit();
}
