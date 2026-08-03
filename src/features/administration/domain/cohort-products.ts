/**
 * Cohort product = Skills England pack version + delivery spine.
 * Same official version (e.g. 1.3) can run on groups (Temp) or blocks (Main).
 *
 * Per standard: legacy groups · current groups · GTA blocks (same newest SE version).
 * Autocare also keeps 1.1-groups as finishers-only.
 */

export type DeliverySpine = "groups" | "blocks";

export type StandardCode =
  | "ST0499"
  | "ST0068"
  | "ST0033"
  | "ST0448"
  | "ST0403";

export type CohortProductId = string;

export type CohortProduct = {
  id: CohortProductId;
  /** Skills England apprenticeship version stored on the cohort. */
  standardVersion: string;
  deliverySpine: DeliverySpine;
  standardCode: StandardCode;
  /** Short picker label. */
  label: string;
  /** When this Skills England version became available for new starts. */
  validFrom: string;
  /**
   * When newer version superseded it for new starts (null = current).
   * Existing cohorts on this version still finish on it.
   */
  validTo: string | null;
  /** One-line staff hint. */
  summary: string;
  /** When true, product is finish-existing-only (not primary triad). */
  finishersOnly?: boolean;
};

const SPINE_LABEL: Record<DeliverySpine, string> = {
  groups: "Groups",
  blocks: "Blocks",
};

export function normalizeDeliverySpine(
  value: string | null | undefined,
): DeliverySpine {
  return value === "blocks" ? "blocks" : "groups";
}

export function deliverySpineLabel(spine: DeliverySpine): string {
  return SPINE_LABEL[spine];
}

/** e.g. "v1.3 · Groups" */
export function formatCohortProductLabel(
  standardVersion: string,
  deliverySpine: DeliverySpine | string | null | undefined,
): string {
  const version = standardVersion.trim().replace(/^v/i, "");
  if (!version) return "";
  const spine = deliverySpineLabel(normalizeDeliverySpine(deliverySpine));
  return `v${version} · ${spine}`;
}

/** e.g. "Skills England: Started Oct 2022 · Finished Jan 2025" */
export function formatVersionWindow(
  validFrom: string,
  validTo: string | null,
): string {
  if (validTo) {
    return `Skills England pack: Started ${validFrom} · Finished ${validTo}`;
  }
  return `Skills England pack: Started ${validFrom} · Current`;
}

type VersionWindow = { validFrom: string; validTo: string | null };

/** Skills England version windows per standard. */
const VERSION_WINDOWS: Record<StandardCode, Record<string, VersionWindow>> = {
  ST0499: {
    "1.1": { validFrom: "Oct 2022", validTo: "Jan 2025" },
    "1.2": { validFrom: "Jan 2025", validTo: "Sep 2025" },
    "1.3": { validFrom: "Sep 2025", validTo: null },
  },
  ST0068: {
    "1.4": { validFrom: "Sep 2024", validTo: "Oct 2024" },
    "1.5": { validFrom: "Oct 2024", validTo: null },
  },
  ST0033: {
    "1.4": { validFrom: "Jun 2023", validTo: "Apr 2024" },
    "1.5": { validFrom: "Apr 2024", validTo: null },
  },
  ST0448: {
    "1.1": { validFrom: "Nov 2023", validTo: "Jul 2024" },
    "1.2": { validFrom: "Aug 2024", validTo: null },
  },
  ST0403: {
    "1.2": { validFrom: "Aug 2024", validTo: "Jun 2025" },
    "1.3": { validFrom: "Jun 2025", validTo: null },
  },
};

/** Newest Skills England version per standard (current groups + GTA blocks). */
export const CURRENT_STANDARD_VERSION: Record<StandardCode, string> = {
  ST0499: "1.3",
  ST0068: "1.5",
  ST0033: "1.5",
  ST0448: "1.2",
  ST0403: "1.3",
};

/** Immediate previous version (legacy groups). */
export const LEGACY_STANDARD_VERSION: Record<StandardCode, string> = {
  ST0499: "1.2",
  ST0068: "1.4",
  ST0033: "1.4",
  ST0448: "1.1",
  ST0403: "1.2",
};

export const COURSE_STANDARD_CODES: StandardCode[] = [
  "ST0499",
  "ST0068",
  "ST0033",
  "ST0448",
  "ST0403",
];

const STANDARD_LABEL: Record<StandardCode, string> = {
  ST0499: "Autocare Technician L2",
  ST0068: "Heavy Vehicle Service & Maintenance L3",
  ST0033: "Light Vehicle Service & Maintenance L3",
  ST0448: "Vehicle Damage Paint Technician L3",
  ST0403: "Vehicle Damage Panel Technician L3",
};

export function standardLabel(code: string): string {
  const key = code.trim().toUpperCase() as StandardCode;
  return STANDARD_LABEL[key] ?? code;
}

export function normalizeStandardCode(
  value: string | null | undefined,
): StandardCode | null {
  const code = (value ?? "").trim().toUpperCase();
  return COURSE_STANDARD_CODES.includes(code as StandardCode)
    ? (code as StandardCode)
    : null;
}

function productId(
  code: StandardCode,
  version: string,
  spine: DeliverySpine,
): string {
  return `${code.toLowerCase()}-${version}-${spine}`;
}

function buildProduct(
  standardCode: StandardCode,
  standardVersion: string,
  deliverySpine: DeliverySpine,
  whoFor: string,
  opts?: { labelNote?: string; finishersOnly?: boolean },
): CohortProduct {
  const window = VERSION_WINDOWS[standardCode]?.[standardVersion] ?? {
    validFrom: "—",
    validTo: null,
  };
  const dates = formatVersionWindow(window.validFrom, window.validTo);
  const range = window.validTo
    ? `${window.validFrom}–${window.validTo}`
    : `${window.validFrom}–current`;
  const note = opts?.labelNote ? ` · ${opts.labelNote}` : "";
  return {
    id: productId(standardCode, standardVersion, deliverySpine),
    standardVersion,
    deliverySpine,
    standardCode,
    label: `${standardVersion} · ${deliverySpineLabel(deliverySpine)} · ${range}${note}`,
    validFrom: window.validFrom,
    validTo: window.validTo,
    summary: `${dates}. KSBs pending staff mapping. ${whoFor}`,
    finishersOnly: opts?.finishersOnly,
  };
}

function triadFor(standardCode: StandardCode): CohortProduct[] {
  const legacy = LEGACY_STANDARD_VERSION[standardCode];
  const current = CURRENT_STANDARD_VERSION[standardCode];
  return [
    buildProduct(
      standardCode,
      legacy,
      "groups",
      "Legacy groups spine — previous Skills England version. Tutors edit structure; Jon maps KSBs.",
      { labelNote: "legacy groups" },
    ),
    buildProduct(
      standardCode,
      current,
      "groups",
      "Current groups spine — newest Skills England version. Same pack version as GTA blocks.",
      { labelNote: "current groups" },
    ),
    buildProduct(
      standardCode,
      current,
      "blocks",
      "GTA forward blocks spine (10+2 empty shells). Same Skills England version as current groups.",
      { labelNote: "GTA blocks" },
    ),
  ];
}

/** All selectable products across standards. */
export const ALL_COHORT_PRODUCTS: CohortProduct[] = [
  // Autocare finishers-only (1.0/1.1 flat pack)
  buildProduct(
    "ST0499",
    "1.1",
    "groups",
    "Finishers only. Flat KSB era (covers ST0499 1.0/1.1). Not for new starts.",
    { labelNote: "finishers", finishersOnly: true },
  ),
  ...COURSE_STANDARD_CODES.flatMap(triadFor),
];

/** @deprecated Prefer ALL_COHORT_PRODUCTS / productsForStandard */
export const AUTOCARE_COHORT_PRODUCTS: CohortProduct[] = productsForStandard(
  "ST0499",
  { includeFinishers: true },
);

export function productsForStandard(
  standardCode: string | null | undefined,
  opts?: { includeFinishers?: boolean },
): CohortProduct[] {
  const code = normalizeStandardCode(standardCode);
  if (!code) return [];
  return ALL_COHORT_PRODUCTS.filter((p) => {
    if (p.standardCode !== code) return false;
    if (p.finishersOnly && !opts?.includeFinishers) return false;
    return true;
  });
}

/** Primary triad only (legacy groups, current groups, GTA blocks). */
export function primaryProductsForStandard(
  standardCode: string | null | undefined,
): CohortProduct[] {
  return productsForStandard(standardCode, { includeFinishers: false });
}

export function isCourseStandard(standardCode: string): boolean {
  return normalizeStandardCode(standardCode) !== null;
}

export function isAutocareStandard(standardCode: string): boolean {
  return standardCode.trim().toUpperCase() === "ST0499";
}

export function findProduct(
  standardCode: string,
  standardVersion: string,
  deliverySpine: DeliverySpine | string | null | undefined,
): CohortProduct | undefined {
  const code = normalizeStandardCode(standardCode);
  if (!code) return undefined;
  let version = standardVersion.trim().replace(/^v/i, "");
  // Autocare 1.0 shares the 1.1 finishers product.
  if (code === "ST0499" && version === "1.0") version = "1.1";
  const spine = normalizeDeliverySpine(deliverySpine);
  return ALL_COHORT_PRODUCTS.find(
    (p) =>
      p.standardCode === code &&
      p.standardVersion === version &&
      p.deliverySpine === spine,
  );
}

/** @deprecated Prefer findProduct */
export function findAutocareProduct(
  standardVersion: string,
  deliverySpine: DeliverySpine | string | null | undefined,
): CohortProduct | undefined {
  return findProduct("ST0499", standardVersion, deliverySpine);
}

export function productById(id: string): CohortProduct | undefined {
  return ALL_COHORT_PRODUCTS.find((p) => p.id === id);
}

/** @deprecated Prefer productById */
export function autocareProductById(id: string): CohortProduct | undefined {
  return productById(id);
}

export function resolveProductId(
  standardCode: string,
  standardVersion: string,
  deliverySpine: DeliverySpine | string | null | undefined,
): CohortProductId | "" {
  return findProduct(standardCode, standardVersion, deliverySpine)?.id ?? "";
}

/** @deprecated Prefer resolveProductId */
export function resolveAutocareProductId(
  standardVersion: string,
  deliverySpine: DeliverySpine | string | null | undefined,
): CohortProductId | "" {
  return resolveProductId("ST0499", standardVersion, deliverySpine);
}

/** Default product for a new cohort on this standard (current groups). */
export function defaultProductForStandard(
  standardCode: string | null | undefined,
): CohortProduct | undefined {
  const code = normalizeStandardCode(standardCode);
  if (!code) return undefined;
  return findProduct(code, CURRENT_STANDARD_VERSION[code], "groups");
}
