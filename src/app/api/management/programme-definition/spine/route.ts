import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { defaultProgrammeParameters } from "@/features/programme-definition/domain/programme-definition-store";
import {
  findProgrammeVersionByStandard,
  loadProgrammeSpine,
  saveProgrammeSpine,
} from "@/features/programme-definition/domain/spine-repository";
import type {
  BlockKsbMapping,
  GtaProgrammeVersion,
  SpineItem,
} from "@/features/programme-definition/domain/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const standardCode = (url.searchParams.get("standardCode") || "")
      .trim()
      .toUpperCase();
    const programmeVersionId =
      url.searchParams.get("programmeVersionId")?.trim() || "";

    if (!standardCode && !programmeVersionId) {
      return NextResponse.json(
        { ok: false, error: "standardCode or programmeVersionId is required." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    let versionId = programmeVersionId;
    let meta: {
      programmeId: string;
      standardVersionId: string;
      title: string;
    } | null = null;

    if (!versionId) {
      const found = await findProgrammeVersionByStandard(supabase, standardCode);
      if (!found) {
        return NextResponse.json({ ok: true, programme: null });
      }
      versionId = found.programmeVersionId;
      meta = {
        programmeId: found.programmeId,
        standardVersionId: found.standardVersionId,
        title: found.title,
      };
    }

    const loaded = await loadProgrammeSpine(supabase, versionId);
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

    const programme: GtaProgrammeVersion = {
      id: loaded.version.id,
      programmeId: loaded.version.programme_id,
      programmeTitle: prog?.title || meta?.title || "GTA Delivery",
      standardVersionId: loaded.version.standard_version_id,
      standardCode: (std?.standard_code || standardCode || "").toUpperCase(),
      externalVersion: stdVer?.external_version || "",
      internalVersion: loaded.version.internal_version || "1",
      status: loaded.version.status as GtaProgrammeVersion["status"],
      spineItems: loaded.spineItems,
      ksbMappings: loaded.ksbMappings,
      parameters: defaultProgrammeParameters(),
      hasEnrolledApprentices: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, programme });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Could not load spine.",
      },
      { status: 500 },
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
};

export async function PUT(request: Request) {
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
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Could not save spine.",
      },
      { status: 500 },
    );
  }
}
