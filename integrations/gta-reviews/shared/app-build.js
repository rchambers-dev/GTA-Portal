export const APP_BUILD = "out-165";

export function buildNumber(value) {
  const match = String(value || "").match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

export function isOutdatedBuild(clientBuild) {
  return buildNumber(clientBuild) < buildNumber(APP_BUILD);
}
