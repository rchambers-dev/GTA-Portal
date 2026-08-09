/**
 * Curriculum evidence adapter — extensible for future teaching materials.
 * AI-1 uses the frozen original Autocare lesson-plan corpus only.
 */

import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import type {
  EvidenceSourceType,
  EvidenceStatus,
} from "./types";

export type EvidenceSession = {
  evidenceRefId: string;
  sourceDocumentId: string;
  sourceType: EvidenceSourceType;
  evidenceStatus: EvidenceStatus;
  version: string;
  contentHashSha256: string;
  week: number;
  blockNumber: number;
  file: string;
  title: string;
  topic: string;
  /** Search/judge text — focusLine intentionally excluded. */
  searchableText: string;
  strongText: string;
  weakText: string;
  practicalText: string;
  objectivesText: string;
  excerptSeed: string;
};

export type EvidencePack = {
  sourceDocumentId: string;
  sourceType: EvidenceSourceType;
  evidenceStatus: EvidenceStatus;
  title: string;
  version: string;
  contentHashSha256: string;
  path: string;
  sessions: EvidenceSession[];
};

const CORPUS_CANDIDATES = [
  path.join(
    process.cwd(),
    "data",
    "curriculum-evidence",
    "autocare-st0499-v1-original-corpus.json",
  ),
  path.join(process.cwd(), ".tmp-original-curriculum-corpus.json"),
];

function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(asText).join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(asText)
      .join(" ");
  }
  return String(value);
}

function flattenActivities(activities: unknown): {
  theory: string;
  practical: string;
  application: string;
  consolidation: string;
} {
  const a =
    activities && typeof activities === "object"
      ? (activities as Record<string, unknown>)
      : {};
  return {
    theory: asText(a.theory).toLowerCase(),
    practical: asText(a.practical).toLowerCase(),
    application: asText(a.application).toLowerCase(),
    consolidation: asText(a.consolidation).toLowerCase(),
  };
}

export function resolveOriginalCorpusPath(): string {
  for (const p of CORPUS_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    "Original Autocare curriculum corpus not found. Expected data/curriculum-evidence/autocare-st0499-v1-original-corpus.json",
  );
}

export function loadOriginalLessonPlanEvidencePack(): EvidencePack {
  const corpusPath = resolveOriginalCorpusPath();
  const rawBytes = readFileSync(corpusPath);
  const contentHashSha256 = createHash("sha256").update(rawBytes).digest("hex");
  const parsed = JSON.parse(rawBytes.toString("utf8")) as {
    extractedAtNote?: string;
    sessions?: Array<Record<string, unknown>>;
  };

  if (
    parsed.extractedAtNote &&
    !/original/i.test(parsed.extractedAtNote)
  ) {
    throw new Error("Corpus note does not confirm original-only evidence.");
  }

  const sourceDocumentId = "autocare-st0499-v1-original-corpus";
  const version = "v1.0";
  const sessions: EvidenceSession[] = [];

  for (const s of parsed.sessions ?? []) {
    const week = Number(s.week);
    const blockNumber = Number(s.block);
    if (!Number.isFinite(week) || !Number.isFinite(blockNumber)) continue;

    const acts = flattenActivities(s.activities);
    const topic = asText(s.topic);
    const title = asText(s.title);
    const aims = asText(s.aims).toLowerCase();
    const objectives = asText(s.learningObjectives).toLowerCase();
    const assessment = asText(s.assessment).toLowerCase();
    const relevance = asText(s.occupationalRelevance).toLowerCase();
    // Intentionally ignore focusLine KSB dumps as evidence channels.
    const stockAim = "develop secure occupational knowledge";
    const aimsClean = aims.includes(stockAim) ? "" : aims;

    const strongText = [
      topic.toLowerCase(),
      title.toLowerCase(),
      objectives,
      acts.practical,
      acts.application,
      assessment,
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const weakText = [aimsClean, acts.theory, acts.consolidation, relevance]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const searchableText = `${strongText} ${weakText}`.trim();
    const file = asText(s.file) || `week-${week}`;
    const evidenceRefId = `${sourceDocumentId}:W${String(week).padStart(3, "0")}`;

    sessions.push({
      evidenceRefId,
      sourceDocumentId,
      sourceType: "lesson_plan_corpus",
      evidenceStatus: "current_approved",
      version,
      contentHashSha256,
      week,
      blockNumber,
      file,
      title,
      topic,
      searchableText,
      strongText,
      weakText,
      practicalText: acts.practical,
      objectivesText: objectives,
      excerptSeed: strongText.slice(0, 420),
    });
  }

  if (!sessions.length) {
    throw new Error("Original curriculum corpus contained no sessions.");
  }

  return {
    sourceDocumentId,
    sourceType: "lesson_plan_corpus",
    evidenceStatus: "current_approved",
    title: "Autocare L2 Lesson Plans v1.0 (original untouched)",
    version,
    contentHashSha256,
    path: corpusPath,
    sessions,
  };
}

/**
 * Future teaching materials will register via this shape.
 * Evaluation stages:
 * - AI-1.1a: SOW / original lesson-plan corpus only (current)
 * - AI-1.1b: teaching-material enriched (slides, worksheets, practical briefs, etc.)
 */
export type FutureEvidenceSourceDescriptor = {
  sourceDocumentId: string;
  sourceType: Exclude<EvidenceSourceType, "lesson_plan_corpus">;
  evidenceStatus: EvidenceStatus;
  title: string;
  version: string | null;
  contentHashSha256: string;
};
