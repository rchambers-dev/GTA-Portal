/** Same comparison as integrations/gta-reviews/server/app-state.js. */

const STAMP_KEYS = ["savedAt", "baseSavedAt", "version", "appBuild"];

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableValue(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableValue((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function sameSavedContent(left: Record<string, unknown> | null, right: Record<string, unknown> | null) {
  if (!left || !right) return false;
  const strip = (state: Record<string, unknown>) => {
    const copy = { ...state };
    for (const key of STAMP_KEYS) delete copy[key];
    return copy;
  };
  return stableValue(strip(left)) === stableValue(strip(right));
}

export function versionOf(payload: { version?: unknown } | null | undefined) {
  const text = payload?.version == null ? "" : String(payload.version);
  if (!/^\d+$/.test(text)) return 1;
  const version = Number(text);
  return version > 0 ? version : 1;
}

export function conflictBody(clientVersion: number, storedVersion: number, stored: unknown) {
  return {
    error: "Version conflict",
    clientVersion,
    storedVersion,
    state: stored || null,
    message: "Data was modified elsewhere. Please reload and try again.",
  };
}
