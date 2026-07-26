/**
 * Client store for staff employment file items.
 * Keyed by staff user id → checklist reference. Persists in localStorage.
 *
 * Checklist content is assumed until the real form lands — swap the
 * requirements module without changing this store shape.
 */

import {
  STAFF_EMPLOYMENT_REQUIREMENTS,
  type StaffDocRequirement,
} from "./staff-employment-checklist";

export type StaffDocStatus =
  | "missing"
  | "requested"
  | "received"
  | "checked_and_accepted"
  | "not_applicable"
  | "expired";

export type StaffDocItemRecord = {
  status: StaffDocStatus;
  notes: string;
  dateReceived: string;
  checkedBy: string;
  dateChecked: string;
  evidenceLabel: string;
  updatedAt: string;
};

export type StaffDocRow = StaffDocRequirement & {
  id: string;
  status: StaffDocStatus;
  notes: string | null;
  dateReceived: string | null;
  checkedBy: string | null;
  dateChecked: string | null;
  evidenceLabel: string | null;
};

type StaffPackSnapshot = {
  version: 1;
  byStaff: Record<string, Record<string, StaffDocItemRecord>>;
};

const STORAGE_KEY = "gta-portal.staff-employment-pack.v1";

let snapshot: StaffPackSnapshot = { version: 1, byStaff: {} };
let hydrated = false;
const listeners = new Set<() => void>();

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
    const parsed = JSON.parse(raw) as StaffPackSnapshot;
    if (parsed?.version === 1 && parsed.byStaff) {
      snapshot = parsed;
    }
  } catch {
    // ignore corrupt cache
  }
}

function emptyItem(): StaffDocItemRecord {
  return {
    status: "missing",
    notes: "",
    dateReceived: "",
    checkedBy: "",
    dateChecked: "",
    evidenceLabel: "",
    updatedAt: new Date().toISOString(),
  };
}

export function subscribeStaffPackStore(listener: () => void): () => void {
  ensureHydrated();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStaffPackSnapshot(): StaffPackSnapshot {
  ensureHydrated();
  return snapshot;
}

export function upsertStaffDocItem(
  staffId: string,
  reference: string,
  patch: Partial<StaffDocItemRecord>,
): StaffDocItemRecord {
  ensureHydrated();
  const existing =
    snapshot.byStaff[staffId]?.[reference] ?? emptyItem();
  const next: StaffDocItemRecord = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    byStaff: {
      ...snapshot.byStaff,
      [staffId]: {
        ...(snapshot.byStaff[staffId] ?? {}),
        [reference]: next,
      },
    },
  };
  emit();
  return next;
}

export function buildStaffDocRows(staffId: string): StaffDocRow[] {
  ensureHydrated();
  const pack = snapshot.byStaff[staffId] ?? {};
  return STAFF_EMPLOYMENT_REQUIREMENTS.map((item) => {
    const stored = pack[item.reference];
    return {
      ...item,
      id: `staff-doc-${item.reference}`,
      status: stored?.status ?? "missing",
      notes: stored?.notes || null,
      dateReceived: stored?.dateReceived || null,
      checkedBy: stored?.checkedBy || null,
      dateChecked: stored?.dateChecked || null,
      evidenceLabel: stored?.evidenceLabel || null,
    };
  });
}

export function staffDocStatusLabel(status: StaffDocStatus): string {
  switch (status) {
    case "missing":
      return "Missing";
    case "requested":
      return "Requested";
    case "received":
      return "Received";
    case "checked_and_accepted":
      return "Checked";
    case "not_applicable":
      return "Not applicable";
    case "expired":
      return "Expired";
  }
}

export function isStaffDocGap(row: StaffDocRow): boolean {
  if (row.requirementKind === "conditional" && row.status === "not_applicable") {
    return false;
  }
  if (row.requirementKind !== "mandatory") return false;
  return (
    row.status === "missing" ||
    row.status === "requested" ||
    row.status === "expired"
  );
}

export function isStaffDocAttention(row: StaffDocRow): boolean {
  return row.status === "received" || row.status === "expired";
}
