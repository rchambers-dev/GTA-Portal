/**
 * Client store for Programme Builder preview.
 * Mirrors DB model; persists to localStorage until Supabase write-path is wired.
 */

import { buildAutocareSpineItems } from "./autocare-spine-seed";
import { displayApprenticeshipTitle } from "./programme-apprenticeships";
import type {
  GtaProgrammeVersion,
  OfficialStandardVersion,
  ProgrammeDefinitionState,
  SpineItem,
} from "./types";
import { emptyState } from "./validation";

const STORAGE_KEY = "gta.programmeDefinition.v2";

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

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as ProgrammeDefinitionState;
    if (parsed?.version === 2) state = normalizeState(parsed);
  } catch {
    /* ignore */
  }
}

function normalizeState(
  parsed: ProgrammeDefinitionState,
): ProgrammeDefinitionState {
  return {
    ...parsed,
    version: 2,
    programmes: (parsed.programmes || []).map((p) => ({
      ...p,
      standardCode: p.standardCode || "",
      externalVersion: p.externalVersion || "",
      hasEnrolledApprentices: Boolean(p.hasEnrolledApprentices),
    })),
  };
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
  const existingIdx = state.officialVersions.findIndex(
    (v) =>
      v.standardCode === official.standardCode &&
      v.externalVersion === official.externalVersion,
  );
  if (existingIdx >= 0) {
    // Immutable: keep first import; do not overwrite.
    return state.officialVersions[existingIdx]!;
  }
  state = {
    ...state,
    officialVersions: [...state.officialVersions, official],
  };
  persist();
  emit();
  return official;
}

export type CreateProgrammeOptions = {
  /** When true and a template exists (Autocare), seed spine. Otherwise empty EPA-ready skeleton. */
  useDeliveryTemplate?: boolean;
};

function emptySpineWithEpa(titlePrefix: string): SpineItem[] {
  return [
    {
      id: crypto.randomUUID(),
      itemType: "block",
      gatewayType: null,
      title: `${titlePrefix} — Block 1`,
      sequence: 1,
      plannedWeeks: null,
      plannedOtjHours: 0,
      countsTowardsLearningHours: true,
      assignedKsbCodes: [],
      metadata: { blockNumber: 1 },
    },
    {
      id: crypto.randomUUID(),
      itemType: "epa",
      gatewayType: null,
      title: "End-Point Assessment (EPA)",
      sequence: 2,
      plannedWeeks: 0,
      plannedOtjHours: 0,
      countsTowardsLearningHours: false,
      assignedKsbCodes: [],
      metadata: {},
    },
  ];
}

export function createProgrammeForOfficial(
  official: OfficialStandardVersion,
  opts?: CreateProgrammeOptions,
) {
  hydrate();
  // Reopen the same GTA draft for this ST + Skills England version (no duplicates).
  const existing = state.programmes.find(
    (p) =>
      p.standardVersionId === official.id ||
      (p.standardCode === official.standardCode &&
        p.externalVersion === official.externalVersion),
  );
  if (existing) {
    const synced: GtaProgrammeVersion = {
      ...existing,
      standardVersionId: official.id,
      standardCode: official.standardCode,
      externalVersion: official.externalVersion,
    };
    state = {
      ...state,
      programmes: state.programmes.map((p) =>
        p.id === existing.id ? synced : p,
      ),
      selectedProgrammeId: existing.id,
    };
    persist();
    emit();
    return synced;
  }

  const title = displayApprenticeshipTitle(
    official.standardCode,
    official.title,
  );
  const useTemplate =
    Boolean(opts?.useDeliveryTemplate) &&
    official.standardCode.toUpperCase() === "ST0499";

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
    spineItems: useTemplate
      ? buildAutocareSpineItems()
      : emptySpineWithEpa(title),
    createdAt: now,
    updatedAt: now,
  };

  state = {
    ...state,
    programmes: [...state.programmes, programme],
    selectedProgrammeId: programme.id,
  };
  persist();
  emit();
  return programme;
}

/** @deprecated Prefer createProgrammeForOfficial */
export function upsertAutocareProgramme(official: OfficialStandardVersion) {
  return createProgrammeForOfficial(official, { useDeliveryTemplate: true });
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
  if (
    current.hasEnrolledApprentices ||
    current.status === "published" ||
    current.status === "superseded" ||
    current.status === "archived"
  ) {
    // Structural lock — ignore spine/KSB mutations.
    return;
  }
  state = {
    ...state,
    programmes: state.programmes.map((p) =>
      p.id === programmeId
        ? updater({ ...p, updatedAt: new Date().toISOString() })
        : p,
    ),
  };
  persist();
  emit();
}

/** Soft wording update — allowed even when structure is locked. */
export function updateProgrammeTitle(programmeId: string, title: string) {
  hydrate();
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
