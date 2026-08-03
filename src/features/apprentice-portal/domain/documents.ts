/**
 * Apprentice / employer Documents portals — ADM14.0 section pages.
 * Real form UIs are wired in as each GTA document is supplied.
 */

import {
  ADM14_FORM_CODE,
  ADM14_FORM_TITLE,
  ADM14_REQUIREMENTS,
  ADM14_SECTIONS,
  adm14RequirementByReference,
  adm14SectionByKey,
  adm14VisibleToPortal,
  type Adm14PortalRole,
  type Adm14RequirementDefinition,
  type Adm14SectionDefinition,
} from "@/features/apprentice-lifecycle/domain/adm14-checklist";
import { getAf11DocumentsStatus } from "./enrolment-form-af11";
import { getAf12DocumentsStatus } from "./interview-form-af12";
import { getAlsLlddDocumentsStatus } from "./als-lldd-form";
import { getPlrDocumentsStatus } from "./plr-store";
import { getRpleDocumentsStatus } from "./rple-form";

export type DocumentsAudience = Adm14PortalRole;

export type DocumentsPortalStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_signoff"
  | "complete"
  | "not_applicable"
  | "future"
  | "awaiting_document";

export type DocumentsSectionSummary = Adm14SectionDefinition & {
  itemCount: number;
  completeCount: number;
  actionNeededCount: number;
  href: string;
};

export type DocumentsItemRow = Adm14RequirementDefinition & {
  status: DocumentsPortalStatus;
  statusLabel: string;
  href: string;
  formReady: boolean;
};

/** References that already have a fillable / viewable UI in the portal. */
export const DOCUMENTS_WIRED_FORMS = new Set<string>([
  "1.2",
  "1.3",
  "1.5",
  "1.6",
  "1.7",
  "4.1",
]);

/**
 * Demo status overlay for Alex Morgan — placeholder until PICS / pack store
 * drives live status. Live forms: 1.2, 1.3, 1.5, 1.6, 1.7.
 */
const ALEX_DEMO_STATUS: Record<string, DocumentsPortalStatus> = {
  "1.1": "complete",
  "1.4": "complete",
  "2.1": "complete",
  "2.2": "complete",
  "2.3": "not_applicable",
  "2.4": "awaiting_signoff",
  "3.1": "awaiting_document",
  "4.1": "in_progress",
  "4.2": "awaiting_document",
  "5.1": "complete",
  "6.1": "future",
  "6.2": "future",
  "6.3": "future",
  "6.4": "future",
  "6.5": "future",
  "7.1": "in_progress",
  "7.2": "in_progress",
  "7.3": "in_progress",
  "7.4": "in_progress",
  "7.5": "not_applicable",
  "7.6": "not_applicable",
  "7.7": "not_applicable",
  "7.8": "not_applicable",
  "8.1": "not_started",
};

export function documentsBasePath(audience: DocumentsAudience): string {
  return audience === "employer" ? "/employer/documents" : "/apprentice/documents";
}

export function documentsSectionHref(
  audience: DocumentsAudience,
  sectionKey: string,
): string {
  return `${documentsBasePath(audience)}/${sectionKey}`;
}

export function documentsItemHref(
  audience: DocumentsAudience,
  sectionKey: string,
  reference: string,
): string {
  return `${documentsSectionHref(audience, sectionKey)}/${encodeURIComponent(reference)}`;
}

export function documentsStatusLabel(status: DocumentsPortalStatus): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "in_progress":
      return "In progress";
    case "awaiting_signoff":
      return "Awaiting sign-off";
    case "not_applicable":
      return "Not applicable";
    case "future":
      return "Not yet required";
    case "awaiting_document":
      return "Form coming soon";
    default:
      return "Not started";
  }
}

export function documentsStatusTone(
  status: DocumentsPortalStatus,
): "neutral" | "green" | "amber" | "red" | "blue" | "navy" {
  switch (status) {
    case "complete":
      return "green";
    case "in_progress":
    case "awaiting_signoff":
      return "amber";
    case "awaiting_document":
    case "not_started":
      return "blue";
    case "future":
    case "not_applicable":
      return "neutral";
    default:
      return "navy";
  }
}

export function documentsRowTone(
  status: DocumentsPortalStatus,
): "amber" | "green" | "navy" | "blue" | undefined {
  switch (status) {
    case "complete":
      return "green";
    case "in_progress":
    case "awaiting_signoff":
      return "amber";
    case "awaiting_document":
    case "not_started":
      return "blue";
    case "future":
      return "navy";
    default:
      return undefined;
  }
}

function resolveStatus(
  item: Adm14RequirementDefinition,
): DocumentsPortalStatus {
  if (item.reference === "1.2") {
    const af11 = getAf11DocumentsStatus();
    if (af11 === "complete") return "complete";
    if (af11 === "in_progress") return "in_progress";
    return "not_started";
  }
  if (item.reference === "1.3") {
    const af12 = getAf12DocumentsStatus();
    if (af12 === "complete") return "complete";
    if (af12 === "in_progress") return "in_progress";
    return "not_started";
  }
  if (item.reference === "1.5") {
    const rple = getRpleDocumentsStatus();
    if (rple === "complete") return "complete";
    if (rple === "in_progress") return "in_progress";
    if (rple === "awaiting_document") return "awaiting_document";
    return "not_started";
  }
  if (item.reference === "1.6") {
    const plr = getPlrDocumentsStatus();
    if (plr === "complete") return "complete";
    if (plr === "in_progress") return "in_progress";
    return "not_started";
  }
  if (item.reference === "1.7") {
    const als = getAlsLlddDocumentsStatus();
    if (als === "complete") return "complete";
    if (als === "in_progress") return "in_progress";
    if (als === "not_applicable") return "not_applicable";
    return "not_started";
  }
  if (ALEX_DEMO_STATUS[item.reference]) {
    return ALEX_DEMO_STATUS[item.reference];
  }
  if (item.endOfProgramme) return "future";
  if (!DOCUMENTS_WIRED_FORMS.has(item.reference)) return "awaiting_document";
  return "not_started";
}

export function documentsItemsForAudience(
  audience: DocumentsAudience,
  sectionKey?: string,
): DocumentsItemRow[] {
  return ADM14_REQUIREMENTS.filter((item) => {
    if (!adm14VisibleToPortal(item, audience)) return false;
    if (sectionKey && item.sectionKey !== sectionKey) return false;
    return true;
  }).map((item) => {
    const status = resolveStatus(item);
    return {
      ...item,
      status,
      statusLabel: documentsStatusLabel(status),
      href: documentsItemHref(audience, item.sectionKey, item.reference),
      formReady: DOCUMENTS_WIRED_FORMS.has(item.reference),
    };
  });
}

export function documentsSectionsForAudience(
  audience: DocumentsAudience,
): DocumentsSectionSummary[] {
  return ADM14_SECTIONS.map((section) => {
    const items = documentsItemsForAudience(audience, section.key);
    const completeCount = items.filter((i) => i.status === "complete").length;
    const actionNeededCount = items.filter(
      (i) =>
        i.status === "not_started" ||
        i.status === "in_progress" ||
        i.status === "awaiting_signoff" ||
        i.status === "awaiting_document",
    ).length;
    return {
      ...section,
      itemCount: items.length,
      completeCount,
      actionNeededCount,
      href: documentsSectionHref(audience, section.key),
    };
  }).filter((section) => section.itemCount > 0);
}

export function resolveDocumentsSection(
  sectionKey: string,
): Adm14SectionDefinition | undefined {
  return adm14SectionByKey(sectionKey);
}

export function resolveDocumentsItem(
  audience: DocumentsAudience,
  sectionKey: string,
  reference: string,
): DocumentsItemRow | null {
  const decoded = decodeURIComponent(reference);
  const item = adm14RequirementByReference(decoded);
  if (!item) return null;
  if (item.sectionKey !== sectionKey) return null;
  if (!adm14VisibleToPortal(item, audience)) return null;
  const status = resolveStatus(item);
  return {
    ...item,
    status,
    statusLabel: documentsStatusLabel(status),
    href: documentsItemHref(audience, item.sectionKey, item.reference),
    formReady: DOCUMENTS_WIRED_FORMS.has(item.reference),
  };
}

export { ADM14_FORM_CODE, ADM14_FORM_TITLE, ADM14_SECTIONS };
