/**
 * GTA Programme Version options for admin pinning and Teaching Groups.
 *
 * Compatibility with a Cohort is proven via:
 *   gta_programme_versions.standard_version_id → se_standard_versions.external_version
 *   and the GTA programme's Skills England standard_code.
 *
 * Never auto-select "newest".
 */

import type { AdminGtaProgrammeVersionOption } from "./types";

export type { AdminGtaProgrammeVersionOption };

export function normalizeSkillsEnglandVersion(value: string): string {
  return value.trim().replace(/^v/i, "");
}

export function isSelectableGtaVersionForNewPin(status: string): boolean {
  return status === "published";
}

export function gtaVersionMatchesStandard(
  version: Pick<AdminGtaProgrammeVersionOption, "standardCode">,
  standardCode: string,
): boolean {
  return (
    version.standardCode.trim().toUpperCase() ===
    standardCode.trim().toUpperCase()
  );
}

export function gtaVersionMatchesSkillsEngland(
  version: Pick<AdminGtaProgrammeVersionOption, "skillsEnglandVersion">,
  skillsEnglandVersion: string,
): boolean {
  return (
    normalizeSkillsEnglandVersion(version.skillsEnglandVersion) ===
    normalizeSkillsEnglandVersion(skillsEnglandVersion)
  );
}

export function isGtaVersionCompatibleWithIntake(
  version: Pick<
    AdminGtaProgrammeVersionOption,
    "standardCode" | "skillsEnglandVersion"
  >,
  intake: { standardCode: string; standardVersion: string },
): boolean {
  return (
    gtaVersionMatchesStandard(version, intake.standardCode) &&
    gtaVersionMatchesSkillsEngland(version, intake.standardVersion)
  );
}

export function selectableGtaVersionsForIntake(args: {
  versions: AdminGtaProgrammeVersionOption[];
  standardCode: string;
  skillsEnglandVersion: string;
  /** Already-pinned id remains listed even if no longer published. */
  includeId?: string | null;
}): AdminGtaProgrammeVersionOption[] {
  const includeId = args.includeId?.trim() || "";
  return args.versions.filter((version) => {
    const compatible =
      gtaVersionMatchesStandard(version, args.standardCode) &&
      gtaVersionMatchesSkillsEngland(version, args.skillsEnglandVersion);
    if (!compatible) return false;
    if (includeId && version.id === includeId) return true;
    return isSelectableGtaVersionForNewPin(version.status);
  });
}

export function formatGtaProgrammeVersionLabel(
  version: Pick<
    AdminGtaProgrammeVersionOption,
    | "programmeTitle"
    | "internalVersion"
    | "skillsEnglandVersion"
    | "status"
    | "deliverySpine"
  >,
): string {
  const se = normalizeSkillsEnglandVersion(version.skillsEnglandVersion);
  const spine = version.deliverySpine.trim();
  const spineBit = spine ? ` · ${spine}` : "";
  return `${version.programmeTitle} · GTA v${version.internalVersion} · SE v${se}${spineBit} · ${version.status}`;
}

export function cohortPinIncompatibleMessage(
  cohortName: string,
  skillsEnglandVersion: string,
): string {
  return `This intake (${cohortName}) is locked to Skills England v${normalizeSkillsEnglandVersion(skillsEnglandVersion)}. The apprentice’s pinned GTA Programme Version does not match. Change the pin explicitly, or pick a compatible intake — it will not be fixed automatically.`;
}

export const MISSING_PIN_CATALOGUE_MESSAGE =
  "This enrolment is pinned to a GTA Programme Version that is not in the catalogue. Re-bind it explicitly — it will not be switched automatically.";

export const PIN_GROUP_MISMATCH_MESSAGE =
  "This apprentice is in a teaching group that delivers a different GTA Programme Version. Move them out of that group before changing the pin — the group does not change their programme version.";

/**
 * Cohort change / pin change compatibility.
 * Unpinned learners may still be assigned a cohort.
 */
export function pinCompatibilityError(args: {
  pinId: string | null | undefined;
  pin: AdminGtaProgrammeVersionOption | null | undefined;
  cohort: {
    name: string;
    standardCode: string;
    standardVersion: string;
  } | null;
}): string | null {
  const pinId = args.pinId?.trim() || "";
  if (!pinId) return null;
  if (!args.pin) return MISSING_PIN_CATALOGUE_MESSAGE;
  if (!args.cohort) return null;
  if (!isGtaVersionCompatibleWithIntake(args.pin, args.cohort)) {
    return cohortPinIncompatibleMessage(
      args.cohort.name,
      args.cohort.standardVersion,
    );
  }
  return null;
}
