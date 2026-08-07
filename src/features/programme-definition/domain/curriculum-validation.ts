/**
 * Curriculum Validation — advisory quality checks on Block↔KSB mappings.
 *
 * Findings are always warnings. They never block publish; staff remain authority.
 * Add new rules via register() / DEFAULT_CURRICULUM_RULES without touching
 * mapping create/update helpers.
 */

import type {
  BlockKsbMapping,
  GtaProgrammeVersion,
  LearningIntent,
  OfficialStandardVersion,
} from "./types";
import { LEARNING_INTENT_LABELS } from "./types";

export type CurriculumFindingSeverity = "warning";

export type CurriculumValidationFinding = {
  /** Stable rule id (for registers / docs). */
  ruleId: string;
  /** Issue code surfaced in Programme Builder checklist. */
  code: string;
  severity: CurriculumFindingSeverity;
  message: string;
  ksbCodes?: string[];
};

export type CurriculumValidationContext = {
  programme: GtaProgrammeVersion;
  official: OfficialStandardVersion | null;
  mappings: BlockKsbMapping[];
  /** Block id → spine sequence (blocks only). */
  blockOrder: Map<string, number>;
  /** Uppercased KSB code → mappings ordered by block sequence. */
  byKsb: Map<string, BlockKsbMapping[]>;
  /** Uppercased KSB code → number of distinct blocks it appears on. */
  appearanceCounts: Map<string, number>;
};

export type CurriculumValidationRule = {
  id: string;
  title: string;
  description: string;
  evaluate: (ctx: CurriculumValidationContext) => CurriculumValidationFinding[];
};

export type CurriculumValidationService = {
  listRules(): readonly CurriculumValidationRule[];
  register(rule: CurriculumValidationRule): void;
  validate(
    programme: GtaProgrammeVersion,
    official?: OfficialStandardVersion | null,
  ): CurriculumValidationFinding[];
};

/** Absolute cap — appear in this many blocks or more → heavy duplication. */
export const HEAVY_DUPLICATION_BLOCK_THRESHOLD = 6;
/** Same LearningIntent on this many blocks or more → repetition warning. */
export const REPEATED_INTENT_THRESHOLD = 3;
/** Minimum appearances before peer-outlier comparison can fire. */
export const PEER_OUTLIER_MIN_APPEARANCES = 4;
/** Need at least this many mapped KSBs for peer stats. */
export const PEER_OUTLIER_MIN_COHORT = 5;

function buildContext(
  programme: GtaProgrammeVersion,
  official: OfficialStandardVersion | null,
): CurriculumValidationContext {
  const mappings = programme.ksbMappings ?? [];
  const blockOrder = new Map(
    programme.spineItems
      .filter((i) => i.itemType === "block")
      .map((i) => [i.id, i.sequence]),
  );

  const byKsb = new Map<string, BlockKsbMapping[]>();
  for (const m of mappings) {
    const key = m.ksbCode.toUpperCase();
    const list = byKsb.get(key) ?? [];
    list.push(m);
    byKsb.set(key, list);
  }

  const appearanceCounts = new Map<string, number>();
  for (const [code, list] of byKsb) {
    const ordered = list.slice().sort((a, b) => {
      const sa = blockOrder.get(a.blockId) ?? 9999;
      const sb = blockOrder.get(b.blockId) ?? 9999;
      return sa - sb;
    });
    byKsb.set(code, ordered);
    const distinctBlocks = new Set(ordered.map((m) => m.blockId));
    appearanceCounts.set(code, distinctBlocks.size);
  }

  return {
    programme,
    official,
    mappings,
    blockOrder,
    byKsb,
    appearanceCounts,
  };
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function sampleStdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((s, v) => s + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** INTRODUCE used on more than one block for the same KSB. */
export const ruleMultipleIntroduce: CurriculumValidationRule = {
  id: "multiple_introduce",
  title: "Multiple INTRODUCE",
  description:
    "A KSB should usually be INTRODUCEd once; further blocks typically practise or apply.",
  evaluate(ctx) {
    const findings: CurriculumValidationFinding[] = [];
    for (const [code, ordered] of ctx.byKsb) {
      const n = ordered.filter((m) => m.learningIntent === "introduce").length;
      if (n > 1) {
        findings.push({
          ruleId: "multiple_introduce",
          code: "ksb_multi_introduce",
          severity: "warning",
          message: `${code} is INTRODUCEd in ${n} blocks — usually one INTRODUCE is enough.`,
          ksbCodes: [code],
        });
      }
    }
    return findings;
  },
};

/** ASSESS appears before any INTRODUCE on the spine order. */
export const ruleAssessBeforeIntroduce: CurriculumValidationRule = {
  id: "assess_before_introduce",
  title: "Assess before introduce",
  description:
    "Educational progression usually INTRODUCEs a KSB before ASSESSing it.",
  evaluate(ctx) {
    const findings: CurriculumValidationFinding[] = [];
    for (const [code, ordered] of ctx.byKsb) {
      const firstIntroduce = ordered.findIndex(
        (m) => m.learningIntent === "introduce",
      );
      const firstAssess = ordered.findIndex((m) => m.learningIntent === "assess");
      if (
        firstAssess >= 0 &&
        (firstIntroduce < 0 || firstAssess < firstIntroduce)
      ) {
        findings.push({
          ruleId: "assess_before_introduce",
          code: "ksb_assess_before_introduce",
          severity: "warning",
          message: `${code} is ASSESSed before it has been INTRODUCEd.`,
          ksbCodes: [code],
        });
      }
    }
    return findings;
  },
};

/** Same LearningIntent repeated across many blocks. */
export const ruleRepeatedIntent: CurriculumValidationRule = {
  id: "repeated_intent",
  title: "Repeated LearningIntent",
  description:
    "Repeating the same LearningIntent across many blocks rarely adds curriculum value.",
  evaluate(ctx) {
    const findings: CurriculumValidationFinding[] = [];
    for (const [code, ordered] of ctx.byKsb) {
      const intentCounts = new Map<LearningIntent, number>();
      for (const m of ordered) {
        intentCounts.set(
          m.learningIntent,
          (intentCounts.get(m.learningIntent) ?? 0) + 1,
        );
      }
      for (const [intent, n] of intentCounts) {
        if (n >= REPEATED_INTENT_THRESHOLD) {
          findings.push({
            ruleId: "repeated_intent",
            code: "ksb_repeated_intent",
            severity: "warning",
            message: `${code} uses ${LEARNING_INTENT_LABELS[intent]} in ${n} blocks — review for unnecessary repetition.`,
            ksbCodes: [code],
          });
        }
      }
    }
    return findings;
  },
};

/** Absolute over-mapping onto many blocks. */
export const ruleHeavyDuplication: CurriculumValidationRule = {
  id: "heavy_duplication",
  title: "High block count",
  description:
    "A KSB may appear on several blocks, but very high counts often dilute the journey.",
  evaluate(ctx) {
    const findings: CurriculumValidationFinding[] = [];
    for (const [code, count] of ctx.appearanceCounts) {
      if (count >= HEAVY_DUPLICATION_BLOCK_THRESHOLD) {
        findings.push({
          ruleId: "heavy_duplication",
          code: "ksb_heavy_duplication",
          severity: "warning",
          message: `${code} appears in ${count} blocks and may need review.`,
          ksbCodes: [code],
        });
      }
    }
    return findings;
  },
};

/**
 * Relative outlier vs peer KSBs (same K/S/B type when known, else all mapped KSBs).
 * Fires when a KSB appears far more often than the cohort typical rate.
 */
export const ruleAbovePeerFrequency: CurriculumValidationRule = {
  id: "above_peer_frequency",
  title: "Above peer frequency",
  description:
    "Flag KSBs that appear much more often than similar KSBs on this spine.",
  evaluate(ctx) {
    const findings: CurriculumValidationFinding[] = [];
    const typeByCode = new Map<string, string>();
    for (const ksb of ctx.official?.ksbs ?? []) {
      typeByCode.set(ksb.code.toUpperCase(), ksb.type);
    }

    const cohorts = new Map<string, string[]>();
    for (const code of ctx.appearanceCounts.keys()) {
      const kind = typeByCode.get(code) ?? "all";
      const list = cohorts.get(kind) ?? [];
      list.push(code);
      cohorts.set(kind, list);
    }
    // Fallback single cohort if types unknown / thin.
    if (![...cohorts.values()].some((c) => c.length >= PEER_OUTLIER_MIN_COHORT)) {
      cohorts.clear();
      cohorts.set("all", [...ctx.appearanceCounts.keys()]);
    }

    for (const [, codes] of cohorts) {
      if (codes.length < PEER_OUTLIER_MIN_COHORT) continue;
      const counts = codes.map((c) => ctx.appearanceCounts.get(c) ?? 0);
      const avg = mean(counts);
      const sd = sampleStdDev(counts, avg);
      const relativeCut = Math.max(
        PEER_OUTLIER_MIN_APPEARANCES,
        Math.ceil(avg * 2.5),
      );
      const sigmaCut = Math.max(
        PEER_OUTLIER_MIN_APPEARANCES,
        Math.ceil(avg + 2 * sd),
      );
      const threshold = Math.min(relativeCut, sigmaCut);

      for (const code of codes) {
        const n = ctx.appearanceCounts.get(code) ?? 0;
        if (n < threshold) continue;
        // Avoid double-noise when absolute heavy rule already covers extreme cases
        // — still emit peer framing when above peers but under absolute cap.
        if (n >= HEAVY_DUPLICATION_BLOCK_THRESHOLD) continue;
        findings.push({
          ruleId: "above_peer_frequency",
          code: "ksb_above_peer_frequency",
          severity: "warning",
          message: `${code} appears in ${n} blocks — far more than similar KSBs on this spine (typical ≈ ${avg.toFixed(1)}).`,
          ksbCodes: [code],
        });
      }
    }
    return findings;
  },
};

export const DEFAULT_CURRICULUM_RULES: CurriculumValidationRule[] = [
  ruleMultipleIntroduce,
  ruleAssessBeforeIntroduce,
  ruleRepeatedIntent,
  ruleHeavyDuplication,
  ruleAbovePeerFrequency,
];

export function createCurriculumValidationService(
  initialRules: CurriculumValidationRule[] = DEFAULT_CURRICULUM_RULES,
): CurriculumValidationService {
  const rules: CurriculumValidationRule[] = [...initialRules];

  return {
    listRules() {
      return rules;
    },
    register(rule) {
      const idx = rules.findIndex((r) => r.id === rule.id);
      if (idx >= 0) rules[idx] = rule;
      else rules.push(rule);
    },
    validate(programme, official = null) {
      const ctx = buildContext(programme, official);
      const findings: CurriculumValidationFinding[] = [];
      for (const rule of rules) {
        findings.push(...rule.evaluate(ctx));
      }
      return findings;
    },
  };
}

/** Shared portal instance — mapping logic never depends on this. */
export const curriculumValidation = createCurriculumValidationService();

/** Map service findings onto Programme Builder validation issues. */
export function curriculumFindingsToIssues(
  findings: CurriculumValidationFinding[],
): Array<{
  code: string;
  severity: "warning";
  message: string;
  ksbCodes?: string[];
}> {
  return findings.map((f) => ({
    code: f.code,
    severity: "warning" as const,
    message: f.message,
    ksbCodes: f.ksbCodes,
  }));
}
