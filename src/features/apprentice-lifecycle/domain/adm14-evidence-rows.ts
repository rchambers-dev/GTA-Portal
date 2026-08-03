import type {
  EvidenceRequirementRowDto,
  EvidenceRequirementStatus,
} from "../types";
import { ADM14_REQUIREMENTS } from "./adm14-checklist";

/**
 * Build the full ADM14 checklist for an apprentice workspace.
 *
 * Everything starts as Missing until staff enter data on Apprentices
 * (demo apprentices and newly added apprentices alike). Section 6 stays
 * Future until end-of-programme / gateway.
 */
export function buildAdm14EvidenceRows(options?: {
  includeEndOfProgrammeAsFuture?: boolean;
}): EvidenceRequirementRowDto[] {
  const includeEndAsFuture = options?.includeEndOfProgrammeAsFuture ?? true;

  return ADM14_REQUIREMENTS.map((def) => {
    const status: EvidenceRequirementStatus =
      def.endOfProgramme && includeEndAsFuture
        ? "future_requirement"
        : "missing";

    return {
      id: `req-${def.reference}`,
      sectionKey: def.sectionKey,
      sectionTitle: def.sectionTitle,
      originalBookletSection: def.originalBookletSection,
      reference: def.reference,
      requirementKind: def.requirementKind,
      title: def.title,
      applicability: def.applicability,
      status,
      dateReceived: null,
      checkedBy: null,
      dateChecked: null,
      notes: null,
      evidenceCount: 0,
      isRecurring: def.isRecurring,
    };
  });
}
