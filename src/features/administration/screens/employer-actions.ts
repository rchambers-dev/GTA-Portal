"use server";

import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import {
  deleteEmployerManagerRecord,
  deleteEmployerSiteRecord,
  insertEmployerManagerRecord,
  insertEmployerRecord,
  insertEmployerSiteRecord,
  renameEmployerRecord,
  updateEmployerManagerRecord,
} from "../domain/employer-repository";
import {
  EMPLOYER_WRITE_PERMISSION,
  canManageEmployers,
  validateAreaName,
  validateCompanyName,
  validateManagerInput,
  type EmployerFieldErrors,
  type EmployerListItem,
  type EmployerManager,
  type EmployerMutationResult,
  type EmployerSite,
  type ManagerInput,
} from "../domain/employer-record";

const SIGN_IN_ERROR = "Sign in again to change employers.";

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

export async function addEmployerAction(input: {
  companyName: string;
}): Promise<EmployerMutationResult<EmployerListItem>> {
  const auth = await authorizeEmployerWrite();
  if (!auth.ok) return auth;
  const parsed = validateCompanyName(input.companyName);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, formError: null };
  return insertEmployerRecord(auth.supabase, parsed.companyName);
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
  areaName: string;
}): Promise<EmployerMutationResult<EmployerSite>> {
  const auth = await authorizeEmployerWrite();
  if (!auth.ok) return auth;
  const parsed = validateAreaName(input.areaName);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, formError: null };
  return insertEmployerSiteRecord(auth.supabase, input.employerId, parsed.areaName);
}

export async function removeEmployerSiteAction(input: {
  siteId: string;
}): Promise<EmployerMutationResult<{ siteId: string }>> {
  const auth = await authorizeEmployerWrite();
  if (!auth.ok) return auth;
  return deleteEmployerSiteRecord(auth.supabase, input.siteId);
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
