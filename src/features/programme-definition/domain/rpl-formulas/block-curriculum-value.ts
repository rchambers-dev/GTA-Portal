/**
 * Pure curriculum valuation helpers (formula-agnostic).
 * Block Value = sum of ALL mapping curriculumValues on that block.
 * isPrimary / learningIntent have no financial meaning here.
 */

import type { BlockKsbMapping, ImportedKsb, KsbType, SpineItem } from "../types";

export const DEFAULT_CURRICULUM_VALUE = 1.0;

export type BlockCurriculumTotals = {
  blockId: string;
  knowledgeValue: number;
  skillsValue: number;
  behaviourValue: number;
  blockValue: number;
};

export type CurriculumValueValidation =
  | { ok: true; value: number }
  | { ok: false; message: string };

export function validateCurriculumValue(
  raw: unknown,
): CurriculumValueValidation {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return {
      ok: false,
      message: "Curriculum value must be a finite number greater than 0.",
    };
  }
  if (raw <= 0) {
    return {
      ok: false,
      message: "Curriculum value must be greater than 0.",
    };
  }
  return { ok: true, value: raw };
}

export function assertCurriculumValue(raw: unknown): number {
  const result = validateCurriculumValue(raw);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

/** Normalize missing / legacy mappings → default 1.0 (data migration only). */
export function normalizeCurriculumValue(raw: unknown): number {
  if (raw == null) return DEFAULT_CURRICULUM_VALUE;
  const result = validateCurriculumValue(raw);
  if (!result.ok) return DEFAULT_CURRICULUM_VALUE;
  return result.value;
}

export function buildKsbTypeMap(
  ksbs: Pick<ImportedKsb, "code" | "type">[],
): Map<string, KsbType> {
  const map = new Map<string, KsbType>();
  for (const k of ksbs) {
    map.set(k.code.trim().toUpperCase(), k.type);
  }
  return map;
}

/** Training blocks only — never gateway / EPA / milestone / break. */
export function trainingBlockIds(spineItems: SpineItem[]): string[] {
  return spineItems
    .filter((i) => i.itemType === "block")
    .map((i) => i.id);
}

export function calculateBlockCurriculumTotals(
  blockId: string,
  mappings: BlockKsbMapping[],
  ksbTypes: Map<string, KsbType>,
): BlockCurriculumTotals {
  let knowledgeValue = 0;
  let skillsValue = 0;
  let behaviourValue = 0;

  for (const m of mappings) {
    if (m.blockId !== blockId) continue;
    const type = ksbTypes.get(m.ksbCode.toUpperCase());
    if (!type) continue;
    const value = assertCurriculumValue(m.curriculumValue);
    if (type === "knowledge") knowledgeValue += value;
    else if (type === "skill") skillsValue += value;
    else behaviourValue += value;
  }

  return {
    blockId,
    knowledgeValue,
    skillsValue,
    behaviourValue,
    blockValue: knowledgeValue + skillsValue + behaviourValue,
  };
}

export function calculateProgrammeCurriculumValue(
  blockTotals: BlockCurriculumTotals[],
): number {
  return blockTotals.reduce((sum, b) => sum + b.blockValue, 0);
}
