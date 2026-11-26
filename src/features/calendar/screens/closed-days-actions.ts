"use server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/adapters/supabase/client";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";

function denied() {
  return { ok: false as const, formError: "Closed days are for Management." };
}

async function managementClient() {
  const session = await getSupabaseEffectiveSession();
  if (!session) return { ok: false as const, formError: "Sign in again." };
  if (session.account.baseRole !== "Management") return denied();
  return { ok: true as const, supabase: await createSupabaseServerClient() };
}

export async function saveClosureAction(input: {
  id?: string | null;
  name: string;
  startsOn: string;
  endsOn: string;
  kind: string;
  notes: string;
}) {
  const access = await managementClient();
  if (!access.ok) return access;
  const preview = await access.supabase.rpc("preview_closure_impact", { p_starts: input.startsOn, p_ends: input.endsOn });
  const saved = await access.supabase.rpc("save_calendar_closure", {
    p_id: input.id || null,
    p_name: input.name,
    p_starts: input.startsOn,
    p_ends: input.endsOn,
    p_kind: input.kind,
    p_notes: input.notes,
  });
  if (saved.error) return { ok: false as const, formError: saved.error.message };
  return { ok: true as const, id: saved.data as string | null, impact: preview.data ?? [] };
}

export async function previewClosureAction(startsOn: string, endsOn: string) {
  const access = await managementClient();
  if (!access.ok) return access;
  const preview = await access.supabase.rpc("preview_closure_impact", { p_starts: startsOn, p_ends: endsOn });
  if (preview.error) return { ok: false as const, formError: preview.error.message };
  return { ok: true as const, impact: preview.data ?? [] };
}

export async function lockClosureAction(id: string, locked: boolean) {
  const access = await managementClient();
  if (!access.ok) return access;
  const result = await access.supabase.rpc("set_calendar_closure_lock", { p_id: id, p_locked: locked });
  if (result.error) return { ok: false as const, formError: result.error.message };
  return { ok: true as const };
}

export async function syncBankHolidaysAction() {
  const access = await managementClient();
  if (!access.ok) return access;
  try {
    const response = await fetch("https://www.gov.uk/bank-holidays.json");
    if (!response.ok) return { ok: false as const, formError: "GOV.UK bank holidays could not be read." };
    const body = (await response.json()) as { "england-and-wales"?: { events?: { title?: string; date?: string }[] } };
    const events = (body["england-and-wales"]?.events ?? [])
      .filter((event) => event.date)
      .map((event) => ({ title: event.title ?? "Bank holiday", date: event.date }));
    const admin = createSupabaseAdminClient();
    const result = await admin.rpc("sync_bank_holidays", { p_events: events });
    if (result.error) return { ok: false as const, formError: result.error.message };
    return { ok: true as const, synced: result.data ?? 0 };
  } catch {
    return { ok: false as const, formError: "Bank holidays could not be saved." };
  }
}

export async function removeClosureAction(id: string) {
  const access = await managementClient();
  if (!access.ok) return access;
  const result = await access.supabase.rpc("remove_calendar_closure", { p_id: id });
  if (result.error) return { ok: false as const, formError: result.error.message };
  return { ok: true as const };
}
