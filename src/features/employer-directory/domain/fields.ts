import { RELEASE_DAYS, type ReleaseDay } from "./model";

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function normalizeMatchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function trimToEmpty(value: string | undefined): string {
  return (value ?? "").trim();
}

/** Blank is allowed. A non-empty value must be a real UK postcode. Nothing is guessed. */
export function optionalPostcode(
  value: string | undefined,
): { ok: true; value: string } | { ok: false; error: string } {
  const raw = trimToEmpty(value);
  if (!raw) return { ok: true, value: "" };
  const compact = raw.toUpperCase().replace(/\s+/g, "");
  const formatted =
    compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
  if (!UK_POSTCODE.test(formatted)) {
    return { ok: false, error: "Enter a valid UK postcode, or leave it blank." };
  }
  return { ok: true, value: formatted };
}

export function optionalEmail(
  value: string | undefined,
): { ok: true; value: string } | { ok: false; error: string } {
  const raw = trimToEmpty(value);
  if (!raw) return { ok: true, value: "" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { ok: false, error: "Enter a valid email address, or leave it blank." };
  }
  return { ok: true, value: raw };
}

export function optionalDate(
  value: string | undefined,
  label: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const raw = trimToEmpty(value);
  if (!raw) return { ok: true, value: null };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return { ok: false, error: `${label} must be a real date, or blank.` };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return { ok: false, error: `${label} must be a real date, or blank.` };
  }
  return { ok: true, value: raw };
}

export function optionalReleaseDay(
  value: string | undefined,
): { ok: true; value: "" | ReleaseDay } | { ok: false; error: string } {
  const raw = trimToEmpty(value);
  if (!raw) return { ok: true, value: "" };
  if ((RELEASE_DAYS as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as ReleaseDay };
  }
  return {
    ok: false,
    error: "Release day must be a weekday from Monday to Friday, or blank.",
  };
}
