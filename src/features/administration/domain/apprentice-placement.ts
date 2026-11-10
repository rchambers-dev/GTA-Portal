/**
 * A learner's placement history, and the checks for ending one placement
 * and starting the next. The database requires the site and the manager
 * to belong to the employer on the row.
 */

import { isAssignedGtaId } from "./apprentice-record";
import { isIsoDate } from "./apprentice-programme";
import { normaliseGtaId } from "./apprentice-tutor";
import {
  formatSite,
  isAssignedEmployerId,
  isRecordId,
  type EmployerManager,
  type EmployerSite,
} from "./employer-record";

export const PLACEMENT_PERMISSION_ERROR =
  "You do not have permission to change placements. Administrator and Management can.";

export type PlacementActionResult = { ok: true } | { ok: false; formError: string };

export type PlacementDetail = {
  id: string;
  employerId: string;
  companyName: string;
  employerFound: boolean;
  siteId: string;
  siteFound: boolean;
  postcode: string | null;
  areaName: string | null;
  managerId: string;
  managerName: string;
  managerFound: boolean;
  managerSiteId: string | null;
  managerSiteFound: boolean;
  managerSitePostcode: string | null;
  managerSiteAreaName: string | null;
  email: string | null;
  phone: string | null;
  startDate: string;
  endDate: string | null;
  endReason: string | null;
};

export type PlacementEmployerOption = {
  employerId: string;
  companyName: string;
  sites: EmployerSite[];
  managers: EmployerManager[];
};

export type ApprenticePlacementPage = {
  current: PlacementDetail[];
  history: PlacementDetail[];
  employers: PlacementEmployerOption[];
  loadError: string | null;
};

export type ValidatedPlacementEnd = {
  employmentId: string;
  endDate: string;
  endReason: string;
};

export type ValidatedPlacementStart = {
  gtaId: string;
  employerId: string;
  siteId: string;
  managerId: string;
  startDate: string;
};

export type ValidatedPlacementChange = ValidatedPlacementEnd & {
  gtaId: string;
  employerId: string;
  siteId: string;
  managerId: string;
  startDate: string;
};

export function placementEmployerLabel(row: PlacementDetail): string {
  if (!row.employerFound) return "Employer unavailable";
  return row.companyName.trim() || "Employer unavailable";
}

export function placementDetailPostcode(row: PlacementDetail): string {
  if (!row.siteFound) return "No postcode";
  return row.postcode?.trim() || "No postcode";
}

export function placementDetailLocation(row: PlacementDetail): string {
  if (!row.siteFound) return "No location";
  return row.areaName?.trim() || "No location";
}

export function placementDetailManager(row: PlacementDetail): string {
  if (!row.managerFound) return "Manager unavailable";
  return row.managerName.trim() || "Manager unavailable";
}

export function placementDetailManagerSite(row: PlacementDetail): string {
  if (!row.managerFound || !row.managerSiteId) return "No site";
  if (!row.managerSiteFound) return "Site unavailable";
  return (
    formatSite({ postcode: row.managerSitePostcode, areaName: row.managerSiteAreaName }) ||
    "Site unavailable"
  );
}

export function placementDetailEmail(row: PlacementDetail): string {
  return row.email?.trim() || "No email";
}

export function placementDetailPhone(row: PlacementDetail): string {
  return row.phone?.trim() || "No phone";
}

export function placementEndReasonLabel(row: Pick<PlacementDetail, "endReason">): string {
  return row.endReason?.trim() || "No end reason";
}

export function explainPlacementError(error: {
  code?: string;
  message?: string;
  details?: string;
}): string {
  const message = error.message?.trim() || error.details?.trim() || "The placement could not be saved.";
  if (
    error.code === "42501" ||
    /row-level security|permission denied|Administrator or Management role required/i.test(message)
  ) {
    return PLACEMENT_PERMISSION_ERROR;
  }
  if (/Site does not belong to employer/i.test(message)) {
    return "Choose a site that belongs to this employer.";
  }
  if (/Manager does not belong to employer/i.test(message)) {
    return "Choose a manager that belongs to this employer.";
  }
  if (message.includes("apprentice_employments_one_current_idx") || error.code === "23505") {
    return "This apprentice already has a current placement. Refresh the page and try again.";
  }
  if (message.includes("apprentice_employments_dates_check")) {
    return "The end date cannot be before the placement start date.";
  }
  return message;
}

function requireDate(value: string, missing: string): { ok: true; value: string } | { ok: false; formError: string } {
  const date = value.trim();
  if (!isIsoDate(date)) return { ok: false, formError: missing };
  return { ok: true, value: date };
}

function requireReason(value: string): { ok: true; value: string } | { ok: false; formError: string } {
  const reason = value.trim();
  if (!reason) return { ok: false, formError: "Enter an end reason." };
  return { ok: true, value: reason };
}

function requireEmployerParts(input: {
  employerId: string;
  siteId: string;
  managerId: string;
}): { ok: true; employerId: string; siteId: string; managerId: string } | { ok: false; formError: string } {
  const employerId = input.employerId.trim();
  const siteId = input.siteId.trim();
  const managerId = input.managerId.trim();
  if (!isAssignedEmployerId(employerId)) {
    return { ok: false, formError: "Choose an employer." };
  }
  if (!isRecordId(siteId)) return { ok: false, formError: "Choose a site." };
  if (!isRecordId(managerId)) return { ok: false, formError: "Choose a manager." };
  return { ok: true, employerId, siteId, managerId };
}

export function validatePlacementEnd(input: {
  employmentId: string;
  currentStart: string;
  endDate: string;
  endReason: string;
}): { ok: true; value: ValidatedPlacementEnd } | { ok: false; formError: string } {
  const employmentId = input.employmentId.trim();
  if (!isRecordId(employmentId)) {
    return { ok: false, formError: "This placement could not be found. Refresh the page." };
  }
  const currentStart = input.currentStart.trim();
  if (!isIsoDate(currentStart)) {
    return { ok: false, formError: "The current placement start date could not be read. Refresh the page." };
  }
  const endDate = requireDate(input.endDate, "Enter an end date.");
  if (!endDate.ok) return endDate;
  if (endDate.value < currentStart) {
    return { ok: false, formError: "The end date cannot be before the placement start date." };
  }
  const endReason = requireReason(input.endReason);
  if (!endReason.ok) return endReason;
  return { ok: true, value: { employmentId, endDate: endDate.value, endReason: endReason.value } };
}

export function validatePlacementStart(input: {
  gtaId: string;
  employerId: string;
  siteId: string;
  managerId: string;
  startDate: string;
}): { ok: true; value: ValidatedPlacementStart } | { ok: false; formError: string } {
  const gtaId = normaliseGtaId(input.gtaId);
  if (!isAssignedGtaId(gtaId)) {
    return { ok: false, formError: "This apprentice does not have a valid GTA ID." };
  }
  const parts = requireEmployerParts(input);
  if (!parts.ok) return parts;
  const startDate = requireDate(input.startDate, "Enter a start date.");
  if (!startDate.ok) return startDate;
  return {
    ok: true,
    value: {
      gtaId,
      employerId: parts.employerId,
      siteId: parts.siteId,
      managerId: parts.managerId,
      startDate: startDate.value,
    },
  };
}

export function validatePlacementChange(input: {
  employmentId: string;
  currentStart: string;
  endDate: string;
  endReason: string;
  gtaId: string;
  employerId: string;
  siteId: string;
  managerId: string;
  startDate: string;
}): { ok: true; value: ValidatedPlacementChange } | { ok: false; formError: string } {
  const ended = validatePlacementEnd(input);
  if (!ended.ok) return ended;
  const started = validatePlacementStart(input);
  if (!started.ok) return started;
  if (started.value.startDate < ended.value.endDate) {
    return { ok: false, formError: "The new placement cannot start before the current one ends." };
  }
  return { ok: true, value: { ...ended.value, ...started.value } };
}
