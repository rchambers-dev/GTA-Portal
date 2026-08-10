/**
 * Staging evidence catalogue for Autocare live curriculum packs.
 * Does NOT mutate programme truth / Golden A.
 *
 * Usage: node scripts/catalogue-live-curriculum.mjs
 */
import { createHash } from "crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { unzipSync, strFromU8 } from "./lib/tiny-inflate-zip.mjs";

const require = createRequire(import.meta.url);
let PDFParseCtor = null;
try {
  PDFParseCtor = require("pdf-parse").PDFParse;
} catch {
  PDFParseCtor = null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DESK =
  process.env.AUTOCARE_DESKTOP ||
  "C:\\Users\\ReissChambers\\OneDrive - Doncaster GTA\\Desktop";
const LIVE = path.join(ROOT, ".tmp-live");
const OUT = path.join(
  ROOT,
  "tests",
  "artifacts",
  "autocare-v1",
  "evidence-enriched",
  "staging",
);

const GROUP_ROUTING = {
  G1: { title: "Foundation Skills", D: [1], S: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
  G2: { title: "Electric and Hybrid Awareness", D: [4, 9], S: [2, 6, 7, 10] },
  G3: { title: "Wheels and Tyres", D: [2, 3], S: [4, 7, 8, 9, 10] },
  G4: { title: "Basic Braking", D: [2, 3], S: [5, 7, 8, 10] },
  G5: { title: "Basic Steering and Suspension", D: [4, 5], S: [2, 7, 8, 9, 10] },
  G6: { title: "Cooling, Lubrication, and Filters", D: [3, 5], S: [7, 8, 10] },
  G7: { title: "Starting and Charging Systems", D: [2, 5, 6], S: [7, 8, 9, 10] },
  G8: { title: "Customer Service and Sales", D: [2, 3, 7, 8], S: [4, 5, 6, 9, 10] },
  G9: { title: "Stock Management", D: [3, 8], S: [2, 4, 5, 6, 7, 9, 10] },
  G10: { title: "Advanced Braking", D: [5, 6, 7, 8], S: [2, 3, 10] },
  G11: {
    title: "Advanced Steering and Suspension",
    D: [4, 5, 7, 8, 9],
    S: [2, 10],
  },
  G12: { title: "Exhaust and Emissions", D: [5, 6, 7, 9], S: [3, 8, 10] },
  G13: { title: "Air Conditioning", D: [6, 10], S: [7, 8, 9] },
  G14: {
    title: "Vehicle Inspection",
    D: [2, 3, 5, 7, 8, 10],
    S: [4, 6, 9],
  },
};

const BLOCK_TITLES = {
  1: "Motor Vehicle Foundation Skills - Shared Controlled Programme",
  2: "Vehicle Inspection, Servicing and Customer Interaction",
  3: "Workshop Processes, Tools and Environmental Awareness",
  4: "Emerging Technology and Driveline Systems",
  5: "Diagnostic Thinking and Complex Repair Activities",
  6: "Vehicle Systems Integration and Advanced Diagnostics",
  7: "Advanced Workshop Practice and Technical Communication",
  8: "Advanced Diagnostics and Workshop Organisation",
  9: "Emerging Technologies, Electric Vehicles and Hydrogen Awareness",
  10: "Final Consolidation, Corrective Learning and EPA Readiness Training",
};

function sha256File(filePath) {
  const h = createHash("sha256");
  h.update(readFileSync(filePath));
  return h.digest("hex");
}

function walkFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCharCode(parseInt(n, 16)),
    );
}

function extractDocxText(buf) {
  const zip = unzipSync(buf);
  const xml = zip["word/document.xml"];
  if (!xml) return { status: "FAILED", text: "", reason: "No word/document.xml" };
  let raw = strFromU8(xml);
  raw = raw.replace(/<\/w:p>/g, "\n").replace(/<w:tab[^/]*\/>/g, "\t");
  const text = decodeXmlEntities(raw.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { status: "EXTRACTED", text, reason: null };
}

function extractPptxText(buf) {
  const zip = unzipSync(buf);
  const slides = Object.keys(zip)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/i)?.[1] || 0);
      const nb = Number(b.match(/slide(\d+)/i)?.[1] || 0);
      return na - nb;
    });
  if (!slides.length)
    return { status: "FAILED", text: "", reason: "No pptx slides" };
  const parts = [];
  for (const s of slides) {
    let raw = strFromU8(zip[s]);
    raw = raw.replace(/<\/a:p>/g, "\n");
    const t = decodeXmlEntities(raw.replace(/<[^>]+>/g, " "))
      .replace(/[ \t]+/g, " ")
      .trim();
    if (t) parts.push(t);
  }
  return { status: "EXTRACTED", text: parts.join("\n\n"), reason: null };
}

async function extractPdfText(buf) {
  if (!PDFParseCtor) {
    return {
      status: "CONTENT_EXTRACTION_REQUIRED",
      text: "",
      reason: "pdf-parse not available in node_modules",
    };
  }
  try {
    const doc = new PDFParseCtor({ data: buf });
    const result = await doc.getText();
    const pages = result?.pages || [];
    const text = pages
      .map((p) => p.text || "")
      .join("\n\n")
      .replace(/\s+\n/g, "\n")
      .trim();
    if (text.length < 40) {
      return {
        status: "PARTIAL_OR_FAILED",
        text,
        reason: "PDFParse returned sparse text",
      };
    }
    return { status: "EXTRACTED", text, reason: null };
  } catch (err) {
    return {
      status: "FAILED",
      text: "",
      reason: String(err?.message || err),
    };
  }
}

async function extractContent(filePath, ext) {
  const e = ext.toLowerCase();
  try {
    const buf = readFileSync(filePath);
    if (e === ".docx") return extractDocxText(buf);
    if (e === ".pptx" || e === ".pptm") return extractPptxText(buf);
    if (e === ".pdf") return await extractPdfText(buf);
    if (e === ".ppt" || e === ".doc")
      return {
        status: "CONTENT_EXTRACTION_REQUIRED",
        text: "",
        reason: `Legacy binary ${e} not extracted in this stage`,
      };
    if (e === ".mp4")
      return {
        status: "NOT_INSPECTED",
        text: "",
        reason: "Video catalogued only; content not transcribed",
      };
    if (e === ".txt" || e === ".csv")
      return {
        status: "EXTRACTED",
        text: buf.toString("utf8"),
        reason: null,
      };
    return {
      status: "UNSUPPORTED",
      text: "",
      reason: `No extractor for ${e}`,
    };
  } catch (err) {
    return { status: "FAILED", text: "", reason: String(err?.message || err) };
  }
}

function parseGroupFromPath(rel) {
  const m = rel.match(/G0?(\d+)\s+([^/\\]+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return {
    groupCode: `G${n}`,
    groupFolder: `G${String(n).padStart(2, "0")} ${m[2].trim()}`,
    groupNumber: n,
  };
}

function detectEvidenceRole({ pack, filename, era, ext }) {
  const f = filename.toLowerCase();
  if (pack === "transition_guide") return "routing_crosswalk";
  if (pack === "sow_v4_4") return "intent_sequence";
  if (pack === "skills_progress_reviews") return "supporting_reflection";
  if (pack === "learning_impact_records") return "supporting_reflection";
  if (pack === "mv13_tracking") return "supporting_progression";
  if (pack === "practical_tasks_3_4") return "practical_application";
  if (pack === "lesson_plans_v4_4") return "intent_sequence";
  if (/assessment|marking|answers/.test(f)) return "assessment";
  if (/assignment|task sheet|questions/.test(f)) return "assessment";
  if (/lesson plan|session \d|plan \d|session\s+\d/.test(f))
    return era === "GROUP" ? "group_era_lesson_plan" : "intent_sequence";
  if (/\.(ppt|pptx|pptm)$/i.test(ext) || /handout|guide/.test(f))
    return "teaching_content";
  if (/\.mp4$/i.test(ext)) return "teaching_content";
  return "unknown";
}

function parseBlockWeekFromLessonName(name) {
  // Foundation_Skills_FS01_Week_1_Lesson_Plan_v1.2.docx
  let m = name.match(/FS0?(\d+).*Week[_\s]?(\d+)/i);
  if (m)
    return {
      blockNumber: 1,
      week: Number(m[2]),
      sessionCode: `FS${String(m[1]).padStart(2, "0")}`,
      planType: "Shared Foundation Skills",
    };
  m = name.match(/Week[_\s]?(\d+)(?:_Session_([AB]))?_Lesson_Plan/i);
  if (m) {
    const week = Number(m[1]);
    // Use index ranges
    let blockNumber = null;
    if (week <= 10) blockNumber = 1;
    else if (week <= 20) blockNumber = 2;
    else if (week <= 30) blockNumber = 3;
    else if (week <= 40) blockNumber = 4;
    else if (week <= 50) blockNumber = 5;
    else if (week <= 60) blockNumber = 6;
    else if (week <= 70) blockNumber = 7;
    else if (week <= 80) blockNumber = 8;
    else if (week <= 94) blockNumber = 9;
    else blockNumber = 10;
    return {
      blockNumber,
      week,
      sessionCode: m[2] ? `W${week}${m[2]}` : `W${week}`,
      planType: week <= 10 ? "Shared Foundation Skills" : "Specialist",
    };
  }
  return null;
}

function parsePracticalMeta(name) {
  const m = name.match(/Block_(\d+)_Task_(\d+)_(.+)_v/i);
  if (!m) return null;
  return {
    blockNumber: Number(m[1]),
    taskNumber: Number(m[2]),
    taskSlug: m[3].replace(/_/g, " "),
  };
}

function ksbHits(text) {
  const t = text || "";
  const codes = new Set();
  for (const m of t.matchAll(/\b([KSB]\d{1,2})\b/g)) codes.add(m[1].toUpperCase());
  return [...codes].sort();
}

function snippet(text, max = 900) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function keywordScore(text, keywords) {
  const t = (text || "").toLowerCase();
  let score = 0;
  const hits = [];
  for (const k of keywords) {
    if (t.includes(k.toLowerCase())) {
      score += 1;
      hits.push(k);
    }
  }
  return { score, hits };
}

function pushRel(rels, edge) {
  rels.push({
    id: `rel_${rels.length + 1}`,
    ...edge,
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(path.join(OUT, "extracts"), { recursive: true });

  const resources = [];
  const relationships = [];
  const corpusFindings = [];
  const extractionByExt = {};

  function addResource(rec) {
    resources.push(rec);
    const ext = rec.fileType || "";
    extractionByExt[ext] ||= {
      total: 0,
      EXTRACTED: 0,
      CONTENT_EXTRACTION_REQUIRED: 0,
      NOT_INSPECTED: 0,
      PARTIAL_OR_FAILED: 0,
      FAILED: 0,
      UNSUPPORTED: 0,
    };
    extractionByExt[ext].total += 1;
    const st = rec.extractionStatus || "UNSUPPORTED";
    if (extractionByExt[ext][st] != null) extractionByExt[ext][st] += 1;
    else extractionByExt[ext].UNSUPPORTED += 1;
  }

  // --- Learning Materials (Group-era mixed) ---
  const lmRoot = path.join(
    DESK,
    "Autocare Learning Materials",
    "ACS L2 Lesson plans and resources",
  );
  for (const filePath of walkFiles(lmRoot)) {
    const rel = path.relative(lmRoot, filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filename);
    const group = parseGroupFromPath(rel.replace(/\\/g, "/"));
    const hash = sha256File(filePath);
    const extracted = await extractContent(filePath, ext);
    const era = "GROUP";
    const role = detectEvidenceRole({
      pack: "learning_materials",
      filename,
      era,
      ext,
    });
    const id = `res_lm_${hash.slice(0, 12)}_${resources.length}`;
    const rec = {
      id,
      sourceFilename: filename,
      originalPath: filePath,
      relativePath: rel,
      fileType: ext.toLowerCase(),
      contentHashSha256: hash,
      sourcePack: "learning_materials",
      documentVersion: null,
      curriculumEra: era,
      groupAssociation: group
        ? {
            groupCode: group.groupCode,
            groupFolder: group.groupFolder,
            basis: "EXPLICIT",
            note: "From folder path under ACS L2 Lesson plans and resources",
          }
        : null,
      blockAssociationExplicit: null,
      weekSessionExplicit: null,
      evidenceRole: role,
      provenance: {
        packLabel: "Autocare Learning Materials.zip / ACS L2 Lesson plans and resources",
        ingestedAt: new Date().toISOString(),
      },
      extractionStatus: extracted.status,
      extractionReason: extracted.reason,
      excerpt: snippet(extracted.text, 700),
      extractedKsbMentions: ksbHits(extracted.text),
      duplicateStatus: "UNKNOWN",
      contentEquivalentGroupId: null,
      confidence: group ? "HIGH" : "MEDIUM",
      humanReviewRequired: extracted.status !== "EXTRACTED",
      warnings: [],
    };
    if (group?.groupCode === "G1" || /G01 Foundation/i.test(rel))
      rec.warnings.push("G01 folder expected empty or scarce");
    if (/G09 Stock/i.test(rel))
      rec.warnings.push('Folder labelled "Stock (Now not needed)"');
    addResource(rec);
    if (extracted.text && extracted.status === "EXTRACTED") {
      writeFileSync(
        path.join(OUT, "extracts", `${id}.txt`),
        extracted.text.slice(0, 200_000),
        "utf8",
      );
    }
    if (group) {
      pushRel(relationships, {
        type: "resource_belongs_to_group",
        from: id,
        to: group.groupCode,
        basis: "EXPLICIT",
        confidence: "HIGH",
        evidenceRole: "provenance",
        note: group.groupFolder,
      });
      const route = GROUP_ROUTING[group.groupCode];
      if (route) {
        for (const b of route.D) {
          pushRel(relationships, {
            type: "group_routes_to_block",
            from: group.groupCode,
            to: `B${b}`,
            basis: "EXPLICIT",
            confidence: "HIGH",
            evidenceRole: "routing_crosswalk",
            alignment: "direct",
            note: "From Transition Guide matrix/§5 — routing only, not teaching proof",
            viaResource: id,
          });
        }
        for (const b of route.S) {
          pushRel(relationships, {
            type: "group_routes_to_block",
            from: group.groupCode,
            to: `B${b}`,
            basis: "EXPLICIT",
            confidence: "HIGH",
            evidenceRole: "routing_crosswalk",
            alignment: "supporting",
            note: "From Transition Guide — supporting/reinforcement routing only",
            viaResource: id,
          });
        }
      }
    }
  }

  // Empty group folder findings
  for (const g of ["G01 Foundation Skills", "G09 Stock (Now not needed)"]) {
    const p = path.join(lmRoot, g);
    const files = existsSync(p) ? walkFiles(p) : [];
    corpusFindings.push({
      finding:
        g.startsWith("G01")
          ? "G01 Foundation Skills folder is empty in Learning Materials"
          : 'G09 is empty and labelled "Stock (Now not needed)"',
      path: p,
      fileCount: files.length,
      assuranceImplication:
        "Corpus structure itself reduces evidence visibility; do not invent materials",
    });
  }

  // --- Block lesson plans ---
  const lpDir = path.join(LIVE, "lp");
  for (const filePath of walkFiles(lpDir)) {
    const filename = path.basename(filePath);
    // Flattened names used __ separators — recover readable relative
    const flat = filename;
    const ext = path.extname(filename);
    if (!/\.(docx|txt|csv)$/i.test(ext)) continue;
    const hash = sha256File(filePath);
    const extracted = await extractContent(filePath, ext);
    const meta = parseBlockWeekFromLessonName(filename);
    // Also parse from extracted text Week / block lines
    let blockFromText = null;
    let weekFromText = null;
    let focusKsbs = [];
    if (extracted.text) {
      const bm = extracted.text.match(/Week\s+(\d+)\s*\|\s*Block\s+(\d+)/i);
      if (bm) {
        weekFromText = Number(bm[1]);
        blockFromText = Number(bm[2]);
      }
      const fm = extracted.text.match(/Duty\s*\/\s*KSB focus[\s\S]{0,120}?((?:[KSB]\d{1,2}(?:,\s*)?)+)/i);
      if (fm) focusKsbs = ksbHits(fm[1]);
      else {
        // broader: first KSB list near "KSB focus"
        const idx = extracted.text.search(/KSB focus/i);
        if (idx >= 0) focusKsbs = ksbHits(extracted.text.slice(idx, idx + 200));
      }
    }
    const blockNumber = blockFromText || meta?.blockNumber || null;
    const week = weekFromText || meta?.week || null;
    const id = `res_lp_${hash.slice(0, 12)}`;
    const rec = {
      id,
      sourceFilename: filename.replace(/__/g, "/"),
      originalPath: filePath,
      relativePath: flat,
      fileType: ext.toLowerCase(),
      contentHashSha256: hash,
      sourcePack: "lesson_plans_v4_4",
      documentVersion: /v4\.4/i.test(filename)
        ? "v4.4"
        : /v1\.2/i.test(filename)
          ? "FS v1.2"
          : null,
      curriculumEra: "BLOCK",
      groupAssociation: null,
      blockAssociationExplicit: blockNumber
        ? {
            blockNumber,
            blockTitle: BLOCK_TITLES[blockNumber] || null,
            basis: "EXPLICIT",
            note: blockFromText
              ? "Stated in lesson plan body"
              : "Derived from controlled filename/week ranges in pack index",
          }
        : null,
      weekSessionExplicit: week
        ? {
            week,
            sessionCode: meta?.sessionCode || `W${week}`,
            planType: meta?.planType || null,
            basis: "EXPLICIT",
          }
        : null,
      evidenceRole: "intent_sequence",
      provenance: {
        packLabel: "Autocare_L2_Lesson_Plans_v4.4.zip",
        controlledSource: "Autocare Technician Level 2 SOW v4.4",
      },
      extractionStatus: extracted.status,
      extractionReason: extracted.reason,
      excerpt: snippet(extracted.text, 700),
      extractedKsbMentions: ksbHits(extracted.text),
      lessonPlanKsbFocus: focusKsbs,
      ksbFocusInterpretation:
        "INTENT only — not automatic Primary ownership / Golden A",
      duplicateStatus: "UNKNOWN",
      contentEquivalentGroupId: null,
      confidence: blockNumber && week ? "HIGH" : "MEDIUM",
      humanReviewRequired: false,
      warnings: [],
    };
    addResource(rec);
    if (extracted.text && extracted.status === "EXTRACTED") {
      writeFileSync(
        path.join(OUT, "extracts", `${id}.txt`),
        extracted.text.slice(0, 200_000),
        "utf8",
      );
    }
    if (blockNumber) {
      pushRel(relationships, {
        type: "lesson_belongs_to_block",
        from: id,
        to: `B${blockNumber}`,
        basis: "EXPLICIT",
        confidence: "HIGH",
        evidenceRole: "intent_sequence",
        week,
      });
    }
    for (const code of focusKsbs) {
      pushRel(relationships, {
        type: "lesson_ksb_focus_intent",
        from: id,
        to: code,
        basis: "EXPLICIT",
        confidence: "HIGH",
        evidenceRole: "intent_sequence",
        note: "Lesson-plan KSB focus list = intent, NOT Primary ownership",
      });
    }
  }

  // --- Practicals ---
  for (const filePath of walkFiles(path.join(LIVE, "prac"))) {
    const filename = path.basename(filePath);
    if (filename.startsWith("README")) {
      // still catalogue
    }
    const ext = path.extname(filename);
    const hash = sha256File(filePath);
    const extracted = await extractContent(filePath, ext);
    const meta = parsePracticalMeta(filename);
    const id = `res_prac_${hash.slice(0, 12)}`;
    const rec = {
      id,
      sourceFilename: filename,
      originalPath: filePath,
      relativePath: filename,
      fileType: ext.toLowerCase(),
      contentHashSha256: hash,
      sourcePack: "practical_tasks_3_4",
      documentVersion: "v2.0",
      curriculumEra: "BLOCK",
      groupAssociation: null,
      blockAssociationExplicit: meta
        ? {
            blockNumber: meta.blockNumber,
            blockTitle: BLOCK_TITLES[meta.blockNumber],
            basis: "EXPLICIT",
            note: "Filename Block_N_Task_M",
          }
        : null,
      weekSessionExplicit: null,
      evidenceRole: /README/i.test(filename)
        ? "index"
        : "practical_application",
      provenance: {
        packLabel:
          "Autocare_L2_Practical_Task_PDFs_Blocks_1_to_10_Tasks_3_and_4_v2.0.zip",
      },
      extractionStatus: extracted.status,
      extractionReason: extracted.reason,
      excerpt: snippet(extracted.text, 700),
      extractedKsbMentions: ksbHits(extracted.text),
      practicalMeta: meta,
      duplicateStatus: "UNKNOWN",
      confidence: meta ? "HIGH" : "MEDIUM",
      humanReviewRequired: !meta,
      warnings: meta
        ? []
        : [/README/i.test(filename) ? [] : ["Could not parse practical meta"]].flat(),
    };
    if (meta && (meta.taskNumber === 3 || meta.taskNumber === 4)) {
      // ok
    }
    addResource(rec);
    if (extracted.text)
      writeFileSync(
        path.join(OUT, "extracts", `${id}.txt`),
        extracted.text.slice(0, 120_000),
        "utf8",
      );
    if (meta) {
      pushRel(relationships, {
        type: "practical_belongs_to_block",
        from: id,
        to: `B${meta.blockNumber}`,
        basis: "EXPLICIT",
        confidence: "HIGH",
        evidenceRole: "practical_application",
        taskNumber: meta.taskNumber,
      });
    }
  }
  corpusFindings.push({
    finding: "Practical pack contains Tasks 3 and 4 only (no Tasks 1–2)",
    assuranceImplication:
      "Application evidence incomplete for full Block assessment chain",
  });

  // --- Skills progress / impact ---
  for (const [subdir, pack, role] of [
    ["spr", "skills_progress_reviews", "supporting_reflection"],
    ["lir", "learning_impact_records", "supporting_reflection"],
  ]) {
    for (const filePath of walkFiles(path.join(LIVE, subdir))) {
      const filename = path.basename(filePath);
      const ext = path.extname(filename);
      const hash = sha256File(filePath);
      const extracted = await extractContent(filePath, ext);
      const bm = filename.match(/Block_(\d+)/i);
      const blockNumber = bm ? Number(bm[1]) : null;
      const id = `res_${pack.slice(0, 3)}_${hash.slice(0, 12)}`;
      addResource({
        id,
        sourceFilename: filename,
        originalPath: filePath,
        relativePath: filename,
        fileType: ext.toLowerCase(),
        contentHashSha256: hash,
        sourcePack: pack,
        documentVersion: /v2\.1/i.test(filename)
          ? "v2.1"
          : /v2\.0/i.test(filename)
            ? "v2.0"
            : null,
        curriculumEra: "BLOCK",
        groupAssociation: null,
        blockAssociationExplicit: blockNumber
          ? {
              blockNumber,
              blockTitle: BLOCK_TITLES[blockNumber],
              basis: "EXPLICIT",
            }
          : null,
        weekSessionExplicit: null,
        evidenceRole: /README/i.test(filename) ? "index" : role,
        provenance: { packLabel: pack },
        extractionStatus: extracted.status,
        extractionReason: extracted.reason,
        excerpt: snippet(extracted.text, 500),
        extractedKsbMentions: ksbHits(extracted.text),
        duplicateStatus: "UNKNOWN",
        confidence: blockNumber ? "HIGH" : "MEDIUM",
        humanReviewRequired: false,
        warnings: [
          "Supporting reflection only — does not prove KSB taught/assessed",
        ],
      });
      if (blockNumber) {
        pushRel(relationships, {
          type: "supporting_belongs_to_block",
          from: id,
          to: `B${blockNumber}`,
          basis: "EXPLICIT",
          confidence: "HIGH",
          evidenceRole: role,
        });
      }
    }
  }

  // --- Controlled docs ---
  for (const [file, pack, era, role] of [
    [
      path.join(LIVE, "guide.docx"),
      "transition_guide",
      "SHARED",
      "routing_crosswalk",
    ],
    [path.join(LIVE, "sow.docx"), "sow_v4_4", "BLOCK", "intent_sequence"],
    [
      path.join(LIVE, "mv13.docx"),
      "mv13_tracking",
      "SHARED",
      "supporting_progression",
    ],
  ]) {
    if (!existsSync(file)) continue;
    const filename = path.basename(file);
    const hash = sha256File(file);
    const extracted = await extractContent(file, ".docx");
    const id = `res_${pack}_${hash.slice(0, 12)}`;
    const mv13IsTracking =
      pack === "mv13_tracking" &&
      /track|progress|personal|hours|otj|review/i.test(extracted.text);
    addResource({
      id,
      sourceFilename: filename,
      originalPath: file,
      relativePath: filename,
      fileType: ".docx",
      contentHashSha256: hash,
      sourcePack: pack,
      documentVersion:
        pack === "transition_guide"
          ? "v1.1"
          : pack === "sow_v4_4"
            ? "v4.4"
            : "v1.8",
      curriculumEra: era,
      groupAssociation: null,
      blockAssociationExplicit: null,
      weekSessionExplicit: null,
      evidenceRole: role,
      provenance: { packLabel: pack, desktopSource: true },
      extractionStatus: extracted.status,
      extractionReason: extracted.reason,
      excerpt: snippet(extracted.text, 900),
      extractedKsbMentions: ksbHits(extracted.text),
      duplicateStatus: "UNKNOWN",
      confidence: "HIGH",
      humanReviewRequired: pack === "mv13_tracking" && !mv13IsTracking,
      warnings:
        pack === "transition_guide"
          ? ["ROUTING evidence only — not proof that a KSB is taught"]
          : pack === "mv13_tracking"
            ? [
                mv13IsTracking
                  ? "Included as SUPPORTING learner/progression evidence"
                  : "Role uncertain from extract — review",
              ]
            : [],
      mv13RoleConfirmed: pack === "mv13_tracking" ? mv13IsTracking : undefined,
    });
    if (extracted.text)
      writeFileSync(
        path.join(OUT, "extracts", `${id}.txt`),
        extracted.text.slice(0, 250_000),
        "utf8",
      );
  }

  // --- Duplicate / content-equivalent by hash ---
  const byHash = new Map();
  for (const r of resources) {
    if (!byHash.has(r.contentHashSha256)) byHash.set(r.contentHashSha256, []);
    byHash.get(r.contentHashSha256).push(r.id);
  }
  let equivGroups = 0;
  for (const [hash, ids] of byHash) {
    if (ids.length < 2) continue;
    equivGroups += 1;
    const gid = `ceq_${hash.slice(0, 10)}`;
    for (const id of ids) {
      const r = resources.find((x) => x.id === id);
      r.duplicateStatus = "CONTENT_EQUIVALENT";
      r.contentEquivalentGroupId = gid;
      r.humanReviewRequired = true;
      r.warnings.push(
        `Same bytes as ${ids.filter((x) => x !== id).join(", ")} — one asset, multiple placements`,
      );
    }
    pushRel(relationships, {
      type: "content_equivalent",
      from: ids[0],
      to: ids.slice(1),
      basis: "EXPLICIT",
      confidence: "HIGH",
      evidenceRole: "integrity",
      contentHashSha256: hash,
      note: "Byte-identical files",
    });
  }
  // Same filename different hash
  const byName = new Map();
  for (const r of resources) {
    const k = r.sourceFilename.toLowerCase();
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(r);
  }
  const sameNameDiffHash = [];
  for (const [name, list] of byName) {
    const hashes = new Set(list.map((r) => r.contentHashSha256));
    if (list.length > 1 && hashes.size > 1) {
      sameNameDiffHash.push({
        filename: name,
        count: list.length,
        hashes: [...hashes],
        sizes: list.map((r) => {
          try {
            return statSync(r.originalPath).size;
          } catch {
            return null;
          }
        }),
        groups: list.map((r) => r.groupAssociation?.groupCode || r.sourcePack),
        ids: list.map((r) => r.id),
        note: "Same filename, different SHA-256 — treat as POSSIBLE_VARIANT / conflicting placement until content extract proves equivalence",
      });
      for (const r of list) {
        if (r.duplicateStatus === "UNKNOWN")
          r.duplicateStatus = "SAME_NAME_DIFFERENT_HASH";
        r.humanReviewRequired = true;
        r.warnings.push(
          "Same filename appears elsewhere with different content hash (not byte-identical)",
        );
      }
    }
  }

  // Filename twin across groups without being able to hash-compare if already done
  corpusFindings.push({
    finding: "Group-era and Block-era lesson plans are separate generations",
    assuranceImplication: "Do not merge as one session structure",
  });
  corpusFindings.push({
    finding: "Tasks 1–2 absent; CEAs/job cards referenced by guide not in supplied packs",
    assuranceImplication: "Material evidence layer missing for some judgements",
  });

  // --- Inferred resource→week for sample themes only (stored as inference) ---
  const themeDefs = {
    tyres: {
      label: "TYRES / WHEELS",
      keywords: [
        "tyre",
        "tire",
        "tpms",
        "wheel balance",
        "balancing",
        "puncture",
        "sidewall",
        "run-flat",
        "run flat",
        "strip",
        "wheel assembly",
      ],
      groups: ["G3"],
      focusKsb: ["S9", "K6"],
    },
    brakes: {
      label: "BRAKING",
      keywords: [
        "brake",
        "braking",
        "abs",
        "disc",
        "pad",
        "caliper",
        "drum",
        "hydraulic",
        "stability control",
        "wheel speed",
      ],
      groups: ["G4", "G10"],
      focusKsb: ["K12", "S5", "S16"],
    },
    ev: {
      label: "EV / HYBRID",
      keywords: [
        "hybrid",
        "high voltage",
        "hv ",
        "electric vehicle",
        "ev/",
        "ev ",
        "fuel cell",
        "charging",
        "isolation",
        "hydrogen",
        "range extender",
      ],
      groups: ["G2", "G7"],
      focusKsb: ["K21", "K23", "S13", "K22"],
    },
  };

  for (const [themeKey, theme] of Object.entries(themeDefs)) {
    for (const r of resources) {
      if (r.sourcePack !== "learning_materials") continue;
      const hay = `${r.sourceFilename} ${r.excerpt || ""}`;
      const { score, hits } = keywordScore(hay, theme.keywords);
      if (score < 2 && !theme.groups.includes(r.groupAssociation?.groupCode))
        continue;
      if (score < 1 && theme.groups.includes(r.groupAssociation?.groupCode)) {
        // still weak theme member by group provenance
      } else if (score < 1) continue;

      // Infer candidate blocks from routing of group, NOT week
      const g = r.groupAssociation?.groupCode;
      const route = g && GROUP_ROUTING[g];
      if (route) {
        for (const b of route.D) {
          pushRel(relationships, {
            type: "resource_candidate_block",
            from: r.id,
            to: `B${b}`,
            basis: "INFERRED_MEDIUM",
            confidence: "MEDIUM",
            evidenceRole: "routing_plus_theme",
            theme: themeKey,
            note: "Group routing (direct) + theme keyword overlap — NOT resource→week join",
            keywordHits: hits,
          });
        }
      }

      // Infer possible weeks by comparing keywords to lesson-plan extracts
      const lessonCandidates = resources.filter(
        (lp) =>
          lp.sourcePack === "lesson_plans_v4_4" &&
          lp.fileType === ".docx" &&
          lp.blockAssociationExplicit,
      );
      const scored = [];
      for (const lp of lessonCandidates) {
        const ks = keywordScore(
          `${lp.sourceFilename} ${lp.excerpt || ""}`,
          theme.keywords,
        );
        if (ks.score >= 2) {
          scored.push({
            lp,
            score: ks.score,
            hits: ks.hits,
          });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      for (const c of scored.slice(0, 3)) {
        pushRel(relationships, {
          type: "resource_inferred_lesson_week",
          from: r.id,
          to: c.lp.id,
          basis: score >= 3 ? "INFERRED_MEDIUM" : "INFERRED_LOW",
          confidence: score >= 3 ? "MEDIUM" : "LOW",
          evidenceRole: "content_similarity",
          theme: themeKey,
          week: c.lp.weekSessionExplicit?.week ?? null,
          block: c.lp.blockAssociationExplicit?.blockNumber ?? null,
          note: "Independent of Group→Block routing; review required before Golden B",
          keywordHits: c.hits,
          humanReviewRequired: true,
        });
        r.humanReviewRequired = true;
      }
    }
  }

  // Relationship basis counts
  const basisCounts = {};
  for (const rel of relationships) {
    basisCounts[rel.basis] = (basisCounts[rel.basis] || 0) + 1;
  }

  // ========== SAMPLE CHAINS ==========
  function resourcesForTheme(themeKey) {
    const theme = themeDefs[themeKey];
    return resources.filter((r) => {
      if (r.sourcePack === "learning_materials") {
        if (theme.groups.includes(r.groupAssociation?.groupCode)) return true;
        return keywordScore(`${r.sourceFilename} ${r.excerpt}`, theme.keywords)
          .score >= 2;
      }
      if (r.sourcePack === "lesson_plans_v4_4") {
        return (
          keywordScore(`${r.sourceFilename} ${r.excerpt}`, theme.keywords)
            .score >= 2 ||
          theme.focusKsb.some((k) => (r.lessonPlanKsbFocus || []).includes(k))
        );
      }
      if (r.sourcePack === "practical_tasks_3_4") {
        return (
          keywordScore(`${r.sourceFilename} ${r.excerpt}`, theme.keywords)
            .score >= 1
        );
      }
      if (
        r.sourcePack === "skills_progress_reviews" ||
        r.sourcePack === "learning_impact_records"
      ) {
        // include block-aligned supporting for candidate blocks via routing
        const bn = r.blockAssociationExplicit?.blockNumber;
        if (!bn) return false;
        // include if any theme group routes D to this block
        return theme.groups.some((g) => GROUP_ROUTING[g]?.D.includes(bn));
      }
      return false;
    });
  }

  const OFFICIAL = {
    S9: "Remove, repair and replace vehicle tyre and balance wheel assemblies on car, car derived van or light goods vehicle. For example, ultra-low profile, directional, asymmetric, run-flat tyres.",
    K6: "Tyres: legislation, replacement, repair, and technical information including EU tyre labelling, tyre pressure monitoring systems (TPMS), sidewall markings, homologated fitments relating to cars, car derived vans and light goods vehicles.",
    K12: "Braking systems: purpose, function, and location of systems and components for inspection, removal and replacement: brake discs, brake pads, brake shoes, brake drum, hydraulic components, anti-lock braking systems, electronic stability programmes, brake pedal simulator, brake pipe and hoses, wheel bearings.",
    K21: "Electric and hybrid vehicles: service, charging and safety procedures relevant to Autocare technician role.",
    K23: "High voltage vehicle systems: safe working / isolation expectations relevant to Autocare technician role.",
    S13: "Isolate high voltage electric vehicle systems for maintenance (practical).",
  };

  const GOLDEN_A = {
    S9: {
      status: "REVIEWED_CURRICULUM_GAP",
      primaryBlock: null,
      note: "No Primary-eligible strip/remove/replace/balance practical on SOW-visible evidence. W64 tyre/TPMS inspection; W14 TPMS-only; W106 late consolidation.",
      proposedAmendmentBlock: 7,
    },
    K6: {
      status: "APPROVED_PRIMARY",
      primaryBlock: 1,
      note: "Golden A Primary on B1 (human-verified batch)",
    },
    K12: {
      status: "APPROVED_PRIMARY",
      primaryBlock: 2,
      note: "Advanced Brake Diagnostics strongest primary; B3 wear checks = reinforcement",
    },
    K21: {
      status: "APPROVED_PRIMARY",
      primaryBlock: 6,
      note: "First dedicated EV service/charging/safety; B9 reinforcement",
    },
    K23: {
      status: "APPROVED_PRIMARY",
      primaryBlock: 6,
      note: "HV safe working/isolation; B9 reinforces",
    },
    S13: {
      status: "APPROVED_PRIMARY",
      primaryBlock: 6,
      note: "EV isolation practical home; B9 reinforcement",
    },
  };

  function buildChain(themeKey) {
    const theme = themeDefs[themeKey];
    const themeResources = resourcesForTheme(themeKey);
    const teaching = themeResources.filter((r) =>
      ["teaching_content", "group_era_lesson_plan", "assessment"].includes(
        r.evidenceRole,
      ),
    );
    const lessons = themeResources.filter(
      (r) => r.sourcePack === "lesson_plans_v4_4" && r.fileType === ".docx",
    );
    const practicals = themeResources.filter(
      (r) => r.sourcePack === "practical_tasks_3_4" && r.fileType === ".pdf",
    );
    const supporting = themeResources.filter((r) =>
      ["skills_progress_reviews", "learning_impact_records"].includes(
        r.sourcePack,
      ),
    );
    const inferredWeekRels = relationships.filter(
      (r) => r.type === "resource_inferred_lesson_week" && r.theme === themeKey,
    );

    const extractionBlocked = teaching.filter((r) =>
      ["CONTENT_EXTRACTION_REQUIRED", "NOT_INSPECTED", "FAILED"].includes(
        r.extractionStatus,
      ),
    );

    return {
      theme: theme.label,
      themeKey,
      officialKsbs: theme.focusKsb.map((code) => ({
        code,
        officialRequirement: OFFICIAL[code] || null,
        goldenA: GOLDEN_A[code] || {
          status: "SEE_GOLDEN_LABELS",
          note: "Not in focus map detail",
        },
        inferredTeachingRequirements: inferRequirements(code),
      })),
      groups: theme.groups.map((g) => ({
        group: g,
        title: GROUP_ROUTING[g].title,
        routingDirectBlocks: GROUP_ROUTING[g].D,
        routingSupportingBlocks: GROUP_ROUTING[g].S,
        folderFileCount: resources.filter(
          (r) => r.groupAssociation?.groupCode === g,
        ).length,
        basis: "EXPLICIT",
      })),
      blockEraLessons: lessons.map((r) => ({
        id: r.id,
        file: r.sourceFilename,
        block: r.blockAssociationExplicit?.blockNumber,
        week: r.weekSessionExplicit?.week,
        ksbFocusIntent: r.lessonPlanKsbFocus || [],
        extractionStatus: r.extractionStatus,
        excerpt: r.excerpt,
        basis: "EXPLICIT",
      })),
      teachingResources: teaching.map((r) => ({
        id: r.id,
        file: r.sourceFilename,
        group: r.groupAssociation?.groupCode || null,
        role: r.evidenceRole,
        extractionStatus: r.extractionStatus,
        duplicateStatus: r.duplicateStatus,
        contentEquivalentGroupId: r.contentEquivalentGroupId,
        excerpt: r.excerpt,
        humanReviewRequired: r.humanReviewRequired,
      })),
      practicals: practicals.map((r) => ({
        id: r.id,
        file: r.sourceFilename,
        block: r.blockAssociationExplicit?.blockNumber,
        task: r.practicalMeta?.taskNumber,
        extractionStatus: r.extractionStatus,
        excerpt: r.excerpt,
        basis: "EXPLICIT",
      })),
      supporting: supporting.map((r) => ({
        id: r.id,
        file: r.sourceFilename,
        pack: r.sourcePack,
        block: r.blockAssociationExplicit?.blockNumber,
        note: "Supporting only",
      })),
      inferredResourceToWeekEdges: inferredWeekRels.slice(0, 40),
      extractionBlocked: extractionBlocked.map((r) => r.sourceFilename),
      shadowConclusion: null, // filled below
    };
  }

  function inferRequirements(code) {
    if (code === "S9")
      return [
        "Demonstrate remove/replace of vehicle tyre on appropriate class of vehicle",
        "Repair tyre where appropriate and authorised",
        "Balance wheel assemblies after tyre work",
        "Handle example tyre types (e.g. ULP, directional, asymmetric, run-flat) at least to awareness/practical standard required by role",
        "Use technical information / safe workshop process during tyre service",
      ];
    if (code === "K6")
      return [
        "Teach tyre legislation and serviceability rules",
        "Teach replacement/repair technical information",
        "TPMS purpose and handling implications",
        "Sidewall markings / labelling / homologated fitments",
      ];
    if (code === "K12")
      return [
        "Purpose/function/location of brake system components listed in official KSB",
        "Inspection, removal and replacement teaching for core brake components",
        "Include ABS/ESP awareness as required by statement",
      ];
    if (code === "K21" || code === "K23" || code === "S13")
      return [
        "EV/hybrid service and charging awareness appropriate to Autocare role",
        "HV hazards and safe working / isolation boundaries",
        "Practical isolation/maintenance boundary for S13 where applicable",
        "Distinguish awareness teaching from authorised HV work",
      ];
    return ["Interpret official wording into teachable concepts/actions"];
  }

  const tyres = buildChain("tyres");
  // Deep S9 shadow
  const tyreTeachingExtracted = tyres.teachingResources.filter((t) => {
    const full = resources.find((r) => r.id === t.id);
    return full && full.extractionStatus === "EXTRACTED";
  });
  const tyreBinary = tyres.teachingResources.filter((t) =>
    t.extractionStatus === "CONTENT_EXTRACTION_REQUIRED",
  );
  const s9Signals = {
    removeReplaceBalanceFilenameSignals: tyres.teachingResources
      .filter((t) => /chang|balanc|repair|inspection|tyre|tire|wheel/i.test(t.file))
      .map((t) => ({
        file: t.file,
        group: t.group,
        extractionStatus: t.extractionStatus,
      })),
    practicalSignals: tyres.practicals.map((p) => ({
      file: p.file,
      block: p.block,
      task: p.task,
      suggestsStripBalance: /tyre|tire|tpms|balance|strip/i.test(
        `${p.file} ${p.excerpt}`,
      ),
      excerpt: p.excerpt,
    })),
    sowVisibleGoldenAClaim:
      "Golden A: no Primary-eligible strip/remove/replace/balance practical in SOW-level evidence",
  };

  tyres.shadowConclusion = {
    ksb: "S9",
    analysisOnly: true,
    goldenAUnchanged: true,
    goldenA: GOLDEN_A.S9,
    whatGoldenACouldSee:
      "SOW/lesson-plan intent around TPMS/inspection/integration (W14/W64/W106 notes) without a defensible strip/remove/replace/balance Primary practical in the SOW-visible corpus. K6 (tyre knowledge) already has Golden A Primary on B1 — knowledge≠skill completion for S9.",
    whatRicherCorpusAppearsToShow: {
      groupTeachingAssets: s9Signals.removeReplaceBalanceFilenameSignals,
      binaryPptRequiringExtraction: tyreBinary.map((t) => t.file),
      extractedDocs: tyreTeachingExtracted.map((t) => t.file),
      blockPracticals: s9Signals.practicalSignals,
      routing: "G3 → B2/B3 direct; later Blocks supporting",
    },
    componentsEvidence: {
      remove_replace:
        "FILENAME/TITLE evidence in Group G3 materials (e.g. Tire Changing and Wheel Balancing.ppt) but legacy PPT not content-extracted — CONTENT_EXTRACTION_REQUIRED; Block Task 4 B2 is TPMS/tyre pressure/service documentation oriented — not proven strip/balance from extract confidence",
      repair:
        "Tyre Inspection and Repair.ppt present (binary) — content not proven until extracted",
      balance:
        "Filename claims wheel balancing; not proven from extracted literal content yet",
      special_tyre_types:
        "Not verified from extracted text in this stage",
    },
    likelyBlockOwnershipShadow: {
      candidates: [
        {
          block: 2,
          role: "strong candidate for inspection/TPMS/customer tyre service",
          basis: "INFERRED_MEDIUM",
        },
        {
          block: 3,
          role: "workshop process / tooling / housekeeping adjacency via G3 routing",
          basis: "INFERRED_LOW",
        },
        {
          block: 7,
          role: "Golden A proposed-amendment host only (advisory) — not treated as truth",
          basis: "EXPLICIT_FROM_GOLDEN_A_ADVISORY",
        },
      ],
      note: "Do not assign Primary from this shadow analysis",
    },
    wouldRicherEvidenceJustifyReconsideringGoldenA:
      "POTENTIALLY YES for S9 gap→Primary reconsideration — IF binary PPT content plus an actual strip/balance practical/assessment can be verified. NOT justified yet: B2 Task 4 extracted text proves TPMS/pressure/condition documentation (narrows visibility) but does not close full S9. Changing/balancing decks remain CONTENT_EXTRACTION_REQUIRED.",
    confidence: "MEDIUM for presence of related teaching assets; LOW for full official S9 coverage; NO persistence",
    remainingUnproven: [
      "Literal PPT teaching content for remove/repair/replace/balance",
      "Learner practical that explicitly requires strip/balance (Tasks 1–2 missing; Task 4 B2 appears TPMS/pressure oriented)",
      "Assessment/marking that signs off S9 breadth including special tyre types",
      "Explicit resource→Block-week joins",
    ],
  };

  const brakes = buildChain("brakes");
  brakes.shadowConclusion = {
    theme: "BRAKING",
    analysisOnly: true,
    goldenAUnchanged: true,
    structuralAnchor: GOLDEN_A.K12,
    progressionTest: {
      basicGroup: "G4 Basic Braking",
      advancedGroup: "G10 Advanced Braking",
      risk: "Advanced ABS/ESC teaching (G10) must not be mistaken as first substantive ownership if basic inspection/replacement is earlier — Golden A already placed K12 Primary at B2 with B3 wear as reinforcement; richer corpus must test whether B2 still holds once G4/G10 materials and Block Tasks are content-reviewed",
    },
    duplicateResourceTest: {
      example: "Wheel Speed Sensors.ppt appears under G04 and G10",
      meaning:
        "SAME filename, DIFFERENT SHA-256 (~6.04MB vs ~5.99MB) — treat as POSSIBLE_VARIANT + dual placement, not proven identical asset. Ownership inference must use content extract + sequence, not folder/title alone",
      basis: "CONFLICTING",
    },
    practicals: brakes.practicals.map((p) => `${p.file} (B${p.block} T${p.task})`),
    extractionBlocked: brakes.extractionBlocked,
    shadowCoverage:
      "Likely strong multi-layer braking curriculum across Groups/Blocks; Primary ownership still Golden A B2 for K12 until Golden B human review",
    confidence: "MEDIUM",
  };

  const ev = buildChain("ev");
  const evDupes = sameNameDiffHash.filter((d) =>
    /hybrid|fuel cell|range extender|high voltage/i.test(d.filename),
  );
  ev.shadowConclusion = {
    theme: "EV / HYBRID",
    analysisOnly: true,
    goldenAUnchanged: true,
    structuralAnchors: {
      K21: GOLDEN_A.K21,
      K23: GOLDEN_A.K23,
      S13: GOLDEN_A.S13,
    },
    groupPlacementConflict: {
      issue:
        "Same-named EV awareness PPTs under G02 and G07 with DIFFERENT hashes (near-size variants) — not byte-identical",
      duplicates: evDupes,
      routingConflict:
        "Guide routes G2→B4/B9 direct; G7→B2/B5/B6 direct. Dual placement creates CONFLICTING provenance for Block candidacy until content+delivery context reviewed.",
      basis: "CONFLICTING",
    },
    b4vsB9: {
      note: "Guide and Golden A both treat earlier EV service/safety (B6 Primaries K21/K23/S13) with B9 as specialist reinforcement/emerging tech — sample must not collapse awareness decks into B9 Primary automatically",
    },
    awarenessVsSubstantive: {
      risk: "G2 materials titled Features of Hybrid Vehicles / Fuel Cells / Safety in HV may be awareness-level; S13 isolation practical still needs explicit practical evidence (B4 Task 4 EV component location / B9 handover are not automatically S13)",
    },
    practicals: ev.practicals.map((p) => `${p.file} (B${p.block} T${p.task})`),
    confidence: "MEDIUM for conflict detection; LOW for full KSB sufficiency",
  };

  const summary = {
    generatedAt: new Date().toISOString(),
    stagingOnly: true,
    mutatesProgrammeTruth: false,
    goldenAFrozen: {
      approvedPrimaries: 45,
      reviewedGaps: 18,
      distributed: 1,
      unresolved: 0,
      structuredOtj: 611.5,
    },
    catalogue: {
      resourceCount: resources.length,
      relationshipCount: relationships.length,
      byPack: Object.fromEntries(
        [...resources.reduce((m, r) => m.set(r.sourcePack, (m.get(r.sourcePack) || 0) + 1), new Map())],
      ),
      byEra: Object.fromEntries(
        [...resources.reduce((m, r) => m.set(r.curriculumEra, (m.get(r.curriculumEra) || 0) + 1), new Map())],
      ),
      byEvidenceRole: Object.fromEntries(
        [...resources.reduce((m, r) => m.set(r.evidenceRole, (m.get(r.evidenceRole) || 0) + 1), new Map())],
      ),
      extractionByExt,
      contentEquivalentGroups: equivGroups,
      sameNameDifferentHash: sameNameDiffHash,
      basisCounts,
      humanReviewRequiredCount: resources.filter((r) => r.humanReviewRequired)
        .length,
    },
    corpusFindings,
    sampleChains: { tyres, brakes, ev },
  };

  writeFileSync(
    path.join(OUT, "catalogue-resources.json"),
    JSON.stringify(resources, null, 2),
    "utf8",
  );
  writeFileSync(
    path.join(OUT, "catalogue-relationships.json"),
    JSON.stringify(relationships, null, 2),
    "utf8",
  );
  writeFileSync(
    path.join(OUT, "catalogue-summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );
  writeFileSync(
    path.join(OUT, "sample-chains.json"),
    JSON.stringify({ tyres, brakes, ev }, null, 2),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        out: OUT,
        resources: resources.length,
        relationships: relationships.length,
        basisCounts,
        extractionByExt,
        equivGroups,
        tyresTeaching: tyres.teachingResources.length,
        brakesTeaching: brakes.teachingResources.length,
        evTeaching: ev.teachingResources.length,
        s9WouldReconsider:
          tyres.shadowConclusion.wouldRicherEvidenceJustifyReconsideringGoldenA,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
