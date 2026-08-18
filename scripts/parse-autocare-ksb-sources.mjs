/**
 * Parse Desktop SOW v4.4 weekly KSB cells and AF1.34 26-27 KSB Assessment
 * Linked blocks. Writes a JSON source file used by the attach script.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";

const DESKTOP = path.join(
  os.homedir(),
  "OneDrive - Doncaster GTA",
  "Desktop",
);
const DOCX = path.join(DESKTOP, "Autocare_Technician_L2_SOW_v4.4.docx");
const XLSX = path.join(
  DESKTOP,
  "AF1.34_RPLE_Autocare_L2_Assessment_26-27_v1.0.xlsx",
);
const OUT = path.resolve(
  "tests/artifacts/autocare-v1/sow-only/weekly-coverage/parsed-ksb-sources.json",
);

const OFFICIAL = new Set([
  ...Array.from({ length: 34 }, (_, i) => `K${i + 1}`),
  ...Array.from({ length: 8 }, (_, i) => `S${i + 1}`),
  ...Array.from({ length: 16 }, (_, i) => `S${i + 10}`),
  ...Array.from({ length: 5 }, (_, i) => `B${i + 1}`),
]);

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function unzipOffice(filePath, dest) {
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const zipPath = path.join(dest, "archive.zip");
  fs.copyFileSync(filePath, zipPath);
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${path.join(dest, "unzipped").replace(/'/g, "''")}' -Force"`,
    { stdio: "pipe" },
  );
  return path.join(dest, "unzipped");
}

function xmlText(xml) {
  return xml
    .replace(/<w:tab\b[^/]*\/>/g, "\t")
    .replace(/<w:br\b[^/]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function parseSharedStrings(xml) {
  const strings = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml))) {
    const texts = [...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) =>
      x[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))),
    );
    strings.push(texts.join(""));
  }
  return strings;
}

function parseSheetCells(xml, shared) {
  const rows = new Map();
  const rowRe = /<row\b[^>]* r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(xml))) {
    const rowNum = Number(rowMatch[1]);
    const cells = {};
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[2]))) {
      const attrs = cellMatch[1];
      const ref = / r="([A-Z]+)(\d+)"/.exec(attrs);
      if (!ref) continue;
      const col = ref[1];
      const isShared = /\bt="s"/.test(attrs);
      const v = /<v>([\s\S]*?)<\/v>/.exec(cellMatch[2]);
      if (!v) continue;
      cells[col] = isShared ? shared[Number(v[1])] ?? "" : v[1];
    }
    rows.set(rowNum, cells);
  }
  return rows;
}

function weekToBlock(week) {
  if (week >= 1 && week <= 10) return 1;
  if (week >= 11 && week <= 20) return 2;
  if (week >= 21 && week <= 30) return 3;
  if (week >= 31 && week <= 40) return 4;
  if (week >= 41 && week <= 50) return 5;
  if (week >= 51 && week <= 60) return 6;
  if (week >= 61 && week <= 70) return 7;
  if (week >= 71 && week <= 80) return 8;
  if (week >= 81 && week <= 94) return 9;
  if (week >= 95 && week <= 112) return 10;
  return null;
}

function expandCodes(text) {
  const codes = [];
  const seen = new Set();
  const add = (code) => {
    const next = code.toUpperCase();
    if (seen.has(next)) return;
    seen.add(next);
    codes.push(next);
  };
  const parts = text
    .split(/Eligible OTJ/i)[0]
    .split(/[;,]|\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    const range = /^(K|S|B)(\d+)\s*-\s*(?:(K|S|B))?(\d+)$/i.exec(part);
    if (range) {
      const letter = range[1].toUpperCase();
      const from = Number(range[2]);
      const to = Number(range[4]);
      if (from <= to && to - from < 80) {
        for (let n = from; n <= to; n++) add(`${letter}${n}`);
      }
      continue;
    }
    const single = /^(K|S|B)(\d+)$/i.exec(part);
    if (single) add(`${single[1].toUpperCase()}${single[2]}`);
  }
  return codes;
}

function isKsbCellLine(line) {
  const beforeOtj = line.split(/Eligible OTJ/i)[0].trim();
  if (!beforeOtj) return false;
  if (/Controlled shared Foundation Skills mapping/i.test(line)) return true;
  const tokens = beforeOtj.split(/[;,\s]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => /^[KSB]\d{1,2}(?:-[KSB]?\d{1,2})?$/i.test(t));
}

function findSessionKsbCell(lines, start) {
  for (let j = start; j < Math.min(start + 12, lines.length); j++) {
    const line = lines[j];
    if (/^Block\s+\d+\s*[|/]?\s*Week\s+\d+/i.test(line) && j !== start) {
      break;
    }
    if (/Controlled shared Foundation Skills mapping/i.test(line)) {
      return { foundation: true, codes: [], line, index: j };
    }
    if (isKsbCellLine(line)) {
      return {
        foundation: false,
        codes: expandCodes(line),
        line,
        index: j,
      };
    }
  }
  return { foundation: false, codes: [], line: null, index: -1 };
}

function parseLinkedList(text) {
  const linked = /Linked KSBs:\s*([\s\S]+)/i.exec(text);
  return expandCodes(linked ? linked[1] : text);
}

if (!fs.existsSync(DOCX)) die(`Missing ${DOCX}`);
if (!fs.existsSync(XLSX)) die(`Missing ${XLSX}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ksb-parse-"));
const docxRoot = unzipOffice(DOCX, path.join(tmp, "docx"));
const xlsxRoot = unzipOffice(XLSX, path.join(tmp, "xlsx"));

const sowText = xmlText(
  fs.readFileSync(path.join(docxRoot, "word", "document.xml"), "utf8"),
);
const lines = sowText.split("\n").map((l) => l.trim()).filter(Boolean);

const sessions = [];
const titleRe =
  /^Block\s+(\d+)\s*[|/]?\s*Week\s+(\d+)\b(.*)$/i;
for (let i = 0; i < lines.length; i++) {
  const title = titleRe.exec(lines[i]);
  if (!title) continue;
  const block = Number(title[1]);
  const week = Number(title[2]);
  const topic = title[3].replace(/^\s*[|\-–]\s*/, "").trim();
  const ksbCell = findSessionKsbCell(lines, i + 1);
  sessions.push({
    block,
    week,
    topic,
    foundation: ksbCell.foundation,
    codes: ksbCell.foundation ? [] : ksbCell.codes,
    derivedBlock: weekToBlock(week),
    excludedDump: false,
  });
}

const DUMP_WEEKS = new Set([111, 112]);
const byBlock = {};
const skipped = [];
for (const session of sessions) {
  const block = session.derivedBlock ?? session.block;
  if (!byBlock[block]) {
    byBlock[block] = { codes: new Set(), sessions: 0, excludedDumpSessions: 0 };
  }
  byBlock[block].sessions += 1;
  const dumpWeek =
    DUMP_WEEKS.has(session.week) || session.codes.filter((c) => OFFICIAL.has(c)).length >= 40;
  if (dumpWeek && !session.foundation) {
    session.excludedDump = true;
    byBlock[block].excludedDumpSessions += 1;
    continue;
  }
  session.excludedDump = false;
  for (const code of session.codes) {
    if (code === "S26" || !OFFICIAL.has(code)) {
      skipped.push({
        code,
        week: session.week,
        block,
        reason: "not official ST0499 v1.3",
      });
      continue;
    }
    byBlock[block].codes.add(code);
  }
}

const shared = parseSharedStrings(
  fs.readFileSync(path.join(xlsxRoot, "xl", "sharedStrings.xml"), "utf8"),
);
const ksbRows = parseSheetCells(
  fs.readFileSync(path.join(xlsxRoot, "xl", "worksheets", "sheet2.xml"), "utf8"),
  shared,
);
const blockRows = parseSheetCells(
  fs.readFileSync(path.join(xlsxRoot, "xl", "worksheets", "sheet3.xml"), "utf8"),
  shared,
);

const af134KsbLinks = [];
for (let r = 7; r <= 70; r++) {
  const row = ksbRows.get(r);
  if (!row) continue;
  const code = String(row.B || "").trim().toUpperCase();
  if (!/^[KSB]\d+$/.test(code)) continue;
  const linked = String(row.D || "")
    .split(/[,\s]+/)
    .map((n) => Number(n))
    .filter((n) => n >= 1 && n <= 12);
  af134KsbLinks.push({
    type: String(row.A || "").trim(),
    code,
    requirement: String(row.C || "").trim(),
    linkedBlocks: linked,
  });
}

const af134Blocks = [];
for (let r = 7; r <= 18; r++) {
  const row = blockRows.get(r);
  if (!row) continue;
  const number = Number(row.A);
  const name = String(row.B || "");
  af134Blocks.push({
    number,
    name: name.split("\n")[0].trim(),
    ksbCount: Number(row.C || 0),
    linkedCodes: parseLinkedList(name),
  });
}

const block1Fs = af134Blocks.find((b) => b.number === 1)?.linkedCodes ?? [];

const coverage = {};
for (const [block, row] of Object.entries(byBlock)) {
  coverage[block] = {
    sessions: row.sessions,
    excludedDumpSessions: row.excludedDumpSessions,
    codes: [...row.codes].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    ),
  };
}

const result = {
  generatedAt: new Date().toISOString(),
  sources: {
    sow: path.basename(DOCX),
    af134: path.basename(XLSX),
    af134Form: shared[1] || null,
  },
  notes: {
    sowWeekly:
      "KSBs listed in each weekly session cell. Block 1 weeks point to Foundation Skills mapping, not per-week codes.",
    af134:
      "26-27 workbook lists each KSB once with Linked blocks for RPL averaging. It does not assign one Primary block per KSB.",
    block1:
      "Block 1 coverage taken from AF1.34 Block Summary / SOW Foundation Skills cross-reference.",
  },
  sowSessions: sessions,
  sowWeeklyCoverage: coverage,
  skippedUnofficial: skipped,
  af134KsbLinks,
  af134Blocks: af134Blocks.map((b) => ({
    number: b.number,
    name: b.name,
    ksbCount: b.ksbCount,
    linkedCount: b.linkedCodes.length,
    linkedCodes: b.linkedCodes,
  })),
  block1FoundationSkills: block1Fs.filter((c) => OFFICIAL.has(c)),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));

const counts = Object.fromEntries(
  Object.entries(coverage).map(([b, row]) => [b, row.codes.length]),
);
console.log(
  JSON.stringify(
    {
      out: OUT,
      sowSessions: sessions.length,
      weeksFound: [...new Set(sessions.map((s) => s.week))].sort((a, b) => a - b),
      missingWeeks: Array.from({ length: 112 }, (_, i) => i + 1).filter(
        (w) => !sessions.some((s) => s.week === w),
      ),
      dumpWeeksExcluded: sessions.filter((s) => s.excludedDump).map((s) => s.week),
      emptySpecialist: sessions.filter((s) => !s.foundation && s.codes.length === 0).map((s) => ({ week: s.week, topic: s.topic })),
      weeklyCoverageCounts: counts,
      weeklyCoverageCounts: counts,
      skippedUnofficial: skipped.length,
      af134KsbRows: af134KsbLinks.length,
      af134SingleHome: af134KsbLinks.filter((r) => r.linkedBlocks.length === 1)
        .length,
      block1Fs: result.block1FoundationSkills.length,
    },
    null,
    2,
  ),
);
