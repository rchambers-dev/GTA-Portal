/**
 * Per-apprentice block RPL (K/S/B %) — management funding adjustments.
 * Invalid percentages are rejected (never silently clamped).
 */

import {
  emptyBlockRpl,
  type BlockRplInput,
} from "./rpl-funding-calc";
import {
  validateLearnerBlockRplPercents,
} from "@/features/programme-definition/domain/rpl-formulas";

type Snapshot = {
  version: 1;
  byApprentice: Record<string, Record<string, BlockRplInput>>;
};

const STORAGE_KEY = "gta-portal.apprentice-block-rpl.v1";
const EMPTY: Snapshot = { version: 1, byApprentice: {} };

let snapshot: Snapshot = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function persist(next: Snapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota
  }
}

function load(): Snapshot {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Snapshot;
    if (parsed?.version === 1 && parsed.byApprentice) return parsed;
  } catch {
    // ignore
  }
  return EMPTY;
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  snapshot = load();
  hydrated = true;
}

function emit() {
  for (const listener of listeners) listener();
}

function readStored(raw: BlockRplInput | undefined): BlockRplInput {
  if (!raw) return emptyBlockRpl();
  const check = validateLearnerBlockRplPercents(raw);
  if (!check.ok) return emptyBlockRpl();
  return {
    knowledgePct: raw.knowledgePct,
    skillsPct: raw.skillsPct,
    behavioursPct: raw.behavioursPct,
  };
}

export function subscribeApprenticeRplStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApprenticeRplSnapshot(): Snapshot {
  ensureHydrated();
  return snapshot;
}

export function getApprenticeRplServerSnapshot(): Snapshot {
  return EMPTY;
}

export function getApprenticeBlockRpl(
  apprenticeId: string,
  blockId: string | number,
): BlockRplInput {
  ensureHydrated();
  return readStored(
    snapshot.byApprentice[apprenticeId]?.[String(blockId)],
  );
}

export function getAllApprenticeBlockRpl(
  apprenticeId: string,
): Record<string, BlockRplInput> {
  ensureHydrated();
  const raw = snapshot.byApprentice[apprenticeId] ?? {};
  const out: Record<string, BlockRplInput> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = readStored(value);
  }
  return out;
}

/**
 * Persist learner RPL %. Rejects invalid values (non-finite or outside 0–100).
 */
export function setApprenticeBlockRpl(
  apprenticeId: string,
  blockId: string | number,
  input: BlockRplInput,
): { ok: true } | { ok: false; error: string } {
  ensureHydrated();
  const check = validateLearnerBlockRplPercents(input);
  if (!check.ok) {
    return { ok: false, error: check.message };
  }
  const nextInput: BlockRplInput = {
    knowledgePct: input.knowledgePct,
    skillsPct: input.skillsPct,
    behavioursPct: input.behavioursPct,
  };
  const apprentice = { ...(snapshot.byApprentice[apprenticeId] ?? {}) };
  apprentice[String(blockId)] = nextInput;
  snapshot = {
    ...snapshot,
    byApprentice: { ...snapshot.byApprentice, [apprenticeId]: apprentice },
  };
  persist(snapshot);
  emit();
  return { ok: true };
}

export function resetApprenticeBlockRpl(apprenticeId: string): void {
  ensureHydrated();
  const { [apprenticeId]: _removed, ...rest } = snapshot.byApprentice;
  snapshot = { ...snapshot, byApprentice: rest };
  persist(snapshot);
  emit();
}
