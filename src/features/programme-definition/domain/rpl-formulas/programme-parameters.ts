/**
 * Versioned programme calculation/configuration parameters.
 *
 * Persistence: gta_programme_versions.parameters (JSONB).
 * Defaults: only for create / explicit migration — never invent on GET.
 * Invalid stored shapes fail validation (no silent repair).
 */

import { z } from "zod";
import type { ProgrammeDeliveryParameters, RplFormulaKey } from "../types";
import { defaultBlockKsbValueV1Params } from "./block-ksb-value-v1";

const fixedCostLineSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  amountPounds: z.number().finite().min(0),
  enabled: z.boolean(),
  sequence: z.number().finite(),
});

/**
 * Flat versioned snapshot. Both formula keys share one JSON object so
 * historical weighted fields remain available when formulaKey is legacy.
 */
export const programmeParametersSchema = z
  .object({
    expectedOtjHours: z.number().finite().min(0).nullable(),
    formulaKey: z.enum(["block_ksb_value_v1", "weighted_ksb_cap_v1"]),
    formulaStatus: z.enum(["draft", "published"]),
    includeAplK: z.boolean(),
    includeAplS: z.boolean(),
    includeAplB: z.boolean(),
    aplWeightK: z.number().finite().min(0),
    aplWeightS: z.number().finite().min(0),
    aplWeightB: z.number().finite().min(0),
    aplMaxFraction: z.number().finite().min(0).max(1),
    includeRplKnowledge: z.boolean(),
    includeRplSkills: z.boolean(),
    includeRplBehaviours: z.boolean(),
    fundingBandPounds: z.number().finite().min(0).nullable(),
    fixedCostLines: z.array(fixedCostLineSchema),
    rplNotes: z.string(),
    /** Controlled Autocare Phase 1 tag — optional; ignored by RPL maths. */
    controlTag: z.string().optional(),
    publishedMinimumOtjHours: z.number().finite().min(0).optional(),
    calendarWeeks: z.number().int().positive().optional(),
    plannedSessions: z.number().int().positive().optional(),
    phase: z.number().int().positive().optional(),
    decisionsLog: z.string().optional(),
  })
  .strict();

export type ParsedProgrammeParameters = z.infer<typeof programmeParametersSchema>;

export class ProgrammeParametersValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgrammeParametersValidationError";
  }
}

function assertFormulaKey(raw: unknown): RplFormulaKey {
  if (raw === "block_ksb_value_v1" || raw === "weighted_ksb_cap_v1") {
    return raw;
  }
  if (raw == null || raw === "") {
    throw new ProgrammeParametersValidationError(
      "Stored programme parameters are missing formulaKey.",
    );
  }
  throw new ProgrammeParametersValidationError(
    `Unknown RPL formula key: ${typeof raw === "string" ? raw : JSON.stringify(raw)}`,
  );
}

/** Defaults for NEW programme versions only. */
export function createDefaultProgrammeParameters(): ProgrammeDeliveryParameters {
  const finance = defaultBlockKsbValueV1Params();
  return {
    expectedOtjHours: null,
    formulaKey: "block_ksb_value_v1",
    formulaStatus: "draft",
    includeAplK: true,
    includeAplS: true,
    includeAplB: true,
    aplWeightK: 0.3,
    aplWeightS: 0.5,
    aplWeightB: 0.2,
    aplMaxFraction: 0.3,
    includeRplKnowledge: true,
    includeRplSkills: true,
    includeRplBehaviours: true,
    fundingBandPounds: finance.fundingBandPounds,
    fixedCostLines: finance.fixedCostLines,
    rplNotes: "",
  };
}

/**
 * Strict parse for DB / API payloads.
 * Rejects empty objects, unknown formula keys, and incomplete shapes.
 * Does not silently fill defaults.
 */
export function parseStoredProgrammeParameters(
  raw: unknown,
): ProgrammeDeliveryParameters {
  if (
    raw == null ||
    (typeof raw === "object" &&
      !Array.isArray(raw) &&
      Object.keys(raw as object).length === 0)
  ) {
    throw new ProgrammeParametersValidationError(
      "Programme version has no stored parameters configuration.",
    );
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ProgrammeParametersValidationError(
      "Programme parameters must be a JSON object.",
    );
  }

  const record = raw as Record<string, unknown>;
  const formulaKey = assertFormulaKey(record.formulaKey);

  const parsed = programmeParametersSchema.safeParse({
    ...record,
    formulaKey,
  });

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new ProgrammeParametersValidationError(
      `Invalid programme parameters: ${detail}`,
    );
  }

  return parsed.data;
}

/** JSON-ready snapshot for JSONB upsert (validated). */
export function serializeProgrammeParameters(
  params: ProgrammeDeliveryParameters,
): ProgrammeDeliveryParameters {
  return parseStoredProgrammeParameters(params);
}
