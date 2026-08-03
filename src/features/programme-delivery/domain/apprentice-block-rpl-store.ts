/**
 * Per-apprentice block RPL (K/S/B %) — management funding adjustments.
 * Does not change apprentice-facing cohort week display (no fast-track UI).
 */

import {
  clampRplPct,
  emptyBlockRpl,
  type BlockRplInput,
} from "./rpl-funding-calc";

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
  blockId: number,
): BlockRplInput {
  ensureHydrated();
  return (
    snapshot.byApprentice[apprenticeId]?.[String(blockId)] ?? emptyBlockRpl()
  );
}

export function getAllApprenticeBlockRpl(
  apprenticeId: string,
): Record<number, BlockRplInput> {
  ensureHydrated();
  const raw = snapshot.byApprentice[apprenticeId] ?? {};
  const out: Record<number, BlockRplInput> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[Number(key)] = {
      knowledgePct: clampRplPct(value.knowledgePct),
      skillsPct: clampRplPct(value.skillsPct),
      behavioursPct: clampRplPct(value.behavioursPct),
    };
  }
  return out;
}

export function setApprenticeBlockRpl(
  apprenticeId: string,
  blockId: number,
  input: BlockRplInput,
): void {
  ensureHydrated();
  const nextInput: BlockRplInput = {
    knowledgePct: clampRplPct(input.knowledgePct),
    skillsPct: clampRplPct(input.skillsPct),
    behavioursPct: clampRplPct(input.behavioursPct),
  };
  const apprentice = { ...(snapshot.byApprentice[apprenticeId] ?? {}) };
  apprentice[String(blockId)] = nextInput;
  snapshot = {
    ...snapshot,
    byApprentice: { ...snapshot.byApprentice, [apprenticeId]: apprentice },
  };
  persist(snapshot);
  emit();
}

export function resetApprenticeBlockRpl(apprenticeId: string): void {
  ensureHydrated();
  const { [apprenticeId]: _removed, ...rest } = snapshot.byApprentice;
  snapshot = { ...snapshot, byApprentice: rest };
  persist(snapshot);
  emit();
}
