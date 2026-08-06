/**
 * Apprenticeships available in Programme Builder (display names first).
 * ST / OCC codes are technical identifiers only.
 */

import {
  COURSE_STANDARD_CODES,
  CURRENT_STANDARD_VERSION,
  standardLabel,
  type StandardCode,
} from "@/features/administration/domain/cohort-products";

export type ProgrammeApprenticeshipOption = {
  /** Skills England apprenticeship product code (technical). */
  standardCode: StandardCode;
  /** Linked occupation code for Maps import (technical). */
  occupationCode: string;
  /** Friendly title for Jon. */
  title: string;
  /** Newest Skills England version GTA targets for new programmes. */
  currentVersion: string;
  /** Whether a GTA delivery spine template exists offline. */
  hasDeliveryTemplate: boolean;
  /** Short status for the catalogue card. */
  builderStatus: "ready" | "import_only";
};

/** OCC codes align with Skills England occupation references (ST0xxx → OCC0xxx for these). */
const OCCUPATION_BY_STANDARD: Record<StandardCode, string> = {
  ST0499: "OCC0499",
  ST0033: "OCC0033",
  ST0068: "OCC0068",
  ST0448: "OCC0448",
  ST0403: "OCC0403",
};

export const PROGRAMME_APPRENTICESHIPS: ProgrammeApprenticeshipOption[] =
  COURSE_STANDARD_CODES.map((standardCode) => {
    const title = standardLabel(standardCode);
    const hasDeliveryTemplate = standardCode === "ST0499";
    return {
      standardCode,
      occupationCode: OCCUPATION_BY_STANDARD[standardCode],
      title,
      currentVersion: CURRENT_STANDARD_VERSION[standardCode],
      hasDeliveryTemplate,
      builderStatus: hasDeliveryTemplate ? "ready" : "import_only",
    };
  });

export function apprenticeshipByStandardCode(
  code: string,
): ProgrammeApprenticeshipOption | undefined {
  const normalized = code.trim().toUpperCase();
  return PROGRAMME_APPRENTICESHIPS.find((a) => a.standardCode === normalized);
}

export function displayApprenticeshipTitle(
  standardCode: string,
  fallbackTitle?: string,
): string {
  return (
    apprenticeshipByStandardCode(standardCode)?.title ||
    fallbackTitle?.trim() ||
    standardCode
  );
}
