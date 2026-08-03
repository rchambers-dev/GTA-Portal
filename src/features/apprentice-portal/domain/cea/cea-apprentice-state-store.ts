/**
 * Shared client cache for groups-spine CEA state (Supabase-backed via API).
 * Mirrors the subscribe pattern used by the blocks task-submission store.
 */

import {
  createBlankCeaState,
  getGroupsPackById,
  type CeaApprenticeState,
  type CeaTaskKind,
  type CeaTaskProgress,
} from "@/features/apprentice-portal/domain/cea";

type CacheEntry = {
  state: CeaApprenticeState;
  loading: boolean;
  error: string | null;
  loaded: boolean;
};

const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();
const inflight = new Map<string, Promise<void>>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

let revision = 0;

function cacheKey(apprenticeId: string, packId: string): string {
  return `${apprenticeId}::${packId}`;
}

function emit() {
  revision += 1;
  for (const listener of listeners) listener();
}

export function subscribeCeaStateStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCeaStateStoreSnapshot(): number {
  return revision;
}

export function getCeaStateStoreServerSnapshot(): number {
  return 0;
}

export function getCachedCeaState(
  apprenticeId: string,
  packId: string,
): CacheEntry | null {
  if (!apprenticeId || !packId) return null;
  return cache.get(cacheKey(apprenticeId, packId)) ?? null;
}

function ensureBlankEntry(
  apprenticeId: string,
  packId: string,
): CacheEntry {
  const key = cacheKey(apprenticeId, packId);
  const existing = cache.get(key);
  if (existing) return existing;

  const pack = getGroupsPackById(packId);
  const state = pack
    ? createBlankCeaState(apprenticeId, pack)
    : {
        apprenticeId,
        packId,
        mandatoryByGroup: {},
        progress: {},
        milestoneReflections: {},
      };

  const entry: CacheEntry = {
    state,
    loading: false,
    error: null,
    loaded: false,
  };
  cache.set(key, entry);
  return entry;
}

export async function ensureCeaStateLoaded(
  apprenticeId: string,
  packId: string,
): Promise<CeaApprenticeState> {
  if (!apprenticeId || !packId) {
    throw new Error("apprenticeId and packId are required");
  }

  const key = cacheKey(apprenticeId, packId);
  const entry = ensureBlankEntry(apprenticeId, packId);
  if (entry.loaded && !entry.loading) return entry.state;

  const pending = inflight.get(key);
  if (pending) {
    await pending;
    return cache.get(key)?.state ?? entry.state;
  }

  entry.loading = true;
  entry.error = null;
  emit();

  const loadPromise = (async () => {
    try {
      const res = await fetch(
        `/api/apprentice/cea-state?apprenticeId=${encodeURIComponent(apprenticeId)}&packId=${encodeURIComponent(packId)}`,
      );
      const json = (await res.json().catch(() => ({}))) as {
        state?: CeaApprenticeState;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || `Failed to load CEA state (${res.status})`);
      }
      if (json.state) {
        entry.state = json.state;
      }
      entry.loaded = true;
      entry.error = null;
    } catch (err) {
      entry.error = err instanceof Error ? err.message : "Failed to load";
      entry.loaded = true;
    } finally {
      entry.loading = false;
      inflight.delete(key);
      emit();
    }
  })();

  inflight.set(key, loadPromise);
  await loadPromise;
  return entry.state;
}

async function persistNow(apprenticeId: string, packId: string) {
  const entry = cache.get(cacheKey(apprenticeId, packId));
  if (!entry) return;

  const res = await fetch("/api/apprentice/cea-state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apprenticeId,
      packId,
      state: entry.state,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    state?: CeaApprenticeState;
    error?: string;
  };
  if (!res.ok) {
    entry.error = json.error || `Failed to save (${res.status})`;
    emit();
    return;
  }
  if (json.state) {
    entry.state = json.state;
    entry.loaded = true;
    entry.error = null;
    emit();
  }
}

function schedulePersist(apprenticeId: string, packId: string) {
  const key = cacheKey(apprenticeId, packId);
  const existing = saveTimers.get(key);
  if (existing) clearTimeout(existing);
  saveTimers.set(
    key,
    setTimeout(() => {
      saveTimers.delete(key);
      void persistNow(apprenticeId, packId);
    }, 400),
  );
}

export function updateCeaState(
  apprenticeId: string,
  packId: string,
  updater: (prev: CeaApprenticeState) => CeaApprenticeState,
  opts?: { persist?: boolean },
): CeaApprenticeState {
  const entry = ensureBlankEntry(apprenticeId, packId);
  entry.state = updater(entry.state);
  emit();
  if (opts?.persist !== false) {
    schedulePersist(apprenticeId, packId);
  }
  return entry.state;
}

export function emptyCeaTaskProgress(
  taskId: string,
  kind: CeaTaskKind,
): CeaTaskProgress {
  return {
    taskId,
    kind,
    additionalEnabled: false,
    status: "not_started",
    apprenticeNotes: "",
    readyAt: null,
    signedOffByRole: null,
    signedOffByName: null,
    signedOffAt: null,
    returnNote: null,
  };
}

/** Flush pending debounce immediately (e.g. before navigation). */
export async function flushCeaStateSave(
  apprenticeId: string,
  packId: string,
): Promise<void> {
  const key = cacheKey(apprenticeId, packId);
  const timer = saveTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    saveTimers.delete(key);
  }
  await persistNow(apprenticeId, packId);
}
