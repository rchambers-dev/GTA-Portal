/**
 * Per-learner block RPL (K/S/B %) — management funding adjustments.
 * Does not change learner-facing cohort week display (no fast-track UI).
 */

import {
  clampRplPct,
  emptyBlockRpl,
  type BlockRplInput,
} from "./rpl-funding-calc";

type Snapshot = {
  version: 1;
  byLearner: Record<string, Record<string, BlockRplInput>>;
};

const STORAGE_KEY = "gta-portal.learner-block-rpl.v1";
const EMPTY: Snapshot = { version: 1, byLearner: {} };

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
    if (parsed?.version === 1 && parsed.byLearner) return parsed;
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

export function subscribeLearnerRplStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLearnerRplSnapshot(): Snapshot {
  ensureHydrated();
  return snapshot;
}

export function getLearnerRplServerSnapshot(): Snapshot {
  return EMPTY;
}

export function getLearnerBlockRpl(
  learnerId: string,
  blockId: number,
): BlockRplInput {
  ensureHydrated();
  return (
    snapshot.byLearner[learnerId]?.[String(blockId)] ?? emptyBlockRpl()
  );
}

export function getAllLearnerBlockRpl(
  learnerId: string,
): Record<number, BlockRplInput> {
  ensureHydrated();
  const raw = snapshot.byLearner[learnerId] ?? {};
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

export function setLearnerBlockRpl(
  learnerId: string,
  blockId: number,
  input: BlockRplInput,
): void {
  ensureHydrated();
  const nextInput: BlockRplInput = {
    knowledgePct: clampRplPct(input.knowledgePct),
    skillsPct: clampRplPct(input.skillsPct),
    behavioursPct: clampRplPct(input.behavioursPct),
  };
  const learner = { ...(snapshot.byLearner[learnerId] ?? {}) };
  learner[String(blockId)] = nextInput;
  snapshot = {
    ...snapshot,
    byLearner: { ...snapshot.byLearner, [learnerId]: learner },
  };
  persist(snapshot);
  emit();
}

export function resetLearnerBlockRpl(learnerId: string): void {
  ensureHydrated();
  const { [learnerId]: _removed, ...rest } = snapshot.byLearner;
  snapshot = { ...snapshot, byLearner: rest };
  persist(snapshot);
  emit();
}
