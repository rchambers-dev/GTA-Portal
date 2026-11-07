/**
 * Same shape as the existing portal apprentice reference:
 * `GTA-<year>-0` plus four digits taken from a random 10000–99999 value.
 * Retries when that value is already used. Does not invent a second scheme.
 */
export function generatePortalReference(
  random: () => number = Math.random,
  year: number = new Date().getFullYear(),
): string {
  const serial = String(Math.floor(random() * 90000) + 10000);
  return `GTA-${year}-0${serial.slice(0, 4)}`;
}

export function allocatePortalReference(
  existing: readonly string[],
  random: () => number = Math.random,
  year?: number,
): string {
  const taken = new Set(existing);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const reference = generatePortalReference(random, year);
    if (!taken.has(reference)) return reference;
  }
  throw new Error("Could not allocate a unique portal reference.");
}
