/**
 * Catalogue Autocare Gateway / GW1-GW2 practice & practical support materials.
 * Staging only — does not mutate Golden A / ratified pilot / programme truth.
 */
import { createHash } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  copyFileSync,
} from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { unzipSync, strFromU8 } from "./lib/tiny-inflate-zip.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const INGEST = path.join(
  ROOT,
  "tests/artifacts/autocare-v1/evidence-enriched/staging/gateway-ingest",
);
const OUT = path.join(
  ROOT,
  "tests/artifacts/autocare-v1/evidence-enriched/staging/gateway-catalogue",
);

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
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
  if (text.length < 40)
    return { status: "PARTIAL_OR_FAILED", text, reason: "Sparse text" };
  return { status: "EXTRACTED", text, reason: null };
}

function walkFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

function sha256File(p) {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function classify(filename, text) {
  const f = filename.toLowerCase();
  const t = text.toLowerCase();
  const labels = [];

  const isAssessor = /assessor/i.test(filename) || /assessor version|marking|answer|criteria|guidance for assessor/i.test(text);
  const isApprentice =
    /apprentice/i.test(filename) ||
    (/practice (paper|exam)/i.test(filename) && !isAssessor);

  if (/practice paper|practice exam|multiple choice|mcq|knowledge check|written paper/i.test(f + " " + t.slice(0, 2000))) {
    if (/practical/i.test(f) && /support material/i.test(f)) {
      // fall through to practical
    } else if (!/practical support/i.test(f)) {
      labels.push("knowledge_assessment");
      labels.push("Gateway_readiness");
      if (/practice|mock|preparation/i.test(f + t.slice(0, 1500)))
        labels.push("EPA_preparation_practice");
    }
  }

  if (/practical support/i.test(f) || (/practical/i.test(f) && /support material/i.test(f))) {
    labels.push("practical_assessment");
    labels.push("Gateway_readiness");
    if (isApprentice || /apprentice/i.test(f)) labels.push("apprentice_instructions");
    if (isAssessor || /assessor/i.test(f)) {
      labels.push("assessor_instructions");
      if (/mark|criteria|pass|refer|guidance/i.test(t.slice(0, 4000)))
        labels.push("assessor_criteria_marking_guidance");
    }
  }

  if (/gw1|gateway 1|gateway one/i.test(f + t.slice(0, 2500))) labels.push("GW1");
  if (/gw2|gateway 2|gateway two/i.test(f + t.slice(0, 2500))) labels.push("GW2");

  // Content override: "EPA" in title of other packs already handled elsewhere
  if (/end.?point assessment|epa readiness|mock epa/i.test(t.slice(0, 3000))) {
    labels.push("EPA_preparation_practice");
  }

  if (!labels.length) labels.push("other");

  // Deduplicate preserve order
  return [...new Set(labels)];
}

function findKsbSignals(text, filename) {
  const explicit = [
    ...new Set(
      [...text.matchAll(/\b([KS])\s*[- ]?\s*(\d{1,2})\b/gi)].map(
        (m) => `${m[1].toUpperCase()}${m[2]}`,
      ),
    ),
  ];
  const topics = {
    S9: /tyre|tire|wheel balanc|puncture|run.?flat|tpms|dismount|bead/i,
    K10: /steer|pas\b|power steering|eps\b|epas|track rod|rack and pinion/i,
    K12: /brake|abs\b|pads?\b|discs?\b|drums?\b|caliper/i,
    K21: /hybrid|electric vehicle|\bev\b|charging/i,
    K23: /high voltage|hv safety|safe working|ppe.*hv|orange cable/i,
    S13: /isolat(?:e|ion)|service plug|locked off|proven dead|not live/i,
    K6: /legal|mot\b|construction and use|tyre (law|legislation)/i,
    K8: /customer|handover|communication/i,
    S10: /inspection|vehicle check/i,
  };
  const inferred = [];
  const blob = filename + "\n" + text;
  for (const [ksb, re] of Object.entries(topics)) {
    if (re.test(blob)) inferred.push(ksb);
  }
  return { explicitKsbReferences: explicit, inferredTopicKsbs: inferred };
}

function extractHighlights(text) {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const title = lines.slice(0, 8).join(" | ").slice(0, 300);
  const duration = text.match(/(\d+)\s*(?:minutes|mins|hours)/i)?.[0] || null;
  const sections = [];
  for (const re of [
    /task\s*\d+/gi,
    /section\s*\d+/gi,
    /activity\s*\d+/gi,
    /scenario/gi,
  ]) {
    const ms = text.match(re);
    if (ms) sections.push(...ms.slice(0, 12));
  }
  return {
    openingSnippet: title,
    durationMention: duration,
    sectionLabels: [...new Set(sections)].slice(0, 30),
    mentionsIsolation: /isolat/i.test(text),
    mentionsTyreBalance: /balanc/i.test(text) && /tyre|tire|wheel/i.test(text),
    mentionsTyreRemove: /remove.{0,40}(tyre|tire)|(tyre|tire).{0,40}(remove|replace|refit|fit)/i.test(
      text,
    ),
    mentionsSteer: /steer/i.test(text),
    mentionsEps: /\beps\b|\bepas\b|electric power assist/i.test(text),
    mentionsHydraulicPas: /hydraulic.{0,20}steer|power steering pump|steering rack/i.test(
      text,
    ),
    mentionsHv: /high voltage|\bhv\b|hybrid|electric vehicle/i.test(text),
    mentionsPassRefer: /pass|refer|competent|not yet competent/i.test(text),
    mentionsMarkScheme: /mark scheme|marking guidance|assessor guidance|model answer|answers?/i.test(
      text,
    ),
    questionCountHint:
      (text.match(/\bQ(?:uestion)?\s*\d+/gi) || []).length ||
      (text.match(/^\s*\d+[\).\s]/gim) || []).length,
    charCount: text.length,
  };
}

function pairKey(filename) {
  const f = filename
    .replace(/\s*\(\d+\)/g, "")
    .replace(/-Assessor/i, "")
    .replace(/-Apprentice/i, "")
    .replace(/Assessor/i, "")
    .replace(/Apprentice/i, "")
    .replace(/\.docx$/i, "")
    .trim()
    .toLowerCase();
  if (/gw1.*practical support|practical support.*gw1/i.test(filename))
    return "gw1_practical_support";
  if (/gw2.*practical support|practical support.*gw2/i.test(filename))
    return "gw2_practical_support";
  if (/gw1 practice paper/i.test(filename)) return "gw1_knowledge_practice";
  if (/gw2 practice exam/i.test(filename)) return "gw2_knowledge_practice";
  return f;
}

function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(path.join(OUT, "extracts"), { recursive: true });

  const files = walkFiles(INGEST).filter((f) => /\.docx$/i.test(f));
  const resources = [];

  for (const file of files) {
    const filename = path.basename(file);
    const buf = readFileSync(file);
    const extracted = extractDocxText(buf);
    const text = extracted.text || "";
    const labels = classify(filename, text);
    const ksbs = findKsbSignals(text, filename);
    const highlights = text ? extractHighlights(text) : {};
    const extractName = filename.replace(/[^\w.\- ()]+/g, "_") + ".txt";
    if (extracted.status === "EXTRACTED") {
      writeFileSync(path.join(OUT, "extracts", extractName), text, "utf8");
    }

    const role =
      /assessor/i.test(filename)
        ? "ASSESSOR"
        : /apprentice/i.test(filename)
          ? "APPRENTICE"
          : /practice (paper|exam)/i.test(filename)
            ? "APPRENTICE_OR_SHARED_PAPER"
            : "UNKNOWN";

    resources.push({
      id: `gw_${sha256File(file).slice(0, 12)}`,
      filename,
      relativePath: path.relative(INGEST, file).replace(/\\/g, "/"),
      source: {
        zipOrPath:
          file.includes("onedrive_zip")
            ? "Downloads/OneDrive_1_10-08-2026.zip"
            : `Downloads/${filename}`,
      },
      sha256: sha256File(file),
      bytes: statSync(file).size,
      fileType: ".docx",
      extractionStatus: extracted.status,
      extractionReason: extracted.reason,
      documentLabels: labels,
      audienceRole: role,
      pairKey: pairKey(filename),
      gatewayStage: labels.includes("GW2")
        ? "GW2"
        : labels.includes("GW1")
          ? "GW1"
          : /gw2/i.test(filename)
            ? "GW2"
            : /gw1/i.test(filename)
              ? "GW1"
              : "UNKNOWN",
      ...ksbs,
      highlights,
      relationshipAxes: {
        TEACHES: false,
        PRACTISES: labels.includes("practical_assessment"),
        ASSESSES:
          labels.includes("knowledge_assessment") ||
          labels.includes("practical_assessment"),
        RECORDS_EVIDENCE: /record|checklist|observation|sign.?off/i.test(text),
        GATEWAY_READINESS: labels.includes("Gateway_readiness"),
        EPA_PREP: labels.includes("EPA_preparation_practice"),
      },
      chainPlacement: {
        officialStandard: "INFERRED_CONTEXT_ST0499",
        duty: "UNKNOWN",
        ksb: ksbs.explicitKsbReferences.length
          ? "EXPLICIT_PARTIAL"
          : ksbs.inferredTopicKsbs.length
            ? "INFERRED_TOPIC"
            : "UNKNOWN",
        group: "NOT_ESTABLISHED",
        block: "NOT_ESTABLISHED",
        weekSession: "NOT_ESTABLISHED",
        teachingMaterial: "NOT_THIS_LAYER",
        practice: labels.includes("practical_assessment")
          ? "THIS_LAYER"
          : "NOT_THIS_LAYER",
        ceaPracticalAssessment: "RELATED_BUT_DISTINCT_FROM_GROUP_CEA",
        knowledgeAssessment: labels.includes("knowledge_assessment")
          ? "THIS_LAYER"
          : "NOT_THIS_LAYER",
        workplaceApplication: "NOT_THIS_LAYER",
        gatewayReadiness: "THIS_LAYER",
        epa: labels.includes("EPA_preparation_practice")
          ? "PREPARATION_ONLY_NOT_LIVE_EPA"
          : "NOT_LIVE_EPA",
      },
      textPreview: text.slice(0, 1200),
    });
  }

  // Link apprentice ↔ assessor pairs
  const byPair = {};
  for (const r of resources) {
    byPair[r.pairKey] = byPair[r.pairKey] || [];
    byPair[r.pairKey].push(r.id);
  }
  const pairs = [];
  for (const [key, ids] of Object.entries(byPair)) {
    const members = resources.filter((r) => ids.includes(r.id));
    const apprentice = members.filter((m) =>
      /APPRENTICE/.test(m.audienceRole),
    );
    const assessor = members.filter((m) => m.audienceRole === "ASSESSOR");
    if (apprentice.length && assessor.length) {
      for (const a of apprentice) {
        for (const b of assessor) {
          pairs.push({
            pairKey: key,
            apprenticeResourceId: a.id,
            assessorResourceId: b.id,
            apprenticeFile: a.filename,
            assessorFile: b.filename,
            gatewayStage: a.gatewayStage || b.gatewayStage,
            relationship: "APPRENTICE_ASSESSOR_PAIR",
            confidence: "EXPLICIT_FILENAME_PAIRING",
          });
          a.pairedWith = b.id;
          b.pairedWith = a.id;
        }
      }
    } else {
      pairs.push({
        pairKey: key,
        members: members.map((m) => ({
          id: m.id,
          filename: m.filename,
          role: m.audienceRole,
        })),
        relationship: "NO_ASSESSOR_PAIR_IN_PACK",
        confidence: "N_A",
      });
    }
  }

  // Pilot delta signals
  const allText = resources.map((r) => r.textPreview + "\n" /* full via extracts */).join("\n");
  const fullTexts = {};
  for (const r of resources) {
    const p = path.join(OUT, "extracts", r.filename.replace(/[^\w.\- ()]+/g, "_") + ".txt");
    try {
      fullTexts[r.id] = readFileSync(p, "utf8");
    } catch {
      fullTexts[r.id] = "";
    }
  }
  const corpus = Object.values(fullTexts).join("\n\n");

  const pilotDelta = {
    status: "SHADOW_DELTA_ONLY",
    mutatesRatifiedPilot: false,
    KSBs: {},
  };

  function delta(ksb, oldPos, signals, effect) {
    pilotDelta.KSBs[ksb] = {
      oldEvidencePosition: oldPos,
      newEvidenceSignals: signals,
      effectOnTeaching: effect.teaching,
      effectOnPractice: effect.practice,
      effectOnAssessment: effect.assessment,
      effectOnOwnership: effect.ownership,
      humanReReviewWarranted: effect.reReview,
      notes: effect.notes,
    };
  }

  delta(
    "S9",
    "CEA 3.x already closed assessed tyre strip/balance artefact gap; practice/assessment strengthened",
    {
      tyreRemove: /tyre|tire/.test(corpus) && /remove|replace|refit|fit/i.test(corpus),
      balance: /balanc/i.test(corpus),
      puncture: /puncture|repair/i.test(corpus),
      gwMentions: resources
        .filter((r) => /tyre|tire|wheel|balanc/i.test(fullTexts[r.id] || ""))
        .map((r) => r.filename),
    },
    {
      teaching: "NO_MATERIAL_CHANGE",
      practice: "POSSIBLE_STRENGTHEN_IF_GW_PRACTICAL_INCLUDES_TYRE_TASKS",
      assessment: "POSSIBLE_STRENGTHEN_VIA_GW_KNOWLEDGE_AND_OR_PRACTICAL",
      ownership: "NO_CHANGE",
      reReview: false,
      notes: "Gateway adds readiness/assessment layer; Primary ownership still not forced. Determine from extracts whether GW practicals actually include strip/balance or only related inspection/service.",
    },
  );

  delta(
    "K10",
    "CEA 5.x hydraulic/mechanical R&R; EPS not in CEA; ownership ambiguous",
    {
      steering: /steer/i.test(corpus),
      eps: /\beps\b|\bepas\b|electric power assist/i.test(corpus),
      hydraulic: /power steering|hydraulic/i.test(corpus),
      files: resources
        .filter((r) => /steer|eps|epas|alignment/i.test(fullTexts[r.id] || ""))
        .map((r) => r.filename),
    },
    {
      teaching: "NO_MATERIAL_CHANGE",
      practice: "CHECK_EXTRACTS",
      assessment: "CHECK_EXTRACTS",
      ownership: "UNLIKELY_TO_RESOLVE_PRIMARY",
      reReview: false,
      notes: "Look specifically for EPS/EPAS in GW materials; Gateway unlikely to assign Block Primary.",
    },
  );

  delta(
    "K12",
    "KEEP B2 control — rich progression already",
    {
      brakes: /brake|abs/i.test(corpus),
      files: resources
        .filter((r) => /brake|abs/i.test(fullTexts[r.id] || ""))
        .map((r) => r.filename),
    },
    {
      teaching: "NO_MATERIAL_CHANGE",
      practice: "SUPPORTING_ONLY",
      assessment: "SUPPORTING_ONLY",
      ownership: "NO_CHANGE_KEEP",
      reReview: false,
      notes: "Control case — expect reinforcement/readiness only.",
    },
  );

  delta(
    "K21",
    "KEEP B6 — EV service/safety",
    {
      ev: /hybrid|electric|charging/i.test(corpus),
      files: resources
        .filter((r) => /hybrid|electric|charging/i.test(fullTexts[r.id] || ""))
        .map((r) => r.filename),
    },
    {
      teaching: "NO_MATERIAL_CHANGE",
      practice: "CHECK",
      assessment: "CHECK",
      ownership: "NO_CHANGE_KEEP",
      reReview: false,
      notes: "Control — awareness vs service assessment distinction remains.",
    },
  );

  delta(
    "K23",
    "KEEP B6 — rules taught; practice/assessment PARTIAL; CEA 2.1 strengthened",
    {
      hvSafety: /high voltage|hv |safe working/i.test(corpus),
      files: resources
        .filter((r) => /high voltage|\bhv\b|safe working/i.test(fullTexts[r.id] || ""))
        .map((r) => r.filename),
    },
    {
      teaching: "NO_MATERIAL_CHANGE",
      practice: "CHECK",
      assessment: "CHECK",
      ownership: "NO_CHANGE",
      reReview: false,
      notes: "Gateway may add assessment moments for HV safe working.",
    },
  );

  delta(
    "S13",
    "CEA 2.1 template requires isolation; completed competence still open; REVIEW",
    {
      isolation: /isolat/i.test(corpus),
      files: resources
        .filter((r) => /isolat/i.test(fullTexts[r.id] || ""))
        .map((r) => r.filename),
    },
    {
      teaching: "NO_MATERIAL_CHANGE",
      practice: "CHECK_FOR_PERFORMED_ISOLATION",
      assessment: "CHECK_FOR_ASSESSED_ISOLATION",
      ownership: "NO_CHANGE",
      reReview: false,
      notes: "Strict: hybrid/GW activity ≠ isolation competence unless isolate/perform/verify assessed.",
    },
  );

  writeFileSync(path.join(OUT, "gateway-resources.json"), JSON.stringify(resources, null, 2));
  writeFileSync(path.join(OUT, "gateway-pairs.json"), JSON.stringify(pairs, null, 2));
  writeFileSync(path.join(OUT, "gateway-pilot-delta-draft.json"), JSON.stringify(pilotDelta, null, 2));

  console.log(
    JSON.stringify(
      {
        files: resources.length,
        extracted: resources.filter((r) => r.extractionStatus === "EXTRACTED").length,
        pairs: pairs.filter((p) => p.relationship === "APPRENTICE_ASSESSOR_PAIR").length,
        labels: Object.fromEntries(
          resources.map((r) => [r.filename, r.documentLabels]),
        ),
      },
      null,
      2,
    ),
  );
}

main();
