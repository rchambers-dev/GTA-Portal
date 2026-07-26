/**
 * Client-side mutable store for progressive pack item data on Learners.
 * Keyed by learnerId → ADM14 reference. Persists in localStorage.
 */

import { ADM14_REQUIREMENTS } from "./adm14-checklist";
import {
  emptyPackItem,
  requirementMeta,
  type PackItemRecord,
} from "./pack-item-model";
import type { EvidenceRequirementRowDto } from "../types";

const STORAGE_KEY = "gta-portal.learner-pack.v1";

type PackSnapshot = {
  version: 1;
  /** learnerId → reference → record */
  byLearner: Record<string, Record<string, PackItemRecord>>;
};

type Listener = () => void;

let snapshot: PackSnapshot = { version: 1, byLearner: {} };
let hydrated = false;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PackSnapshot;
    if (parsed?.version === 1 && parsed.byLearner) {
      snapshot = parsed;
    }
  } catch {
    // ignore corrupt cache
  }
}

export function subscribePackStore(listener: Listener): () => void {
  ensureHydrated();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPackSnapshot(): PackSnapshot {
  ensureHydrated();
  return snapshot;
}

export function getPackItem(
  learnerId: string,
  reference: string,
): PackItemRecord | null {
  ensureHydrated();
  return snapshot.byLearner[learnerId]?.[reference] ?? null;
}

export function upsertPackItem(
  learnerId: string,
  reference: string,
  patch: Partial<PackItemRecord>,
): PackItemRecord {
  ensureHydrated();
  const meta = requirementMeta(reference);
  const existing =
    snapshot.byLearner[learnerId]?.[reference] ??
    emptyPackItem(reference, meta?.endOfProgramme ?? false);
  const next: PackItemRecord = {
    ...existing,
    ...patch,
    fields: { ...existing.fields, ...(patch.fields ?? {}) },
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    byLearner: {
      ...snapshot.byLearner,
      [learnerId]: {
        ...(snapshot.byLearner[learnerId] ?? {}),
        [reference]: next,
      },
    },
  };
  emit();
  return next;
}

/** Overlay stored edits onto the workspace evidence rows. */
export function mergePackOntoRows(
  learnerId: string,
  rows: EvidenceRequirementRowDto[],
): EvidenceRequirementRowDto[] {
  ensureHydrated();
  const learnerPack = snapshot.byLearner[learnerId];
  if (!learnerPack) return rows;

  return rows.map((row) => {
    const stored = learnerPack[row.reference];
    if (!stored) return row;
    const fieldFilled = Object.values(stored.fields).some((v) => v.trim());
    const evidenceCount =
      stored.evidenceLabel.trim() || fieldFilled
        ? Math.max(row.evidenceCount, 1)
        : row.evidenceCount;
    return {
      ...row,
      status: stored.status,
      notes: stored.notes || row.notes,
      dateReceived: stored.dateReceived || row.dateReceived,
      checkedBy: stored.checkedBy || row.checkedBy,
      dateChecked: stored.dateChecked || row.dateChecked,
      evidenceCount,
    };
  });
}

/** Build blank ADM14 rows for a newly enrolled admin learner (no demo overlays). */
export function buildBlankPackRows(): EvidenceRequirementRowDto[] {
  return ADM14_REQUIREMENTS.map((item) => ({
    id: `adm14-${item.reference}`,
    sectionKey: item.sectionKey,
    sectionTitle: item.sectionTitle,
    originalBookletSection: item.originalBookletSection,
    reference: item.reference,
    requirementKind: item.requirementKind,
    title: item.title,
    applicability: item.applicability,
    status: item.endOfProgramme
      ? ("future_requirement" as const)
      : ("missing" as const),
    dateReceived: null,
    checkedBy: null,
    dateChecked: null,
    notes: null,
    evidenceCount: 0,
    isRecurring: item.isRecurring,
  }));
}
