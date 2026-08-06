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
import type { OfficialStandardVersion } from "@/features/programme-definition/domain/types";

export const runtime = "nodejs";

type Body = {
  occupationCode?: string;
  standardCode?: string;
};

function receiptFor(
  official: OfficialStandardVersion,
  args: {
    occupationCode: string;
    standardCode: string;
    source: "database" | "skills_england";
    productCode?: string | null;
    apprenticeshipError?: string | null;
    persisted?: boolean;
    dbWarning?: string | null;
  },
) {
  return {
    at: new Date().toISOString(),
    request: {
      occupationCode: args.occupationCode,
      standardCode: args.standardCode,
      productCode: args.productCode ?? null,
    },
    source: args.source,
    ok: true,
    externalVersion: official.externalVersion,
    sourceHash: official.sourceHash,
    duties: official.duties.length,
    ksbs: official.ksbs.length,
    title: official.title,
    apprenticeshipError: args.apprenticeshipError ?? null,
    persisted: args.persisted ?? true,
    dbWarning: args.dbWarning ?? null,
  };
}

/** Keep client store / localStorage lean — raw JSON stays in Supabase. */
function slimOfficialForClient(
  official: OfficialStandardVersion,
): OfficialStandardVersion {
  return {
    ...official,
    occupationRawPayload: { note: "Raw payload kept in database only" },
    apprenticeshipRawPayload: null,
  };
}

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
        PROGRAMME_APPRENTICESHIPS.find(
          (a) => a.occupationCode === occupationCode,
        )?.standardCode || "";
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

    let dbWarning: string | null = null;
    try {
      const supabase = createSupabaseAdminClient();
      const existing = await findOfficialInDatabase(supabase, {
        occupationCode,
        standardCode,
      });
      if (existing) {
        const official = slimOfficialForClient(existing);
        return NextResponse.json({
          ok: true,
          source: "database",
          official,
          message: "Loaded from the portal database (already imported).",
          receipt: receiptFor(official, {
            occupationCode,
            standardCode,
            source: "database",
          }),
        });
      }
    } catch (dbReadError) {
      // Fall through to Skills England — DB blips must not block Load.
      dbWarning =
        dbReadError instanceof Error
          ? `Portal database unavailable: ${dbReadError.message}`
          : "Portal database unavailable.";
    }

    const apiKey = process.env.SKILLS_ENGLAND_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          source: "skills_england",
          error: dbWarning
            ? `${dbWarning} Skills England key is also not configured, so this apprenticeship cannot be loaded.`
            : "This apprenticeship is not in the portal database yet, and SKILLS_ENGLAND_API_KEY is not configured to import it.",
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
              ? `${dbWarning ? `${dbWarning} ` : ""}Skills England Maps import failed: ${err.message}`
              : `${dbWarning ? `${dbWarning} ` : ""}Skills England Maps import failed.`,
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

    let saved = built;
    let persisted = false;
    try {
      const supabase = createSupabaseAdminClient();
      saved = await saveOfficialToDatabase(supabase, built);
      persisted = true;
    } catch (err) {
      // Still hand the pack to the client so Programme Builder can open.
      dbWarning =
        err instanceof Error
          ? `Fetched from Skills England but could not save to the database: ${err.message}`
          : "Fetched from Skills England but could not save to the database.";
    }

    const official = slimOfficialForClient(saved);
    return NextResponse.json({
      ok: true,
      source: "skills_england",
      official,
      apprenticeshipError,
      message: persisted
        ? `Imported ${official.title || official.standardCode} v${official.externalVersion} from Skills England and saved to the portal database.`
        : `Imported ${official.title || official.standardCode} v${official.externalVersion} from Skills England (not saved to database yet).`,
      receipt: receiptFor(official, {
        occupationCode,
        standardCode,
        source: "skills_england",
        productCode,
        apprenticeshipError,
        persisted,
        dbWarning,
      }),
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
