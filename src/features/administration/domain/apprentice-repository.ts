import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { excludeTestApprentices, isMissingTestColumn } from "./test-apprentice";
import {
  APPRENTICE_COLUMNS,
  explainApprenticeWriteError,
  isApprenticeStatus,
  isAssignedGtaId,
  mapApprenticeRow,
  toApprenticeInsert,
  type AddApprenticeResult,
  type ApprenticeListItem,
  type ApprenticeProgrammeOption,
  type ApprenticeRow,
  type ValidatedApprentice,
} from "./apprentice-record";

export type AddApprenticePageData = {
  programmes: ApprenticeProgrammeOption[];
  apprentices: ApprenticeListItem[];
  loadError: string | null;
};

type ProgrammeRow = {
  id: string;
  name: string;
  standard_code: string | null;
  status: string | null;
};

/**
 * Reads programmes and apprentices with the signed-in user's session.
 * RLS decides what comes back. The service role is not used.
 */
async function loadApprenticeRows(supabase: SupabaseClient) {
  const withFlag = await supabase.from("apprentices").select(`${APPRENTICE_COLUMNS}, is_test`).order("created_at", { ascending: false });
  if (withFlag.error && isMissingTestColumn(withFlag.error.message)) {
    return supabase.from("apprentices").select(APPRENTICE_COLUMNS).order("created_at", { ascending: false });
  }
  return withFlag;
}

export async function loadAddApprenticePage(): Promise<AddApprenticePageData> {
  const supabase = await createSupabaseServerClient();
  const [programmesResult, apprenticesResult] = await Promise.all([
    supabase
      .from("programmes")
      .select("id, name, standard_code, status")
      .order("name", { ascending: true }),
    loadApprenticeRows(supabase),
  ]);

  const problems: string[] = [];
  const programmes: ApprenticeProgrammeOption[] = [];
  let apprentices: ApprenticeListItem[] = [];

  const catalogue: ApprenticeProgrammeOption[] = [];
  if (programmesResult.error) {
    problems.push(`Programmes could not be loaded. ${programmesResult.error.message}`);
  } else {
    for (const row of (programmesResult.data ?? []) as ProgrammeRow[]) {
      if (!row.id || !row.name?.trim()) continue;
      const option = {
        id: row.id,
        name: row.name,
        standardCode: row.standard_code?.trim() ?? "",
      };
      catalogue.push(option);
      if (row.status === "active") programmes.push(option);
    }
  }

  if (apprenticesResult.error) {
    problems.push(`Apprentices could not be loaded. ${apprenticesResult.error.message}`);
  } else {
    apprentices = excludeTestApprentices((apprenticesResult.data ?? []) as (ApprenticeRow & { is_test?: boolean | null })[]).map((row) =>
      mapApprenticeRow(row, catalogue),
    );
  }

  return {
    programmes,
    apprentices,
    loadError: problems.length > 0 ? problems.join(" ") : null,
  };
}

/**
 * Inserts one apprentice and returns the GTA ID the database assigned.
 * The insert object has no gta_id, so next_apprentice_gta_id() supplies it.
 */
export async function insertApprenticeRecord(
  supabase: SupabaseClient,
  value: ValidatedApprentice,
): Promise<AddApprenticeResult> {
  const { data, error } = await supabase
    .from("apprentices")
    .insert(toApprenticeInsert(value))
    .select(APPRENTICE_COLUMNS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return {
        ok: false,
        fieldErrors: {},
        formError:
          "The apprentice may have been saved, but the new GTA ID could not be read back. Refresh the list before trying again.",
      };
    }
    const explained = explainApprenticeWriteError(error);
    return { ok: false, ...explained };
  }

  const row = data as ApprenticeRow | null;
  const gtaId = row?.gta_id?.trim() ?? "";
  if (!gtaId || !row) {
    return {
      ok: false,
      fieldErrors: {},
      formError: "The apprentice could not be saved. The database did not return a GTA ID.",
    };
  }
  if (!isAssignedGtaId(gtaId)) {
    return {
      ok: false,
      fieldErrors: {},
      formError: `The database returned “${gtaId}”, which is not a GTA-NNNNNN ID.`,
    };
  }
  if (!isApprenticeStatus(row.status)) {
    return {
      ok: false,
      fieldErrors: {},
      formError: `The apprentice was saved as ${gtaId}, but the status “${row.status}” is not recognised. Refresh the list.`,
    };
  }

  return {
    ok: true,
    apprentice: {
      gtaId,
      firstName: row.first_name,
      middleNames: row.middle_names,
      lastName: row.last_name,
      email: row.email,
      programmeId: row.programme_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}
