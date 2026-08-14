/**
 * Read-only: compare Desktop v1.0 Block 2 lesson-plan binaries vs catalogue v4.4 extracts.
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const DESKTOP =
  "C:/Users/Reiss/Desktop/Portal Questions/AutoCare L2/Autocare_L2_Lesson_Plans/Autocare_L2_Lesson_Plans_v1.0/02_Specialist_Lesson_Plans";
const EXTRACTS =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/extracts";

const ROWS = [
  {
    week: 11,
    key: "W011",
    topic: "Customer Service Scenarios",
    id: "res_lp_16fe848ac370",
    v10: "Autocare_L2_Week_011_Lesson_Plan_v1.0.docx",
  },
  {
    week: 12,
    key: "W012",
    topic: "Electrical System Inspection",
    id: "res_lp_5063b02fbaa2",
    v10: "Autocare_L2_Week_012_Lesson_Plan_v1.0.docx",
  },
  {
    week: 13,
    key: "W013",
    topic: "Engine Repairs",
    id: "res_lp_d2ee9a236d4b",
    v10: "Autocare_L2_Week_013_Lesson_Plan_v1.0.docx",
  },
  {
    week: 14,
    key: "W014",
    topic: "Tyre Pressure Monitoring Systems",
    id: "res_lp_5ad392e7e654",
    v10: "Autocare_L2_Week_014_Lesson_Plan_v1.0.docx",
  },
  {
    week: 15,
    key: "W015",
    topic: "Supplier Liaison",
    id: "res_lp_05b8c7ba4d4b",
    v10: "Autocare_L2_Week_015_Lesson_Plan_v1.0.docx",
  },
  {
    week: 16,
    key: "W016",
    topic: "Intake plus Inspection",
    id: "res_lp_1eb8b1588375",
    v10: "Autocare_L2_Week_016_Lesson_Plan_v1.0.docx",
  },
  {
    week: 17,
    key: "W017",
    topic: "Advanced Brake Diagnostics",
    id: "res_lp_d2ad96acd09a",
    v10: "Autocare_L2_Week_017_Lesson_Plan_v1.0.docx",
  },
  {
    week: 18,
    key: "W018",
    topic: "Wheel Alignment - Advanced",
    id: "res_lp_b4a5050fe271",
    v10: "Autocare_L2_Week_018_Lesson_Plan_v1.0.docx",
  },
  {
    week: 19,
    key: "W019",
    topic: "Stock Auditing",
    id: "res_lp_f1e9599b61ba",
    v10: "Autocare_L2_Week_019_Lesson_Plan_v1.0.docx",
  },
  {
    week: 20,
    key: "W020",
    topic: "Customer Dispute Resolution",
    id: "res_lp_8b012bfa9807",
    v10: "Autocare_L2_Week_020_Lesson_Plan_v1.0.docx",
  },
];

function unzipDocxText(docxPath) {
  const tmp = path.resolve(
    ".tmp/lp-cmp",
    path.basename(docxPath, ".docx"),
  );
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  execFileSync("tar", ["-xf", docxPath, "-C", tmp], { stdio: "pipe" });
  const xmlPath = path.join(tmp, "word", "document.xml");
  if (!fs.existsSync(xmlPath)) return { error: "no document.xml", text: "" };
  const xml = fs.readFileSync(xmlPath, "utf8");
  const text = xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<w:p[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { text };
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[—–-]/g, "-")
    .replace(/[^a-z0-9\s./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function has(hay, needle) {
  return Boolean(needle) && norm(hay).includes(norm(needle));
}

function pickActivity(extract) {
  const lines = extract
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (/OTJ$/i.test(lines[i]) && lines[i + 1] && lines[i + 1].length > 40) {
      hits.push(lines[i + 1]);
    }
  }
  return hits.slice(0, 4);
}

const results = [];
for (const r of ROWS) {
  const v10path = path.join(DESKTOP, r.v10);
  const extractPath = path.join(EXTRACTS, `${r.id}.txt`);
  const extract = fs.existsSync(extractPath)
    ? fs.readFileSync(extractPath, "utf8")
    : "";
  const bin = fs.existsSync(v10path);
  let v10text = "";
  let err = null;
  if (bin) {
    try {
      const out = unzipDocxText(v10path);
      v10text = out.text || "";
      err = out.error || null;
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
  }

  const v44acts = pickActivity(extract);
  const actHits = v44acts.filter((a) => has(v10text, a.slice(0, 70)));
  const checks = {
    week: has(v10text, `Week ${r.week}`) && has(extract, `Week ${r.week}`),
    block2: has(v10text, "Block 2") && has(extract, "Block 2"),
    topicV10: has(v10text, r.topic),
    topicV44: has(extract, r.topic),
    v44Label: /v4\.4/i.test(extract),
    v10HasV44Label: /v4\.4/i.test(v10text),
    aimsBoth:
      (has(v10text, "Lesson aims") || has(v10text, "intended learning")) &&
      has(extract, "Lesson aims"),
    byEndBoth: has(v10text, "By the end") && has(extract, "By the end"),
    otj55: has(v10text, "5.50") && has(extract, "5.50"),
    activityOverlap: `${actHits.length}/${v44acts.length}`,
  };

  let verdict = "CANNOT VERIFY";
  if (!bin || !extract || err) verdict = "CANNOT VERIFY";
  else if (
    checks.week &&
    checks.block2 &&
    checks.topicV10 &&
    checks.topicV44 &&
    actHits.length >= Math.min(2, v44acts.length || 2)
  ) {
    verdict = checks.v44Label && !checks.v10HasV44Label
      ? "MINOR REVISION"
      : "SAME CONTENT";
  } else if (checks.week && checks.topicV10 && checks.topicV44 && checks.aimsBoth) {
    verdict = "MINOR REVISION";
  } else if (v10text.length > 200 && extract.length > 200) {
    verdict = "MATERIAL REVISION";
  }

  results.push({
    key: r.key,
    week: r.week,
    topic: r.topic,
    verdict,
    binary: bin,
    extractChars: extract.length,
    v10chars: v10text.length,
    err,
    checks,
    sampleV10: v10text.slice(0, 180),
  });
}

fs.mkdirSync(".tmp", { recursive: true });
fs.writeFileSync(
  ".tmp/block2-lp-version-compare.json",
  JSON.stringify(results, null, 2),
);
for (const r of results) {
  console.log(
    `${r.key} ${r.verdict} week=${r.checks?.week} topic=${r.checks?.topicV10}/${r.checks?.topicV44} acts=${r.checks?.activityOverlap} v10=${r.v10chars} v44=${r.extractChars}`,
  );
}
