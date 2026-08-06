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

const STORAGE_KEY = "gta.programmeDefinition.v1";

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
    if (parsed?.version === 1) state = parsed;
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
  return emptyState();
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
  const existing = state.programmes.find(
    (p) => p.standardVersionId === official.id,
  );
  if (existing) {
    state = { ...state, selectedProgrammeId: existing.id };
    persist();
    emit();
    return existing;
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
    internalVersion: "1",
    status: "draft",
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

export function clearProgrammeDefinitionPreview() {
  hydrate();
  state = emptyState();
  persist();
  emit();
}
