/**
 * ADM14 1.6 — Personal Learning Record (from DfE LRS).
 * Auto-retrieves when enrolment identity (name + ULN) is ready.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { getLrsPlrPort } from "@/adapters/lrs/lrs-plr-adapter";
import type {
  LrsGender,
  LrsLearnerIdentity,
  PlrLearningRecord,
  PlrQualification,
} from "../ports/lrs-plr";
import { getStoredEnrolmentForm } from "./enrolment-form-af11";

export const PLR_ADM14_REFERENCE = "1.6";

const STORAGE_KEY = "gta-plr-record-v1";
const CHANGE_EVENT = "gta-plr-record-changed";

export type PlrRplDecision = "pending" | "relevant" | "not_relevant";

export type PlrStoreState = {
  identity: LrsLearnerIdentity | null;
  record: PlrLearningRecord | null;
  /** Staff confirm which achievements may count toward RPL */
  rplDecisions: Record<string, PlrRplDecision>;
  rplNotes: Record<string, string>;
  status:
    | "idle"
    | "missing_identity"
    | "finding_uln"
    | "fetching"
    | "ready"
    | "privacy_blocked"
    | "not_verified"
    | "error";
  lastError: string | null;
  lastFetchedAt: string | null;
  autoFetchAttemptedForKey: string | null;
};

function emptyState(): PlrStoreState {
  return {
    identity: null,
    record: null,
    rplDecisions: {},
    rplNotes: {},
    status: "idle",
    lastError: null,
    lastFetchedAt: null,
    autoFetchAttemptedForKey: null,
  };
}

function readStored(): PlrStoreState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlrStoreState;
  } catch {
    return null;
  }
}

function writeStored(state: PlrStoreState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

let memoryState: PlrStoreState = emptyState();
let hydrated = false;

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  memoryState = readStored() ?? emptyState();
}

function setMemory(next: PlrStoreState) {
  memoryState = next;
  writeStored(next);
}

export function subscribePlrStore(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function getPlrSnapshot(): string {
  if (typeof window === "undefined") return "server";
  ensureHydrated();
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

export function getPlrStoreState(): PlrStoreState {
  ensureHydrated();
  return memoryState;
}

function mapSexToGender(sex: string): LrsGender {
  if (sex === "male") return "M";
  if (sex === "female") return "F";
  return "U";
}

/**
 * Build LRS identity from AF1.1 enrolment (and optional ULN override).
 */
export function identityFromEnrolment(
  ulnOverride?: string,
): LrsLearnerIdentity | null {
  const enrolment = getStoredEnrolmentForm();
  if (!enrolment) return null;
  const givenName = enrolment.firstName.trim();
  const familyName = enrolment.surname.trim();
  if (!givenName || !familyName) return null;

  return {
    uln: (ulnOverride ?? enrolment.uln).replace(/\D/g, "").slice(0, 10),
    givenName,
    familyName,
    dateOfBirth: enrolment.dateOfBirth || undefined,
    gender: mapSexToGender(enrolment.sex),
  };
}

export function identityReadyKey(identity: LrsLearnerIdentity | null): string {
  if (!identity) return "";
  return [
    identity.uln,
    identity.givenName.toLowerCase(),
    identity.familyName.toLowerCase(),
    identity.dateOfBirth ?? "",
  ].join("|");
}

export function isIdentityFetchReady(identity: LrsLearnerIdentity | null): boolean {
  if (!identity) return false;
  return (
    identity.givenName.trim().length > 0 &&
    identity.familyName.trim().length > 0 &&
    identity.uln.replace(/\D/g, "").length === 10
  );
}

function defaultDecisions(
  qualifications: PlrQualification[],
  previous?: Record<string, PlrRplDecision>,
): Record<string, PlrRplDecision> {
  const next: Record<string, PlrRplDecision> = {};
  for (const q of qualifications) {
    next[q.id] = previous?.[q.id] ?? "pending";
  }
  return next;
}

export async function refreshPlrFromLrs(options?: {
  force?: boolean;
  findUlnIfMissing?: boolean;
}): Promise<PlrStoreState> {
  ensureHydrated();
  const port = getLrsPlrPort();
  let identity = identityFromEnrolment();

  if (!identity) {
    const next = {
      ...memoryState,
      identity: null,
      status: "missing_identity" as const,
      lastError:
        "Complete AF1.1 enrolment with first name and surname before requesting a PLR.",
    };
    setMemory(next);
    return next;
  }

  // Find ULN if missing
  if (identity.uln.length !== 10 && options?.findUlnIfMissing !== false) {
    setMemory({
      ...memoryState,
      identity,
      status: "finding_uln",
      lastError: null,
    });
    const found = await port.findUln(identity);
    if (found.status === "found") {
      identity = { ...identity, uln: found.uln };
      // Persist ULN back onto enrolment draft when possible
      try {
        const enrolment = getStoredEnrolmentForm();
        if (enrolment && !enrolment.uln) {
          const updated = { ...enrolment, uln: found.uln };
          window.localStorage.setItem(
            "gta-af11-enrolment-form-v1",
            JSON.stringify(updated),
          );
          window.dispatchEvent(new Event("gta-af11-enrolment-changed"));
        }
      } catch {
        /* ignore */
      }
    } else {
      const next = {
        ...memoryState,
        identity,
        status: "missing_identity" as const,
        lastError: found.message,
        autoFetchAttemptedForKey: identityReadyKey(identity),
      };
      setMemory(next);
      return next;
    }
  }

  if (!isIdentityFetchReady(identity)) {
    const next = {
      ...memoryState,
      identity,
      status: "missing_identity" as const,
      lastError:
        "ULN (10 digits), given name and family name are required for LRS Get Learner Learning Events.",
    };
    setMemory(next);
    return next;
  }

  const key = identityReadyKey(identity);
  if (
    !options?.force &&
    memoryState.record &&
    memoryState.status === "ready" &&
    memoryState.autoFetchAttemptedForKey === key
  ) {
    return memoryState;
  }

  setMemory({
    ...memoryState,
    identity,
    status: "fetching",
    lastError: null,
  });

  const result = await port.getLearnerLearningEvents(identity);

  if (result.status === "ok") {
    const next: PlrStoreState = {
      identity,
      record: result.record,
      rplDecisions: defaultDecisions(
        result.record.qualifications,
        memoryState.rplDecisions,
      ),
      rplNotes: memoryState.rplNotes,
      status: "ready",
      lastError: null,
      lastFetchedAt: result.record.retrievedAt,
      autoFetchAttemptedForKey: key,
    };
    setMemory(next);
    return next;
  }

  const status =
    result.status === "privacy_blocked"
      ? "privacy_blocked"
      : result.status === "not_verified"
        ? "not_verified"
        : "error";

  const next: PlrStoreState = {
    ...memoryState,
    identity,
    status,
    lastError: result.message,
    autoFetchAttemptedForKey: key,
  };
  setMemory(next);
  return next;
}

/**
 * Auto-run when identity becomes ready (e.g. after enrolment save).
 */
export async function ensurePlrAutoFetched(): Promise<PlrStoreState> {
  ensureHydrated();
  const identity = identityFromEnrolment();
  if (!identity) {
    const next = {
      ...memoryState,
      status: "missing_identity" as const,
      lastError:
        "Waiting for AF1.1 first name and surname (and ULN) before auto PLR retrieval.",
    };
    setMemory(next);
    return next;
  }

  const key = identityReadyKey({
    ...identity,
    uln: identity.uln.length === 10 ? identity.uln : "pending",
  });

  if (
    memoryState.status === "ready" &&
    memoryState.record &&
    memoryState.autoFetchAttemptedForKey?.startsWith(
      `${identity.uln}|${identity.givenName.toLowerCase()}|${identity.familyName.toLowerCase()}`,
    )
  ) {
    return memoryState;
  }

  if (
    memoryState.autoFetchAttemptedForKey === key &&
    memoryState.status !== "ready" &&
    memoryState.status !== "idle"
  ) {
    return memoryState;
  }

  return refreshPlrFromLrs({ force: false, findUlnIfMissing: true });
}

export function setPlrRplDecision(
  qualificationId: string,
  decision: PlrRplDecision,
) {
  ensureHydrated();
  const next = {
    ...memoryState,
    rplDecisions: {
      ...memoryState.rplDecisions,
      [qualificationId]: decision,
    },
  };
  setMemory(next);
}

export function setPlrRplNote(qualificationId: string, note: string) {
  ensureHydrated();
  const next = {
    ...memoryState,
    rplNotes: {
      ...memoryState.rplNotes,
      [qualificationId]: note,
    },
  };
  setMemory(next);
}

export function getPlrDocumentsStatus():
  | "not_started"
  | "in_progress"
  | "complete"
  | "awaiting_document" {
  ensureHydrated();
  if (memoryState.status === "ready" && memoryState.record) {
    const decisions = Object.values(memoryState.rplDecisions);
    if (
      decisions.length > 0 &&
      decisions.every((d) => d === "relevant" || d === "not_relevant")
    ) {
      return "complete";
    }
    return "in_progress";
  }
  if (
    memoryState.status === "fetching" ||
    memoryState.status === "finding_uln"
  ) {
    return "in_progress";
  }
  if (memoryState.status === "missing_identity") return "not_started";
  return "not_started";
}

export function usePlrStore() {
  const snapshot = useSyncExternalStore(
    subscribePlrStore,
    getPlrSnapshot,
    () => "server",
  );

  const [, bump] = useState(0);
  useEffect(() => {
    ensureHydrated();
    bump((n) => n + 1);
  }, [snapshot]);

  const state = getPlrStoreState();

  const refresh = useCallback(async (force = true) => {
    return refreshPlrFromLrs({ force, findUlnIfMissing: true });
  }, []);

  const autoFetch = useCallback(async () => {
    return ensurePlrAutoFetched();
  }, []);

  return {
    state,
    refresh,
    autoFetch,
    setDecision: setPlrRplDecision,
    setNote: setPlrRplNote,
  };
}

export function formatPlrDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function plrSourceLabel(source: PlrQualification["source"]) {
  switch (source) {
    case "awarding_organisation":
      return "Awarding organisation";
    case "ilr":
      return "ILR";
    case "national_pupil_database":
      return "National Pupil Database";
    case "other":
      return "Other";
    default:
      return "Unknown";
  }
}
