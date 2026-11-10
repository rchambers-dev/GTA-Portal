import { emptyState } from "../storage.js";

// Object.assign keeps keys the next copy does not mention. Sign-out and the
// next sign-in both start from an empty state so the previous account cannot
// leave a field behind.
export function replaceAccountState(state) {
  if (!state || typeof state !== "object") return state;
  const blank = emptyState();
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, blank);
  return state;
}

export function installLoadedState(state, loaded) {
  const next = { ...emptyState(), ...(loaded || {}) };
  for (const key of Object.keys(state)) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) delete state[key];
  }
  Object.assign(state, next);
  return state;
}
