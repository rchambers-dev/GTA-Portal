import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { conflictBody, sameSavedContent, versionOf } from "./version-rules";

/**
 * Disposable single-process server copy of the Review Assistant document.
 * It is the shared copy for this portal checkpoint. It is not browser
 * localStorage, and it is not the production app_state table. Production
 * still uses the unapplied save_app_state_if_version RPC after a reviewed
 * cutover. Set REVIEW_ASSISTANT_STATE_FILE only in tests.
 */
export type ReviewState = Record<string, unknown> & {
  version?: number;
  savedAt?: string;
  baseSavedAt?: string;
  appBuild?: string;
  learners?: Array<Record<string, unknown>>;
  savedReviews?: Array<Record<string, unknown>>;
  followUps?: Array<Record<string, unknown>>;
  archive?: Array<Record<string, unknown>>;
  analyticsEvents?: Array<Record<string, unknown>>;
  tutorFeedback?: Array<Record<string, unknown>>;
  settings?: Record<string, unknown>;
};

function emptyState(): ReviewState {
  return {
    version: 1,
    savedAt: "",
    learners: [],
    savedReviews: [],
    followUps: [],
    archive: [],
    analyticsEvents: [],
    settings: {},
    tutorFeedback: [],
  };
}

export function reviewStateFilePath() {
  const override = process.env.REVIEW_ASSISTANT_STATE_FILE;
  if (override) return override;
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    ".review-assistant",
    "state.json",
  );
}

export function readReviewState(): ReviewState {
  try {
    const parsed = JSON.parse(
      readFileSync(/*turbopackIgnore: true*/ reviewStateFilePath(), "utf8"),
    ) as ReviewState;
    if (!parsed || typeof parsed !== "object") return emptyState();
    parsed.version = versionOf(parsed);
    return parsed;
  } catch {
    return emptyState();
  }
}

export function saveReviewState(next: ReviewState, expectedVersion: number) {
  const stored = readReviewState();
  const storedVersion = versionOf(stored);
  if (expectedVersion !== storedVersion) {
    return { status: 409 as const, body: conflictBody(expectedVersion, storedVersion, stored) };
  }
  if (sameSavedContent(next, stored)) {
    return {
      status: 200 as const,
      body: { ok: true, unchanged: true, version: storedVersion, savedAt: stored.savedAt || "" },
    };
  }
  const saved: ReviewState = {
    ...next,
    version: storedVersion + 1,
    savedAt: new Date().toISOString(),
  };
  delete saved.appBuild;
  const target = reviewStateFilePath();
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(/*turbopackIgnore: true*/ target, JSON.stringify(saved));
  return {
    status: 200 as const,
    body: { ok: true, version: saved.version, savedAt: saved.savedAt },
  };
}
