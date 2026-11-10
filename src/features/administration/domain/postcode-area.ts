/**
 * UK postcode handling for employer sites.
 * normaliseUkPostcode matches public.normalise_uk_postcode.
 * The format matches employer_sites_postcode_format.
 */

const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2}$/;
const UNPARISHED_SUFFIX = /,?\s*unparished area\s*$/i;
const SAINT_DEDICATION = /^(st\.?|saint)\b/i;

export type PostcodePlace = {
  parish?: string | null;
  adminDistrict?: string | null;
  adminWard?: string | null;
  admin_district?: string | null;
  admin_ward?: string | null;
};

/** Uppercase, one space before the inward code. Short values are compacted only. */
export function normaliseUkPostcode(value: string): string {
  const compact = value.toUpperCase().replace(/\s/g, "");
  if (compact.length >= 5) {
    return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  }
  return compact;
}

export function isUkPostcode(value: string): boolean {
  return UK_POSTCODE_PATTERN.test(value);
}

/**
 * Town-style area from a postcodes.io result.
 * Prefer the parish with suffixes such as ", unparished area" removed.
 * A parish that is only the ward plus a saint dedication (Dinnington St. John's)
 * uses the ward, so S25 2AY becomes Dinnington. Otherwise fall back to admin_district,
 * which is how S1 1AA becomes Sheffield.
 */
export function areaFromPostcodePlace(place: PostcodePlace): string {
  const parish = tidyParishName(place.parish ?? "");
  const ward = (place.adminWard ?? place.admin_ward ?? "").trim();
  const district = (place.adminDistrict ?? place.admin_district ?? "").trim();
  if (parish && ward && parish.toLowerCase().startsWith(ward.toLowerCase())) {
    const rest = parish.slice(ward.length).trim();
    if (SAINT_DEDICATION.test(rest)) return ward;
  }
  return parish || district;
}

export function tidyParishName(parish: string): string {
  return parish.replace(UNPARISHED_SUFFIX, "").trim();
}
