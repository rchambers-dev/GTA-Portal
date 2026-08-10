import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { unzipSync, strFromU8 } from "./lib/tiny-inflate-zip.mjs";

const require = createRequire(import.meta.url);
let PDFParse = null;
try {
  PDFParse = require("pdf-parse").PDFParse;
} catch {}

function docxText(buf) {
  try {
    const z = unzipSync(buf);
    const xml = z["word/document.xml"];
    if (!xml) return "";
    let raw = strFromU8(xml);
    raw = raw.replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, " ");
    return raw.replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

async function pdfText(buf) {
  if (!PDFParse) return "";
  try {
    const d = new PDFParse({ data: buf });
    const r = await d.getText();
    return (r.pages || []).map((p) => p.text || "").join("\n");
  } catch {
    return "";
  }
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const roots = [
  "C:/Users/ReissChambers/OneDrive - Doncaster GTA/Desktop/Autocare Learning Materials",
  path.resolve(".tmp-live"),
  path.resolve(
    "tests/artifacts/autocare-v1/evidence-enriched/staging",
  ),
];

const files = roots.flatMap((r) => walk(r));
const queries = {
  task1or2: /\btask\s*[12]\b|task[_-]?[12]\b/i,
  cea: /\bCEA\b|competence.?evidence|continuous.?evidence.?assessment/i,
  jobcard: /job\s*card|jobcard/i,
  observation:
    /observation\s*sheet|tutor\s*observation|observe(?:d|r)?\s+(?:the\s+)?(?:apprentice|learner)/i,
  tyreStrip:
    /strip\s+(?:the\s+)?tyre|bead\s*breaker|dismount|mount(?:ing)?\s+(?:and\s+)?dismount|tyre\s+chang(?:er|ing)|remove\s+and\s+refit\s+a\s+tyre|balancing\s+machine|wheel\s+balanc/i,
  tyreRepairPrac:
    /puncture\s+repair|mushroom\s+patch|repair\s+a\s+tyre|tyre\s+repair/i,
  isolation:
    /service\s*plug|isolate\s+the\s+high\s+voltage|verify\s+that\s+it\s+is\s+not\s+live|HV\s+isolation|isolate\s+(?:and\s+)?(?:safeguard|verify)/i,
  stock:
    /stock\s+management|goods[- ]?in|parts\s+sourc|stock\s+count|parts\s+order|inventory|warranty\s+return/i,
  weekLink:
    /week\s*\d+|calendar\s+week|block\s*\d+\s*\|\s*week|programme\s+point\s*weeks/i,
  steering:
    /power\s+steering|EPAS|EPS\b|hydraulic\s+steering|steering\s+rack|mechanical\s+steering|electric\s+power\s+assist/i,
};

const hits = Object.fromEntries(Object.keys(queries).map((k) => [k, []]));

function relPath(file) {
  return file
    .replace(/\\/g, "/")
    .replace(/^.*\/Developing\/GTA Portal\//, "")
    .replace(/^.*\/Desktop\//, "Desktop/");
}

async function consider(file, text, source) {
  if (!text || text.length < 20) return;
  for (const [k, re] of Object.entries(queries)) {
    if (re.test(text) || re.test(path.basename(file))) {
      const m = text.match(re);
      const idx = m ? text.toLowerCase().indexOf(m[0].toLowerCase()) : 0;
      const sn = text
        .slice(Math.max(0, idx - 60), idx + 140)
        .replace(/\s+/g, " ")
        .trim();
      hits[k].push({
        file: relPath(file),
        source,
        snippet: sn.slice(0, 200),
      });
    }
  }
}

let scanned = 0;
for (const f of files) {
  if (/node_modules|\.git/.test(f)) continue;
  const e = path.extname(f).toLowerCase();
  let text = "";
  try {
    if (e === ".docx") text = docxText(fs.readFileSync(f));
    else if (e === ".pdf") text = await pdfText(fs.readFileSync(f));
    else if (e === ".txt" || e === ".csv") text = fs.readFileSync(f, "utf8");
    else continue;
  } catch {
    continue;
  }
  scanned++;
  await consider(f, text, e);
}

const summary = {};
for (const [k, arr] of Object.entries(hits)) {
  const seen = new Set();
  const uniq = [];
  for (const h of arr) {
    if (seen.has(h.file)) continue;
    seen.add(h.file);
    uniq.push(h);
  }
  summary[k] = { count: uniq.length, samples: uniq.slice(0, 20) };
}

const out = path.resolve(
  "tests/artifacts/autocare-v1/evidence-enriched/staging/phase2a/corpus-content-search.json",
);
fs.writeFileSync(out, JSON.stringify({ scannedFiles: scanned, summary }, null, 2));
console.log(
  JSON.stringify(
    Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, v.count])),
    null,
    2,
  ),
);
for (const k of [
  "task1or2",
  "cea",
  "jobcard",
  "observation",
  "tyreStrip",
  "tyreRepairPrac",
  "isolation",
  "stock",
]) {
  console.log("\n##", k, summary[k].count);
  for (const s of summary[k].samples.slice(0, 10)) {
    console.log("-", s.file, "|", s.snippet);
  }
}
