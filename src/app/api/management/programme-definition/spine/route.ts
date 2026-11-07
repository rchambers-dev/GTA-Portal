import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { requireCurriculumAuthoringAccess } from "@/features/programme-definition/domain/curriculum-authoring-access";
import {
  loadProgrammeSpine,
  saveProgrammeSpine,
} from "@/features/programme-definition/domain/spine-repository";
import {
  ProgrammeParametersValidationError,
  parseStoredProgrammeParameters,
} from "@/features/programme-definition/domain/rpl-formulas/programme-parameters";
import type {
  BlockKsbMapping,
  GtaProgrammeVersion,
  ProgrammeDeliveryParameters,
  SpineItem,
} from "@/features/programme-definition/domain/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireCurriculumAuthoringAccess(request);
  if (access instanceof NextResponse) return access;
  try {
    const url = new URL(request.url);
    const standardCode = (url.searchParams.get("standardCode") || "")
      .trim()
      .toUpperCase();
    const programmeVersionId =
      url.searchParams.get("programmeVersionId")?.trim() || "";

    if (!programmeVersionId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "programmeVersionId is required. Programme versions must be loaded explicitly — the API will not select the newest version.",
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const loaded = await loadProgrammeSpine(supabase, programmeVersionId);
    if (!loaded?.version) {
      return NextResponse.json({ ok: true, programme: null });
    }

    const { data: prog } = await supabase
      .from("gta_programmes")
      .select("id, title")
      .eq("id", loaded.version.programme_id)
      .maybeSingle();

    const { data: stdVer } = await supabase
      .from("se_standard_versions")
      .select("external_version, standard_id")
      .eq("id", loaded.version.standard_version_id)
      .maybeSingle();

    const { data: std } = stdVer
      ? await supabase
          .from("se_standards")
          .select("standard_code")
          .eq("id", stdVer.standard_id)
          .maybeSingle()
      : { data: null };

    const resolvedCode = (std?.standard_code || "").toUpperCase();
    if (standardCode && resolvedCode && standardCode !== resolvedCode) {
      return NextResponse.json(
        {
          ok: false,
          error: `programmeVersionId does not belong to standard ${standardCode}.`,
        },
        { status: 400 },
      );
    }

    const programme: GtaProgrammeVersion = {
      id: loaded.version.id,
      programmeId: loaded.version.programme_id,
      programmeTitle: prog?.title || "GTA Delivery",
      standardVersionId: loaded.version.standard_version_id,
      standardCode: resolvedCode || standardCode,
      externalVersion: stdVer?.external_version || "",
      internalVersion: loaded.version.internal_version || "1",
      status: loaded.version.status as GtaProgrammeVersion["status"],
      spineItems: loaded.spineItems,
      ksbMappings: loaded.ksbMappings,
      parameters: loaded.parameters,
      hasEnrolledApprentices: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, programme });
  } catch (err) {
    const status =
      err instanceof ProgrammeParametersValidationError ? 422 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Could not load spine.",
      },
      { status },
    );
  }
}

type PutBody = {
  programmeId?: string;
  programmeVersionId?: string;
  programmeTitle?: string;
  standardCode?: string;
  externalVersion?: string;
  standardVersionId?: string;
  status?: string;
  internalVersion?: string;
  spineItems?: SpineItem[];
  ksbMappings?: BlockKsbMapping[];
  parameters?: ProgrammeDeliveryParameters;
};

export async function PUT(request: Request) {
  const access = await requireCurriculumAuthoringAccess(request);
  if (access instanceof NextResponse) return access;
  try {
    const body = (await request.json().catch(() => ({}))) as PutBody;
    if (
      !body.programmeId ||
      !body.programmeVersionId ||
      !body.standardCode ||
      !body.standardVersionId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "programmeId, programmeVersionId, standardCode and standardVersionId are required.",
        },
        { status: 400 },
      );
    }

    if (body.parameters == null) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "parameters are required. Programme calculation configuration must be persisted with the version.",
        },
        { status: 400 },
      );
    }

    let parameters: ProgrammeDeliveryParameters;
    try {
      parameters = parseStoredProgrammeParameters(body.parameters);
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : "Invalid programme parameters.",
        },
        { status: 422 },
      );
    }

    const supabase = createSupabaseAdminClient();
    await saveProgrammeSpine(supabase, {
      programmeId: body.programmeId,
      programmeVersionId: body.programmeVersionId,
      programmeTitle: body.programmeTitle || "GTA Delivery",
      standardCode: body.standardCode,
      standardVersionId: body.standardVersionId,
      status: body.status || "draft",
      internalVersion: body.internalVersion || "1",
      spineItems: body.spineItems || [],
      ksbMappings: body.ksbMappings || [],
      parameters,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const status =
      err instanceof ProgrammeParametersValidationError ? 422 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Could not save spine.",
      },
      { status },
    );
  }
}
