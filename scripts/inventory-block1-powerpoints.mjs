/**
 * READ-ONLY Block 1 PowerPoint / teaching-deck inventory.
 * Does not write to the database.
 *
 *   node --env-file=.env.local scripts/inventory-block1-powerpoints.mjs
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const STAGING = path.join(
  ROOT,
  "tests/artifacts/autocare-v1/evidence-enriched/staging",
);
const OUT_DIR = path.join(STAGING, "structure-reconciliation");
const CATALOGUE = path.join(STAGING, "catalogue-resources.json");
const PPT_EXTRACTS = path.join(STAGING, "phase2a", "ppt-extracts");
const EXTRACTS = path.join(STAGING, "extracts");
const PROGRAMME_VERSION_ID =
  process.env.AUTOCARE_PHASE1_VERSION_ID?.trim() ||
  "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";

const SESSIONS = [
  {
    key: "W001",
    fs: "FS01",
    lp: "res_lp_8f67680b4ed9",
    title: "Workshop Safety, Hazards, Housekeeping and Occupational Expectations",
    keywords: [
      "workshop safety",
      "housekeeping",
      "hazard",
      "occupational",
      "ppe",
      "safe working",
      "reporting",
      "signage",
    ],
  },
  {
    key: "W002",
    fs: "FS02",
    lp: "res_lp_a1de2dadb565",
    title: "Health and Safety, Tools, Equipment and Safe Vehicle Support",
    keywords: [
      "safe lifting",
      "vehicle support",
      "axle stand",
      "jack",
      "tools and equipment",
      "safe working load",
      "dynamic risk",
    ],
  },
  {
    key: "W003",
    fs: "FS03",
    lp: "res_lp_f7ae4503f880",
    title: "Hybrid and High-Voltage Vehicle Awareness",
    keywords: [
      "hybrid",
      "high voltage",
      "high-voltage",
      "electric vehicle",
      "orange cable",
      "hv",
      "safe approach",
    ],
  },
  {
    key: "W004",
    fs: "FS04",
    lp: "res_lp_4e5d5534a1f4",
    title: "Fire Safety, Battery Awareness and Basic Electrical Safety",
    keywords: [
      "fire safety",
      "extinguisher",
      "lead-acid",
      "battery safety",
      "electrical safety",
      "hydrogen gas",
      "short circuit",
    ],
  },
  {
    key: "W005",
    fs: "FS05",
    lp: "res_lp_f311ff09e560",
    title: "Measurement, Technical Information and Tolerances",
    keywords: [
      "tolerance",
      "micrometer",
      "vernier",
      "technical information",
      "measurement",
      "torque",
    ],
  },
  {
    key: "W006",
    fs: "FS06",
    lp: "res_lp_c67c9df7ff7b",
    title: "Fasteners, Technical Drawings, Fabrication and Safe Tool Use",
    keywords: [
      "fastener",
      "technical drawing",
      "fabrication",
      "thread",
      "bolt",
      "torque wrench",
    ],
  },
  {
    key: "W007",
    fs: "FS07",
    lp: "res_lp_7561f4aaf78a",
    title: "Multimeter Use, Electrical Measurement and Fabrication Quality",
    keywords: [
      "multimeter",
      "continuity",
      "voltage",
      "electrical measurement",
      "fabrication quality",
    ],
  },
  {
    key: "W008",
    fs: "FS08",
    lp: "res_lp_8afb61732d53",
    title: "Tools and Safety Consolidation, Basic Circuits and Relay Awareness",
    keywords: ["relay", "basic circuit", "consolidation", "series", "parallel"],
  },
  {
    key: "W009",
    fs: "FS09",
    lp: "res_lp_5792e033a5a0",
    title: "Targeted Occupational Recap, Gap Teaching and First Aid",
    keywords: ["first aid", "recap", "gap teaching", "emergency"],
  },
  {
    key: "W010",
    fs: "FS10",
    lp: "res_lp_76cd8f807cd7",
    title: "Technical Documentation, Job Cards, Handover and Specialist Transition",
    keywords: [
      "job card",
      "handover",
      "technical documentation",
      "service history",
      "customer",
    ],
  },
];

const BLOCK1_FOLDER = /G01|Foundation Skills|FS0[0-9]|FS10|Block[ _-]?1/i;
const SPECIALIST_LATER = /G0[3-9]|G1[0-4]|Wheels and Tyres|Basic Braking|Advanced Braking|Steering|Suspension|Air Condition|Cooling|Lubricat|ADAS|Customer|Servicing|Engine Management|Climate/i;
const PPT_EXT = /\.(ppt|pptx|pptm)$/i;

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function excerptOf(text, n = 420) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);
}

function readIfExists(p) {
  try {
    if (p && fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  } catch {
    /* ignore */
  }
  return "";
}

function findPptExtract(relPath, filename) {
  if (!fs.existsSync(PPT_EXTRACTS)) return { status: "NO_EXTRACT_DIR", text: "", path: null };
  const files = fs.readdirSync(PPT_EXTRACTS);
  const stem = path
    .basename(filename, path.extname(filename))
    .replace(/[^\w]+/g, "_");
  const relNorm = String(relPath || "")
    .replace(/\\/g, "_")
    .replace(/[^\w.]+/g, "_");
  const hit =
    files.find((f) => f.endsWith(".txt") && f.includes(stem) && f.includes(relNorm.slice(0, 24))) ||
    files.find((f) => f.endsWith(".txt") && f.includes(stem));
  if (!hit) return { status: "NO_PHASE2A_EXTRACT", text: "", path: null };
  const abs = path.join(PPT_EXTRACTS, hit);
  return { status: "EXTRACTED", text: readIfExists(abs), path: abs };
}

function scoreSession(blob, session, lpText) {
  const hay = blob.toLowerCase();
  const hits = session.keywords.filter((k) => hay.includes(k.toLowerCase()));
  const lpHits = session.keywords.filter((k) =>
    lpText.toLowerCase().includes(k.toLowerCase()),
  );
  return { hits, lpHits, hitCount: hits.length };
}

function loadEnvLocal() {
  const out = {};
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const catalogue = loadJson(CATALOGUE);
const ppt = catalogue.filter((r) => PPT_EXT.test(r.fileType || r.sourceFilename || ""));

const lpTexts = Object.fromEntries(
  SESSIONS.map((s) => [s.key, readIfExists(path.join(EXTRACTS, `${s.lp}.txt`))]),
);

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: dbResources, error: rErr } = await sb
  .from("gta_programme_resources")
  .select(
    "id, title, filename, evidence_resource_id, source_path, extract_path, metadata",
  )
  .eq("programme_version_id", PROGRAMME_VERSION_ID);
if (rErr) {
  console.error(rErr.message);
  process.exit(1);
}

const { data: dbAtt, error: aErr } = await sb
  .from("gta_programme_resource_attachments")
  .select("id, resource_id, session_id, role, audience, sort_order");
if (aErr) {
  console.error(aErr.message);
  process.exit(1);
}

const { data: sessions, error: sErr } = await sb
  .from("gta_programme_sessions")
  .select("id, session_key, title, foundation_skill_code, calendar_week")
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .in(
    "session_key",
    SESSIONS.map((s) => s.key),
  );
if (sErr) {
  console.error(sErr.message);
  process.exit(1);
}

const sessionByKey = Object.fromEntries((sessions || []).map((s) => [s.session_key, s]));
const resourceByEvidence = Object.fromEntries(
  (dbResources || []).map((r) => [r.evidence_resource_id, r]),
);
const attByResource = new Map();
for (const a of dbAtt || []) {
  const list = attByResource.get(a.resource_id) || [];
  list.push(a);
  attByResource.set(a.resource_id, list);
}

const inventory = ppt.map((r) => {
  const filename = r.sourceFilename || "";
  const rel = r.relativePath || "";
  const group = r.groupAssociation || null;
  const extractFile = findPptExtract(rel, filename);
  const catalogueExcerpt = r.excerpt || "";
  const body = [filename, rel, catalogueExcerpt, extractFile.text].join("\n");
  const folderLooksBlock1 = BLOCK1_FOLDER.test(rel) || BLOCK1_FOLDER.test(filename);
  const folderLooksLater = SPECIALIST_LATER.test(rel);
  const sessionScores = SESSIONS.map((s) => {
    const scored = scoreSession(body, s, lpTexts[s.key] || "");
    return {
      sessionKey: s.key,
      fs: s.fs,
      hitCount: scored.hitCount,
      hits: scored.hits,
      lpKeywordOverlap: scored.lpHits,
    };
  }).sort((a, b) => b.hitCount - a.hitCount);

  const best = sessionScores[0];
  let block1Confidence = "LOW";
  if (folderLooksBlock1 && best.hitCount >= 2) block1Confidence = "HIGH";
  else if (!folderLooksLater && best.hitCount >= 3) block1Confidence = "MEDIUM";
  else if (folderLooksLater && best.hitCount >= 4) block1Confidence = "MEDIUM";
  else if (best.hitCount >= 2) block1Confidence = "LOW";
  else block1Confidence = "UNRESOLVED";

  // G01 empty / no FS-named decks: folder G02 hybrid + FS03 keywords can be MEDIUM at inventory stage
  if (/G02 Electric Hybrid|High Voltage|Hybrid Vehicles/i.test(rel + filename)) {
    block1Confidence = best.hitCount >= 2 ? "MEDIUM" : "LOW";
  }
  if (/G01 Foundation|FS0[1-9]|FS10/i.test(rel + filename)) {
    block1Confidence = "HIGH";
  }

  const db = resourceByEvidence[r.id] || null;
  const attachments = db ? attByResource.get(db.id) || [] : [];

  return {
    catalogueId: r.id,
    filename,
    relativePath: rel,
    fileType: r.fileType,
    sourcePack: r.sourcePack,
    curriculumEra: r.curriculumEra,
    groupAssociation: group,
    extractionStatusCatalogue: r.extractionStatus,
    extractionStatusPhase2a: extractFile.status,
    extractPath: extractFile.path,
    extractChars: extractFile.text.length,
    excerpt: excerptOf(extractFile.text || catalogueExcerpt, 500),
    block1FolderSignal: folderLooksBlock1,
    laterSpecialistFolder: folderLooksLater,
    block1Confidence,
    bestSession: best,
    sessionScores: sessionScores.filter((s) => s.hitCount > 0).slice(0, 4),
    currentDbResourceId: db?.id || null,
    currentDbTitle: db?.title || null,
    currentAttachments: attachments.map((a) => ({
      sessionId: a.session_id,
      role: a.role,
      audience: a.audience,
    })),
    originalPath: r.originalPath,
    originalExists: r.originalPath ? fs.existsSync(r.originalPath) : false,
  };
});

const plausible = inventory.filter(
  (r) =>
    r.block1FolderSignal ||
    r.block1Confidence !== "UNRESOLVED" ||
    /hybrid|high.?voltage|safety|hazard|housekeep|lifting|first aid|fire|battery|multimeter|fastener|job card|workshop/i.test(
      `${r.filename} ${r.relativePath} ${r.excerpt}`,
    ),
);

const summary = {
  generatedAt: new Date().toISOString(),
  cataloguePptTotal: ppt.length,
  byExt: ppt.reduce((acc, r) => {
    const ext = (r.fileType || "").toLowerCase();
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {}),
  byCatalogueExtraction: ppt.reduce((acc, r) => {
    acc[r.extractionStatus] = (acc[r.extractionStatus] || 0) + 1;
    return acc;
  }, {}),
  g01Note:
    "G01 Foundation Skills folder was recorded empty in Learning Materials catalogue summary.",
  block1PlausibleCount: plausible.length,
  inventory,
  plausible,
  currentBlock1Attachments: (dbAtt || [])
    .map((a) => {
      const res = (dbResources || []).find((r) => r.id === a.resource_id);
      const sess = (sessions || []).find((s) => s.id === a.session_id);
      if (!sess) return null;
      return {
        sessionKey: sess.session_key,
        fs: sess.foundation_skill_code,
        resourceId: res?.id,
        evidenceId: res?.evidence_resource_id,
        filename: res?.filename,
        title: res?.title,
        role: a.role,
        audience: a.audience,
      };
    })
    .filter(Boolean),
  sessionLpExtractChars: Object.fromEntries(
    SESSIONS.map((s) => [s.key, (lpTexts[s.key] || "").length]),
  ),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, "BLOCK1-PPT-INVENTORY.json");
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log(
  JSON.stringify(
    {
      ok: true,
      outPath,
      cataloguePptTotal: ppt.length,
      plausible: plausible.length,
      currentBlock1Attachments: summary.currentBlock1Attachments.length,
      originalBinariesPresent: inventory.filter((r) => r.originalExists).length,
    },
    null,
    2,
  ),
);
