/**
 * Resolve the exact GTA programme version for an enrolment.
 *
 * Prefer enrolment.gtaProgrammeVersionId.
 * Never silently bind unpinned enrolments to "newest" programme.
 */

import type { AdminApprenticeEnrolment } from "@/features/administration/domain/types";
import type {
  GtaProgrammeVersion,
  OfficialStandardVersion,
  ProgrammeDefinitionState,
} from "@/features/programme-definition/domain/types";

export type EnrolmentProgrammeResolution =
  | {
      status: "pinned";
      programme: GtaProgrammeVersion;
      official: OfficialStandardVersion;
    }
  | {
      status: "pin_missing_programme";
      pinId: string;
      reason: string;
      candidates: GtaProgrammeVersion[];
    }
  | {
      status: "pin_missing_official";
      programme: GtaProgrammeVersion;
      reason: string;
    }
  | {
      status: "unpinned";
      reason: string;
      candidates: GtaProgrammeVersion[];
    };

function candidatesForStandard(
  state: ProgrammeDefinitionState,
  standardCode: string,
): GtaProgrammeVersion[] {
  const code = standardCode.trim().toUpperCase();
  return state.programmes
    .filter((p) => p.standardCode.toUpperCase() === code)
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function resolveProgrammeForEnrolment(args: {
  enrolment: Pick<
    AdminApprenticeEnrolment,
    "standardCode" | "gtaProgrammeVersionId"
  >;
  programmeState: ProgrammeDefinitionState;
}): EnrolmentProgrammeResolution {
  const { enrolment, programmeState } = args;
  const candidates = candidatesForStandard(
    programmeState,
    enrolment.standardCode,
  );
  const pinId = enrolment.gtaProgrammeVersionId?.trim() || null;

  if (pinId) {
    const programme = programmeState.programmes.find((p) => p.id === pinId);
    if (!programme) {
      return {
        status: "pin_missing_programme",
        pinId,
        reason:
          "This enrolment is pinned to a GTA programme version that is not loaded. Re-bind explicitly — it will not auto-switch.",
        candidates,
      };
    }
    const official =
      programmeState.officialVersions.find(
        (v) => v.id === programme.standardVersionId,
      ) ??
      programmeState.officialVersions.find(
        (v) =>
          v.standardCode.toUpperCase() ===
            programme.standardCode.toUpperCase() &&
          v.externalVersion === programme.externalVersion,
      );
    if (!official) {
      return {
        status: "pin_missing_official",
        programme,
        reason:
          "Pinned programme version has no matching official Skills England pack loaded.",
      };
    }
    return { status: "pinned", programme, official };
  }

  return {
    status: "unpinned",
    reason:
      "This enrolment is not pinned to a GTA programme version. Bind one explicitly before RPL/TNP calculations — newer published versions must not be used automatically.",
    candidates,
  };
}
