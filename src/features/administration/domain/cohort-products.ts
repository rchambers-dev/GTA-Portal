/**
 * Cohort product = Skills England pack version + delivery spine.
 * Same official version (e.g. 1.3) can run on groups (Temp) or blocks (Main).
 */

import {
  st0499KsbForApprenticeshipVersion,
  type OfficialKsbVersion,
} from "@/features/programme-delivery/domain/st0499-ksb-catalog";

export type DeliverySpine = "groups" | "blocks";

export type CohortProductId =
  | "st0499-1.1-groups"
  | "st0499-1.2-groups"
  | "st0499-1.3-groups"
  | "st0499-1.3-blocks";

export type CohortProduct = {
  id: CohortProductId;
  /** Skills England apprenticeship version stored on the cohort. */
  standardVersion: string;
  deliverySpine: DeliverySpine;
  standardCode: "ST0499";
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

/** Official ST0499 apprenticeship version windows (Skills England / IfATE). */
const ST0499_VERSION_WINDOWS: Record<
  string,
  { validFrom: string; validTo: string | null }
> = {
  "1.1": { validFrom: "Oct 2022", validTo: "Jan 2025" },
  "1.2": { validFrom: "Jan 2025", validTo: "Sep 2025" },
  "1.3": { validFrom: "Sep 2025", validTo: null },
};

function packShapeLabel(pack: OfficialKsbVersion | undefined): string {
  if (!pack) return "KSB pack";
  const { knowledge: k, skills: s, behaviours: b } = pack.counts;
  const flat = pack.occupationVersion === "1.1";
  return flat
    ? `Flat KSBs · ${k}K / ${s}S / ${b}B`
    : `Expanded KSBs · ${k}K / ${s}S / ${b}B`;
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

function buildAutocareProduct(
  id: CohortProductId,
  standardVersion: string,
  deliverySpine: DeliverySpine,
  whoFor: string,
  labelNote?: string,
): CohortProduct {
  const pack = st0499KsbForApprenticeshipVersion(standardVersion);
  const shape = packShapeLabel(pack);
  const window = ST0499_VERSION_WINDOWS[standardVersion] ?? {
    validFrom: "—",
    validTo: null,
  };
  const dates = formatVersionWindow(window.validFrom, window.validTo);
  const range = window.validTo
    ? `${window.validFrom}–${window.validTo}`
    : `${window.validFrom}–current`;
  const note = labelNote ? ` · ${labelNote}` : "";
  return {
    id,
    standardVersion,
    deliverySpine,
    standardCode: "ST0499",
    label: `${standardVersion} · ${deliverySpineLabel(deliverySpine)} · ${range}${note}`,
    validFrom: window.validFrom,
    validTo: window.validTo,
    summary: `${dates}. ${shape}. ${whoFor}`,
  };
}

/** Autocare (ST0499) selectable products — pack + spine locked together. */
export const AUTOCARE_COHORT_PRODUCTS: CohortProduct[] = [
  buildAutocareProduct(
    "st0499-1.1-groups",
    "1.1",
    "groups",
    "Legacy for new starts. Flat list (covers ST0499 1.0/1.1). Finish existing groups / CEA cohorts on this product.",
  ),
  buildAutocareProduct(
    "st0499-1.2-groups",
    "1.2",
    "groups",
    "Legacy for new starts. Expanded catalogue. Finish existing groups / CEA cohorts on this product.",
  ),
  buildAutocareProduct(
    "st0499-1.3-groups",
    "1.3",
    "groups",
    "Same current Skills England pack. Use for live Temp / groups cohorts. When the next blocks intake opens, treat this as legacy for new starts — existing apprentices stay on groups until they finish.",
    "live groups",
  ),
  buildAutocareProduct(
    "st0499-1.3-blocks",
    "1.3",
    "blocks",
    "Same current Skills England pack. Preferred product for new enrolments once blocks intakes open (portal spine changes; pack does not).",
    "new starts",
  ),
];

export function isAutocareStandard(standardCode: string): boolean {
  return standardCode.trim().toUpperCase() === "ST0499";
}

export function findAutocareProduct(
  standardVersion: string,
  deliverySpine: DeliverySpine | string | null | undefined,
): CohortProduct | undefined {
  const version = standardVersion.trim().replace(/^v/i, "");
  const spine = normalizeDeliverySpine(deliverySpine);
  // 1.0 shares the 1.1 occupation pack — map to the 1.1 groups product.
  const normalizedVersion = version === "1.0" ? "1.1" : version;
  return AUTOCARE_COHORT_PRODUCTS.find(
    (p) => p.standardVersion === normalizedVersion && p.deliverySpine === spine,
  );
}

export function autocareProductById(
  id: string,
): CohortProduct | undefined {
  return AUTOCARE_COHORT_PRODUCTS.find((p) => p.id === id);
}

export function resolveAutocareProductId(
  standardVersion: string,
  deliverySpine: DeliverySpine | string | null | undefined,
): CohortProductId | "" {
  return findAutocareProduct(standardVersion, deliverySpine)?.id ?? "";
}

/** Pack metadata for hints under the picker. */
export function st0499PackForVersion(
  standardVersion: string,
): OfficialKsbVersion | undefined {
  return st0499KsbForApprenticeshipVersion(standardVersion);
}
