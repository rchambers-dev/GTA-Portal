/**
 * Employer + programme catalogue handlers for /api/admin/store.
 */

import { NextResponse } from "next/server";
import type { createSupabaseAdminClient } from "@/adapters/supabase/client";
import type {
  AdminEmployerRecord,
  AdminProgrammeRecord,
} from "@/features/administration/domain/types";
import type {
  EmployerInput,
  ProgrammeInput,
} from "@/features/administration/domain/store";
import { isMissingSchemaError } from "./cohort-handlers";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

export type EmployerRow = {
  id: string;
  name: string;
  legal_name: string;
  company_number: string;
  main_contact: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  address_line1: string;
  address_line2: string;
  town: string;
  postcode: string;
  website: string;
  status: AdminEmployerRecord["status"];
  notes: string;
  created_at: string;
  updated_at: string;
};

export type ProgrammeRow = {
  id: string;
  name: string;
  standard_code: string;
  duration_months: number;
  level: number | null;
  route: string | null;
  awarding_body: string | null;
  status: string | null;
  summary: string | null;
  skills_england_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function mapEmployer(row: EmployerRow): AdminEmployerRecord {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legal_name ?? "",
    companyNumber: row.company_number ?? "",
    mainContact: row.main_contact ?? "",
    contactRole: row.contact_role ?? "",
    contactEmail: row.contact_email ?? "",
    contactPhone: row.contact_phone ?? "",
    addressLine1: row.address_line1 ?? "",
    addressLine2: row.address_line2 ?? "",
    town: row.town ?? "",
    postcode: row.postcode ?? "",
    website: row.website ?? "",
    status: row.status === "inactive" ? "inactive" : "active",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProgramme(row: ProgrammeRow): AdminProgrammeRecord {
  const level = row.level;
  const safeLevel =
    level === 2 ||
    level === 3 ||
    level === 4 ||
    level === 5 ||
    level === 6 ||
    level === 7
      ? level
      : 2;
  const status = row.status;
  return {
    id: row.id,
    name: row.name,
    standardCode: row.standard_code ?? "",
    level: safeLevel,
    route: row.route ?? "",
    durationMonths: row.duration_months || 12,
    awardingBody: row.awarding_body ?? "",
    status:
      status === "inactive" || status === "retired" ? status : "active",
    summary: row.summary ?? "",
    skillsEnglandUrl: row.skills_england_url ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadEmployers(supabase: SupabaseAdmin): Promise<{
  employers: AdminEmployerRecord[];
  error: string | null;
}> {
  const result = await supabase
    .from("employers")
    .select("*")
    .order("name", { ascending: true });
  if (result.error) {
    if (isMissingSchemaError(result.error.message)) {
      return { employers: [], error: null };
    }
    return { employers: [], error: result.error.message };
  }
  return {
    employers: (result.data ?? []).map((row) => mapEmployer(row as EmployerRow)),
    error: null,
  };
}

export async function loadProgrammes(supabase: SupabaseAdmin): Promise<{
  programmes: AdminProgrammeRecord[];
  error: string | null;
}> {
  const result = await supabase
    .from("programmes")
    .select("*")
    .order("name", { ascending: true });
  if (result.error) {
    if (isMissingSchemaError(result.error.message)) {
      return { programmes: [], error: null };
    }
    return { programmes: [], error: result.error.message };
  }
  return {
    programmes: (result.data ?? []).map((row) =>
      mapProgramme(row as ProgrammeRow),
    ),
    error: null,
  };
}

export async function handleCatalogueAction(
  supabase: SupabaseAdmin,
  body:
    | { action: "createEmployer"; input: EmployerInput }
    | { action: "updateEmployer"; id: string; patch: Partial<EmployerInput> }
    | { action: "createProgramme"; input: ProgrammeInput }
    | { action: "updateProgramme"; id: string; patch: Partial<ProgrammeInput> },
): Promise<NextResponse> {
  if (body.action === "createEmployer") {
    const input = body.input;
    const { data, error } = await supabase
      .from("employers")
      .insert({
        name: input.name.trim(),
        legal_name: input.legalName.trim(),
        company_number: input.companyNumber.trim(),
        main_contact: input.mainContact.trim(),
        contact_role: input.contactRole.trim(),
        contact_email: input.contactEmail.trim(),
        contact_phone: input.contactPhone.trim(),
        address_line1: input.addressLine1.trim(),
        address_line2: input.addressLine2.trim(),
        town: input.town.trim(),
        postcode: input.postcode.trim().toUpperCase(),
        website: input.website.trim(),
        status: input.status,
        notes: input.notes.trim(),
      })
      .select("*")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to create employer" },
        { status: 500 },
      );
    }
    return NextResponse.json({ employer: mapEmployer(data as EmployerRow) });
  }

  if (body.action === "updateEmployer") {
    const patch = body.patch;
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.name !== undefined) update.name = patch.name.trim();
    if (patch.legalName !== undefined) update.legal_name = patch.legalName.trim();
    if (patch.companyNumber !== undefined) {
      update.company_number = patch.companyNumber.trim();
    }
    if (patch.mainContact !== undefined) {
      update.main_contact = patch.mainContact.trim();
    }
    if (patch.contactRole !== undefined) {
      update.contact_role = patch.contactRole.trim();
    }
    if (patch.contactEmail !== undefined) {
      update.contact_email = patch.contactEmail.trim();
    }
    if (patch.contactPhone !== undefined) {
      update.contact_phone = patch.contactPhone.trim();
    }
    if (patch.addressLine1 !== undefined) {
      update.address_line1 = patch.addressLine1.trim();
    }
    if (patch.addressLine2 !== undefined) {
      update.address_line2 = patch.addressLine2.trim();
    }
    if (patch.town !== undefined) update.town = patch.town.trim();
    if (patch.postcode !== undefined) {
      update.postcode = patch.postcode.trim().toUpperCase();
    }
    if (patch.website !== undefined) update.website = patch.website.trim();
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.notes !== undefined) update.notes = patch.notes.trim();

    const { data, error } = await supabase
      .from("employers")
      .update(update)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to update employer" },
        { status: 500 },
      );
    }
    return NextResponse.json({ employer: mapEmployer(data as EmployerRow) });
  }

  if (body.action === "createProgramme") {
    const input = body.input;
    const { data, error } = await supabase
      .from("programmes")
      .insert({
        name: input.name.trim(),
        standard_code: input.standardCode.trim().toUpperCase(),
        duration_months: Math.max(1, Math.round(input.durationMonths) || 12),
        level: input.level,
        route: input.route.trim(),
        awarding_body: input.awardingBody.trim(),
        status: input.status,
        summary: input.summary.trim(),
        skills_england_url: input.skillsEnglandUrl.trim(),
        notes: input.notes.trim(),
      })
      .select("*")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to create programme" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      programme: mapProgramme(data as ProgrammeRow),
    });
  }

  if (body.action === "updateProgramme") {
    const patch = body.patch;
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.name !== undefined) update.name = patch.name.trim();
    if (patch.standardCode !== undefined) {
      update.standard_code = patch.standardCode.trim().toUpperCase();
    }
    if (patch.durationMonths !== undefined) {
      update.duration_months = Math.max(1, Math.round(patch.durationMonths) || 12);
    }
    if (patch.level !== undefined) update.level = patch.level;
    if (patch.route !== undefined) update.route = patch.route.trim();
    if (patch.awardingBody !== undefined) {
      update.awarding_body = patch.awardingBody.trim();
    }
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.summary !== undefined) update.summary = patch.summary.trim();
    if (patch.skillsEnglandUrl !== undefined) {
      update.skills_england_url = patch.skillsEnglandUrl.trim();
    }
    if (patch.notes !== undefined) update.notes = patch.notes.trim();

    const { data, error } = await supabase
      .from("programmes")
      .update(update)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to update programme" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      programme: mapProgramme(data as ProgrammeRow),
    });
  }

  return NextResponse.json({ error: "Unknown catalogue action" }, { status: 400 });
}
