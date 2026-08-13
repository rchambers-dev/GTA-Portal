/**
 * Safe source-extract helpers for catalogue-referenced lesson plans.
 * Binaries may be absent; extracts under tests/artifacts are the review surface.
 */

import fs from "fs";
import path from "path";

const EXTRACTS_ROOT = path.resolve(
  process.cwd(),
  "tests/artifacts/autocare-v1/evidence-enriched/staging/extracts",
);

export function resolveExtractAbsolutePath(extractPath: string): string | null {
  const raw = extractPath?.trim();
  if (!raw) return null;
  const abs = path.isAbsolute(raw)
    ? path.normalize(raw)
    : path.resolve(process.cwd(), raw);
  const root = path.resolve(EXTRACTS_ROOT);
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  if (!fs.existsSync(abs)) return null;
  return abs;
}

export function loadResourceExtractText(input: {
  extractPath?: string;
  evidenceResourceId?: string;
}): { text: string; mode: "extract_file" | "missing" } {
  if (input.extractPath) {
    const abs = resolveExtractAbsolutePath(input.extractPath);
    if (abs) {
      return { text: fs.readFileSync(abs, "utf8"), mode: "extract_file" };
    }
  }
  const id = input.evidenceResourceId?.trim();
  if (id) {
    const fallback = path.join(EXTRACTS_ROOT, `${id}.txt`);
    if (fs.existsSync(fallback)) {
      return { text: fs.readFileSync(fallback, "utf8"), mode: "extract_file" };
    }
  }
  return { text: "", mode: "missing" };
}

/** Heuristic candidate activity lines from a lesson-plan extract (review only). */
export function extractCandidateActivities(extractText: string): string[] {
  if (!extractText.trim()) return [];
  const lines = extractText.split(/\r?\n/);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!/OTJ$/i.test(line)) continue;
    if (!/^\d+(\.\d+)?\s*OTJ$/i.test(line) && line !== "OTJ") continue;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const cand = lines[j]!.trim();
      if (!cand) continue;
      if (/^(Break|Lunch|Non-eligible|Time \/ status|Excluded)/i.test(cand)) {
        break;
      }
      if (cand.length > 40 && !/^\d{2}:\d{2}/.test(cand)) {
        out.push(cand);
        break;
      }
    }
  }
  return [...new Set(out)].slice(0, 6);
}
