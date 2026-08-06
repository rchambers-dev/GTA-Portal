import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/adapters/supabase/client";
import { buildOfficialStandardVersion } from "@/features/programme-definition/domain/normalize";
import {
  findOfficialInDatabase,
  saveOfficialToDatabase,
} from "@/features/programme-definition/domain/official-repository";
import {
  PROGRAMME_APPRENTICESHIPS,
  apprenticeshipByStandardCode,
} from "@/features/programme-definition/domain/programme-apprenticeships";
import {
  ApprenticeshipStandardsClient,
  OccupationalMapsClient,
  resolveApprenticeshipProductCode,
} from "@/features/programme-definition/domain/skills-england-clients";

export const runtime = "nodejs";

type Body = {
  occupationCode?: string;
  standardCode?: string;
};

/**
 * Load official standard from DB if present; otherwise import from Skills England
 * and persist once. Never creates a duplicate for the same ST + version.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    let occupationCode = body.occupationCode?.trim().toUpperCase() || "";
    let standardCode = body.standardCode?.trim().toUpperCase() || "";

    if (!occupationCode && standardCode) {
      occupationCode =
        apprenticeshipByStandardCode(standardCode)?.occupationCode || "";
    }
    if (!standardCode && occupationCode) {
      standardCode =
        PROGRAMME_APPRENTICESHIPS.find((a) => a.occupationCode === occupationCode)
          ?.standardCode || "";
    }

    if (!occupationCode && !standardCode) {
      return NextResponse.json(
        {
          ok: false,
          error: "Provide an apprenticeship (occupation or standard code).",
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();

    try {
      const existing = await findOfficialInDatabase(supabase, {
        occupationCode,
        standardCode,
      });
      if (existing) {
        return NextResponse.json({
          ok: true,
          source: "database",
          official: existing,
          message: "Loaded from the portal database (already imported).",
        });
      }
    } catch (dbReadError) {
      return NextResponse.json(
        {
          ok: false,
          source: "database",
          error:
            dbReadError instanceof Error
              ? `Could not read the portal database: ${dbReadError.message}`
              : "Could not read the portal database.",
        },
        { status: 503 },
      );
    }

    const apiKey = process.env.SKILLS_ENGLAND_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          source: "skills_england",
          error:
            "This apprenticeship is not in the portal database yet, and SKILLS_ENGLAND_API_KEY is not configured to import it.",
        },
        { status: 503 },
      );
    }

    if (!occupationCode) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This apprenticeship is not in the database and no occupation code is available to import from Skills England.",
        },
        { status: 400 },
      );
    }

    let mapsRaw: unknown;
    try {
      mapsRaw = await new OccupationalMapsClient(apiKey).fetchOccupation(
        occupationCode,
      );
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          source: "skills_england",
          error:
            err instanceof Error
              ? `Not in database, and Skills England Maps import failed: ${err.message}`
              : "Not in database, and Skills England Maps import failed.",
        },
        { status: 502 },
      );
    }

    const productCode =
      resolveApprenticeshipProductCode(
        mapsRaw as {
          products?: Array<{ productCode?: string; typeName?: string }>;
        },
      ) ||
      standardCode ||
      null;

    let apprenticeshipRaw: unknown | null = null;
    let apprenticeshipError: string | null = null;
    if (productCode) {
      try {
        apprenticeshipRaw =
          await new ApprenticeshipStandardsClient().fetchStandard(productCode);
      } catch (err) {
        apprenticeshipError =
          err instanceof Error ? err.message : "Apprenticeship fetch failed";
      }
    } else {
      apprenticeshipError = "No apprenticeship product linked on occupation.";
    }

    const built = buildOfficialStandardVersion({
      id: crypto.randomUUID(),
      mapsRaw,
      apprenticeshipRaw,
    });

    let saved;
    try {
      saved = await saveOfficialToDatabase(supabase, built);
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          source: "database",
          error:
            err instanceof Error
              ? `Fetched from Skills England but could not save to the database: ${err.message}`
              : "Fetched from Skills England but could not save to the database.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      source: "skills_england",
      official: saved,
      apprenticeshipError,
      message: `Imported ${saved.title || saved.standardCode} v${saved.externalVersion} from Skills England and saved to the portal database.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Import failed",
      },
      { status: 500 },
    );
  }
}
