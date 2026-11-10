"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import {
  createEmployerWithSiteRecord,
  deleteEmployerManagerRecord,
  insertEmployerManagerRecord,
  insertEmployerSiteRecord,
  renameEmployerRecord,
  setEmployerSiteActiveRecord,
  updateEmployerManagerRecord,
  updateEmployerSiteRecord,
} from "../domain/employer-repository";
import {
  EMPLOYER_WRITE_PERMISSION,
  canManageEmployers,
  validateCompanyName,
  validateManagerInput,
  validateSiteInput,
  type EmployerFieldErrors,
  type EmployerListItem,
  type EmployerManager,
  type EmployerMutationResult,
  type EmployerSite,
  type ManagerInput,
  type SiteInput,
} from "../domain/employer-record";
import { areaFromPostcodePlace, isUkPostcode, normaliseUkPostcode } from "../domain/postcode-area";

const SIGN_IN_ERROR = "Sign in again to change employers.";

export type PostcodeLookupResult =
  | { ok: true; postcode: string; areaName: string }
  | { ok: false; message: string };

async function authorizeEmployerWrite(): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
    }
  | { ok: false; fieldErrors: EmployerFieldErrors; formError: string | null }
> {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false, fieldErrors: {}, formError: SIGN_IN_ERROR };
  if (!canManageEmployers(session)) {
    return { ok: false, fieldErrors: {}, formError: EMPLOYER_WRITE_PERMISSION };
  }
  return { ok: true, supabase: await createSupabaseServerClient() };
}

/**
 * Looks up a town-style area from postcodes.io.
 * A failed lookup does not block saving: the caller can still type the area.
 */
export async function lookupEmployerPostcodeAction(
  postcode: string,
): Promise<PostcodeLookupResult> {
  const normalised = normaliseUkPostcode(postcode);
  if (!isUkPostcode(normalised)) {
    return { ok: false, message: "Enter a UK postcode, such as S1 1AA." };
  }

  try {
    const response = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(normalised)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (response.status === 404) {
      return {
        ok: false,
        message: "That postcode was not found. You can still enter the area.",
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        message: "The postcode lookup did not respond. You can still enter the area.",
      };
    }
    const body = (await response.json()) as {
      result?: {
        postcode?: string;
        parish?: string | null;
        admin_district?: string | null;
        admin_ward?: string | null;
      };
    };
    const areaName = areaFromPostcodePlace(body.result ?? {});
    if (!areaName) {
      return {
        ok: false,
        message: "No location was found for that postcode. Enter the location yourself.",
      };
    }
    return {
      ok: true,
      postcode: body.result?.postcode?.trim() || normalised,
      areaName,
    };
  } catch {
    return {
      ok: false,
      message: "The postcode lookup did not respond. You can still enter the area.",
    };
  }
}

export async function addEmployerAction(input: {
  companyName: string;
  site: SiteInput;
}): Promise<EmployerMutationResult<EmployerListItem>> {
  const auth = await authorizeEmployerWrite();
  if (!auth.ok) return auth;
  const company = validateCompanyName(input.companyName);
  if (!company.ok) return { ok: false, fieldErrors: company.fieldErrors, formError: null };
  const site = validateSiteInput(input.site, []);
  if (!site.ok) return { ok: false, fieldErrors: site.fieldErrors, formError: null };
  return createEmployerWithSiteRecord(auth.supabase, company.companyName, site.value);
}

export async function renameEmployerAction(input: {
  employerId: string;
  companyName: string;
}): Promise<EmployerMutationResult<{ employerId: string; companyName: string }>> {
  const auth = await authorizeEmployerWrite();
  if (!auth.ok) return auth;
  const parsed = validateCompanyName(input.companyName);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, formError: null };
  return renameEmployerRecord(auth.supabase, input.employerId, parsed.companyName);
}

export async function addEmployerSiteAction(input: {
  employerId: string;
  site: SiteInput;
  existingPostcodes: string[];
}): Promise<EmployerMutationResult<EmployerSite>> {
  const auth = await authorizeEmployerWrite();
  if (!auth.ok) return auth;
  const parsed = validateSiteInput(input.site, input.existingPostcodes);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, formError: null };
  return insertEmployerSiteRecord(auth.supabase, input.employerId, parsed.value);
}

export async function updateEmployerSiteAction(input: {
  employerId: string;
  siteId: string;
  site: SiteInput;
  existingPostcodes: string[];
}): Promise<EmployerMutationResult<EmployerSite>> {
  const auth = await authorizeEmployerWrite();
  if (!auth.ok) return auth;
  const parsed = validateSiteInput(input.site, input.existingPostcodes);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, formError: null };
  return updateEmployerSiteRecord(auth.supabase, input.employerId, input.siteId, parsed.value);
}

export async function setEmployerSiteActiveAction(input: {
  employerId: string;
  siteId: string;
  isActive: boolean;
}): Promise<EmployerMutationResult<EmployerSite>> {
  const auth = await authorizeEmployerWrite();
  if (!auth.ok) return auth;
  return setEmployerSiteActiveRecord(auth.supabase, input.employerId, input.siteId, input.isActive);
}

export async function saveEmployerManagerAction(input: {
  employerId: string;
  managerId: string | null;
  manager: ManagerInput;
  allowedSiteIds: string[];
}): Promise<EmployerMutationResult<EmployerManager>> {
  const auth = await authorizeEmployerWrite();
  if (!auth.ok) return auth;
  const parsed = validateManagerInput(input.manager, input.allowedSiteIds);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, formError: null };
  if (input.managerId) {
    return updateEmployerManagerRecord(
      auth.supabase,
      input.employerId,
      input.managerId,
      parsed.value,
    );
  }
  return insertEmployerManagerRecord(auth.supabase, input.employerId, parsed.value);
}

export async function removeEmployerManagerAction(input: {
  managerId: string;
}): Promise<EmployerMutationResult<{ managerId: string }>> {
  const auth = await authorizeEmployerWrite();
  if (!auth.ok) return auth;
  return deleteEmployerManagerRecord(auth.supabase, input.managerId);
}
