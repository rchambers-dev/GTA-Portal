/**
 * Catalogue Autocare Year 1/2 CEA packs (staging only).
 * Does NOT mutate Golden A / programme truth / ratified pilot.
 *
 * Usage: node scripts/catalogue-cea-packs.mjs
 */
import { createHash } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { unzipSync, strFromU8 } from "./lib/tiny-inflate-zip.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const INGEST = path.join(
  ROOT,
  "tests/artifacts/autocare-v1/evidence-enriched/staging/cea-ingest",
);
const OUT = path.join(
  ROOT,
  "tests/artifacts/autocare-v1/evidence-enriched/staging/cea-catalogue",
);

const GROUP_ROUTING = {
  1: { g: "G1", title: "Foundation Skills", D: [1], S: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
  2: { g: "G2", title: "Electric and Hybrid Awareness", D: [4, 9], S: [2, 6, 7, 10] },
  3: { g: "G3", title: "Wheels and Tyres", D: [2, 3], S: [4, 7, 8, 9, 10] },
  4: { g: "G4", title: "Basic Braking", D: [2, 3], S: [5, 7, 8, 10] },
  5: { g: "G5", title: "Basic Steering and Suspension", D: [4, 5], S: [2, 7, 8, 9, 10] },
  6: { g: "G6", title: "Cooling, Lubrication, and Filters", D: [3, 5], S: [7, 8, 10] },
  7: { g: "G7", title: "Starting and Charging Systems", D: [2, 5, 6], S: [7, 8, 9, 10] },
  8: { g: "G8", title: "Customer Service and Sales", D: [2, 3, 7, 8], S: [4, 5, 6, 9, 10] },
  9: { g: "G9", title: "Stock Management", D: [3, 8], S: [2, 4, 5, 6, 7, 9, 10] },
  10: { g: "G10", title: "Advanced Braking", D: [5, 6, 7, 8], S: [2, 3, 10] },
  11: { g: "G11", title: "Advanced Steering and Suspension", D: [4, 5, 7, 8, 9], S: [2, 10] },
  12: { g: "G12", title: "Exhaust and Emissions", D: [5, 6, 7, 9], S: [3, 8, 10] },
  13: { g: "G13", title: "Air Conditioning", D: [6, 10], S: [7, 8, 9] },
  14: { g: "G14", title: "Vehicle Inspection", D: [2, 3, 5, 7, 8, 10], S: [4, 6, 9] },
};

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
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function has(re, text) {
  return re.test(text);
}

function sliceAround(text, re, pad = 180) {
  const m = text.match(re);
  if (!m) return null;
  const i = m.index ?? 0;
  return text.slice(Math.max(0, i - 40), Math.min(text.length, i + pad)).replace(/\s+/g, " ");
}

function parseCeaCode(filename) {
  const m = filename.match(/CEA\s+(\d+)\.(\d+[a-z]?)/i);
  if (!m) return null;
  return { major: Number(m[1]), minor: m[2], ref: `${m[1]}.${m[2]}` };
}

function inferKsbs(filename, text) {
  const explicit = [...text.matchAll(/\b([KSBksb]{1,3})\s*(\d{1,2})\b/g)].map(
    (m) => `${m[1].toUpperCase().replace(/S$/,"")}${m[2]}`.replace(/^KSB/, "K"),
  );
  // Clean: keep K/S/B style only
  const explicitClean = [
    ...new Set(
      [...text.matchAll(/\b([KS])\s*(\d{1,2})\b/gi)].map(
        (m) => `${m[1].toUpperCase()}${m[2]}`,
      ),
    ),
  ].filter((c) => /^(K|S|B)\d+$/.test(c));

  const inferred = [];
  const t = `${filename}\n${text}`.toLowerCase();

  if (/tyre|tire|wheel|tpms|balance|puncture|run.?flat|bs159/.test(t)) {
    inferred.push("S9", "K6");
  }
  if (/steer|track rod|ball joint|power steering|strut|damper|alignment|epa practice|adas/.test(t)) {
    inferred.push("K10", "K11");
  }
  if (/brake|pad|disc|shoe|drum|abs|wheel speed|reluctor|traction control/.test(t)) {
    inferred.push("K12");
  }
  if (/hybrid|electric|hv |high voltage|isolation|isolate/.test(t)) {
    inferred.push("K21", "K23", "S13");
  }
  if (/customer|sell|parts|stock|sourcing|invoice|estimate|service schedule|service plan/.test(t)) {
    inferred.push("K8", "S5"); // soft — keep as inferred commercial
  }
  if (/exhaust|emission|oxygen|egr/.test(t)) inferred.push("K15");
  if (/air condition|condenser|compressor|expansion valve/.test(t)) inferred.push("K14");
  if (/inspection|oil service|interim service|major service/.test(t)) inferred.push("S7", "S8");
  if (/starter|alternator|battery/.test(t) && !/hv battery/.test(t)) inferred.push("K13");
  if (/radiator|waterpump|thermostat|sump|oil pump/.test(t)) inferred.push("K9");

  return {
    explicitKsbReferences: explicitClean,
    inferredKsbRelationships: [...new Set(inferred)],
  };
}

function classifyRoles(filename, text) {
  const teaches = false; // these are not teaching materials
  const practises =
    /scenario|you are required|carry out|remove and|refit|install|balance|isolate/i.test(
      text,
    );
  const assesses =
    /apprentice assessment record|result:|pass|refer|assessor signature|objectives:/i.test(
      text,
    );
  const recordsEvidence =
    /apprentice assessment record|brief description of the work|ppe worn|technical data|assessor pin/i.test(
      text,
    );
  const roles = [];
  if (teaches) roles.push("TEACHES");
  if (practises) roles.push("PRACTISES");
  if (assesses) roles.push("ASSESSES");
  if (recordsEvidence) roles.push("RECORDS_EVIDENCE");
  return roles;
}

function classifyDocType(filename, text) {
  if (/\.url$/i.test(filename)) return "EXTERNAL_LINK";
  if (/proforma.?invoice|invoice.?template/i.test(filename))
    return "COMMERCIAL_TEMPLATE";
  if (/repair estimate/i.test(filename)) return "COMMERCIAL_TEMPLATE";
  if (/service schedule generic/i.test(filename)) return "SUPPORTING_TEMPLATE";
  if (/apprentice instructions/i.test(filename) || /APPRENTICE INSTRUCTIONS/i.test(text))
    return "CONTROLLED_PRACTICAL_ASSESSMENT_TASK";
  return "OTHER";
}

function extractFields(text) {
  const titleMatch =
    text.match(/Ref:\s*([\d.]+[a-z]?)\s*\n?\s*([^\n]{5,120})/i) ||
    text.match(/EPA Task\s*\n?\s*([^\n]{5,120})/i);
  const duration = text.match(/\((\d+\s*mins?)\)/i)?.[1] || null;
  const objectives = [];
  const objBlock = text.match(/Objectives:\s*([\s\S]*?)(?:Materials you need|Scenario:)/i);
  if (objBlock) {
    objectives.push(
      ...objBlock[1]
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 15 && /^to /i.test(l)),
    );
  }
  const scenario = sliceAround(text, /Scenario:/i, 400);
  const tasks = [];
  const taskSection = text.match(
    /Complete the following tasks[\s\S]*?(?=APPRENTICE ASSESSMENT RECORD|$)/i,
  );
  if (taskSection) {
    tasks.push(
      ...taskSection[0]
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 20),
    );
  }
  const questions = [];
  const qBlock = text.match(
    /Please answer[\s\S]*?(?=Apprentice Name:|$)/i,
  );
  if (qBlock) {
    questions.push(
      ...qBlock[0]
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => /\?$/.test(l) || /^Demonstrate|^State |^Name |^Describe |^Why |^What |^How /i.test(l)),
    );
  }

  return {
    refFromBody: titleMatch?.[1] || null,
    taskTitle:
      (titleMatch && (titleMatch[2] || titleMatch[1])) ||
      null,
    duration,
    objectives: objectives.slice(0, 12),
    scenarioSnippet: scenario,
    expectedPerformanceSnippets: tasks.slice(0, 20),
    oralOrWrittenQuestions: questions.slice(0, 15),
    requiresManufacturerTechInfo: /manufacturer.?s instructions|technical information|tech data/i.test(
      text,
    ),
    requiresMeasurements:
      /torque|tread depth|pressure|voltage|balance|tolerance|run-?out|ovality|quantity/i.test(
        text,
      ),
    hasAssessorSignOff: /Assessor Signature|Assessor Pin|Result:\s*Pass|Refer/i.test(
      text,
    ),
    hasPassRefer: /Result:\s*Pass|Refer/i.test(text),
    mentionsIsolation: /isolat/i.test(text),
    mentionsBalance: /balanc/i.test(text),
    mentionsTyreRemoveInstall: /remove.{0,40}tyre|tyre.{0,40}(remove|replace|install)|R&R|R & I/i.test(
      text,
    ),
    mentionsBs159: /bs159|bs 159/i.test(text),
    mentionsRunFlat: /run.?flat/i.test(text),
    mentionsTpms: /tpms/i.test(text),
    mentionsSteering: /steer/i.test(text),
    mentionsEpsEpas: /\beps\b|\bepas\b|electric power/i.test(text),
    mentionsHydraulicPas: /hydraulic power steering|power steering pump|power steering rack/i.test(
      text,
    ),
    epaTaskLabelled: /EPA Task/i.test(text),
  };
}

function relationshipAxes(roles, fields, ksbs) {
  const rels = [];
  for (const k of ksbs.inferredKsbRelationships) {
    if (roles.includes("PRACTISES"))
      rels.push({ ksb: k, axis: "PRACTISES", confidence: "INFERRED" });
    if (roles.includes("ASSESSES"))
      rels.push({ ksb: k, axis: "ASSESSES", confidence: "INFERRED" });
    if (roles.includes("RECORDS_EVIDENCE"))
      rels.push({ ksb: k, axis: "RECORDS_EVIDENCE", confidence: "INFERRED" });
  }
  // Strengthen S13 if isolation explicit
  if (fields.mentionsIsolation) {
    for (const axis of ["PRACTISES", "ASSESSES"]) {
      rels.push({
        ksb: "S13",
        axis,
        confidence: "EXPLICIT_TASK_LANGUAGE",
        note: "Document tasks include isolate / isolation of HV system",
      });
    }
  }
  return rels;
}

function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(path.join(OUT, "extracts"), { recursive: true });

  const sources = [
    {
      year: 1,
      zip: "C:\\Users\\ReissChambers\\OneDrive - Doncaster GTA\\Desktop\\Auto-care Year 1 CEA.zip",
      dir: path.join(INGEST, "year1"),
    },
    {
      year: 2,
      zip: "C:\\Users\\ReissChambers\\OneDrive - Doncaster GTA\\Desktop\\Auto-care Year 2 CEA.zip",
      dir: path.join(INGEST, "year2"),
    },
  ];

  const resources = [];
  const relationships = [];
  const byGroup = {};

  for (const src of sources) {
    for (const file of walkFiles(src.dir)) {
      const ext = path.extname(file).toLowerCase();
      const filename = path.basename(file);
      const relativePath = path.relative(INGEST, file).replace(/\\/g, "/");
      const hash = sha256File(file);
      const cea = parseCeaCode(filename);
      const groupMeta = cea ? GROUP_ROUTING[cea.major] || null : null;

      let extraction = {
        status: "UNSUPPORTED",
        text: "",
        reason: `Extension ${ext}`,
      };
      if (ext === ".docx") {
        extraction = extractDocxText(readFileSync(file));
      } else if (ext === ".xlsx") {
        extraction = {
          status: "NOT_INSPECTED_BINARY_CONTENTS",
          text: "",
          reason: "Spreadsheet catalogued by filename/role only",
        };
      } else if (ext === ".url") {
        extraction = {
          status: "EXTRACTED",
          text: readFileSync(file, "utf8"),
          reason: null,
        };
      }

      const text = extraction.text || "";
      const fields = text ? extractFields(text) : {};
      const roles = text ? classifyRoles(filename, text) : [];
      const docType = classifyDocType(filename, text);
      const ksbs = text
        ? inferKsbs(filename, text)
        : { explicitKsbReferences: [], inferredKsbRelationships: [] };

      // filename-based inference fallback when extract sparse
      if (!ksbs.inferredKsbRelationships.length) {
        const fb = inferKsbs(filename, filename);
        ksbs.inferredKsbRelationships = fb.inferredKsbRelationships;
      }

      if (extraction.status === "EXTRACTED" && text.length > 40) {
        const extractName = `${src.year}_${filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120)}.txt`;
        writeFileSync(path.join(OUT, "extracts", extractName), text, "utf8");
      }

      const resource = {
        id: `cea_${src.year}_${(cea?.ref || filename).replace(/\W+/g, "_")}`,
        filename,
        relativePath,
        sourceZip: src.zip,
        year: src.year,
        era: "GROUP_YEAR",
        structure: {
          numberingScheme: cea
            ? `CEA ${cea.ref} ≈ Group ${cea.major} task ${cea.minor}`
            : "NON_NUMBERED_SUPPORTING",
          groupCode: groupMeta?.g || null,
          groupTitle: groupMeta?.title || null,
          groupMajor: cea?.major || null,
          ceaRef: cea?.ref || null,
          blockDirect: groupMeta?.D || [],
          blockSupporting: groupMeta?.S || [],
          blockJoinConfidence: groupMeta ? "INFERRED_VIA_TRANSITION_GUIDE" : "NONE",
          weekSession: null,
          weekSessionConfidence: "UNKNOWN",
        },
        documentType: docType,
        evidenceRoles: roles,
        fileType: ext,
        sha256: hash,
        bytes: statSync(file).size,
        extractionStatus: extraction.status,
        extractionReason: extraction.reason,
        fields,
        learnerInstructionsPresent: /APPRENTICE INSTRUCTIONS|Scenario:/i.test(text),
        expectedPracticalPerformance: fields.expectedPerformanceSnippets || [],
        measurementsOrSpecsRequired: !!fields.requiresMeasurements,
        technicalInformationRequired: !!fields.requiresManufacturerTechInfo,
        evidenceRecordingRequirements: roles.includes("RECORDS_EVIDENCE"),
        assessorMentorVerification: !!fields.hasAssessorSignOff,
        assessmentCriteria: {
          passReferOutcome: !!fields.hasPassRefer,
          oralQuestionsPresent: (fields.oralOrWrittenQuestions || []).length > 0,
          objectivesAsCriteria: (fields.objectives || []).length > 0,
        },
        ...ksbs,
        differentFromWorkplaceJobCard:
          "YES — these are centre controlled practical assessment tasks with Pass/Refer assessment records, not generic workplace job-card templates.",
        differentFromBlockTask12:
          "DIFFERENT LAYER — numbered CEA Group.task (e.g. 3.1), not Block 'Task 1/Task 2' PDFs from the practical pack.",
        capableOfProving: roles.includes("ASSESSES")
          ? [
              "Learner instructed to perform named practical",
              "Assessor observation/sign-off mechanism exists (Pass/Refer)",
              "Tech-data / measurements / oral questions may be recorded",
            ]
          : ["Supporting commercial/process template only"],
        notCapableOfProvingAlone: [
          "Completed learner evidence (these are blank templates/instructions)",
          "Official KSB Primary ownership",
          "Block-week exact placement without separate join table",
        ],
      };

      resources.push(resource);

      const rels = relationshipAxes(roles, fields, ksbs);
      for (const r of rels) {
        relationships.push({
          resourceId: resource.id,
          ...r,
          group: groupMeta?.g || null,
          ceaRef: cea?.ref || null,
          year: src.year,
        });
      }

      const gk = groupMeta?.g || "OTHER";
      byGroup[gk] = byGroup[gk] || [];
      byGroup[gk].push(resource.id);
    }
  }

  // Pilot impact analysis from extracted signals
  const tyre = resources.filter((r) => /^3\./.test(r.structure.ceaRef || ""));
  const steering = resources.filter((r) =>
    ["5.", "11."].some((p) => (r.structure.ceaRef || "").startsWith(p)),
  );
  const hybrid = resources.filter((r) => (r.structure.ceaRef || "").startsWith("2."));
  const brakes = resources.filter((r) =>
    ["4.", "10."].some((p) => (r.structure.ceaRef || "").startsWith(p)),
  );

  const s9Hits = resources.filter(
    (r) =>
      r.fields.mentionsTyreRemoveInstall ||
      r.fields.mentionsBalance ||
      r.fields.mentionsBs159 ||
      r.fields.mentionsRunFlat ||
      r.fields.mentionsTpms ||
      (r.inferredKsbRelationships || []).includes("S9"),
  );
  const k10Hits = resources.filter(
    (r) =>
      r.fields.mentionsSteering ||
      r.fields.mentionsHydraulicPas ||
      r.fields.mentionsEpsEpas ||
      (r.inferredKsbRelationships || []).includes("K10"),
  );
  const s13Hits = resources.filter(
    (r) => r.fields.mentionsIsolation || (r.structure.ceaRef || "") === "2.1",
  );

  const impact = {
    status: "STAGING_EVIDENCE_IMPACT_ONLY",
    mutatesRatifiedPilot: false,
    mutatesProgrammeTruth: false,
    classifiedMeaningOfCEA:
      "In these packs, CEA document titles/bodies are controlled centre practical assessment tasks: APPRENTICE INSTRUCTIONS + APPRENTICE ASSESSMENT RECORD with Pass/Refer and assessor sign-off. Numbering follows Group.task (e.g. CEA 3.1 under Wheels and Tyres). Not workplace job cards; not Block Task 1/2 PDFs.",
    previousMissingClaims: {
      ceaFormsPacks: {
        prior: "Standalone CEA blank forms NOT found",
        now: "CLOSED — Year 1 and Year 2 CEA apprentice instruction/assessment packs supplied and inspected",
      },
      blockTasks1and2: {
        prior: "Block Task 1/2 PDFs not found",
        now: "STILL OPEN as Block Task 1/2 — these CEA files are a different Group-era assessment layer, not Block Task 1/2 artefacts",
        correspondence: "PARTIAL / ANALOGUE ONLY — they may functionally cover practical assessment that Block Tasks 1–2 once represented, but they are not those files",
      },
      assessedTyreStripRefitBalance: {
        prior: "Not found in Block Tasks 3–4",
        now: "CLOSED as missing artefact — CEA 3.1 R&I (remove/replace/balance + puncture BS159), CEA 3.2 puncture, CEA 3.4 balance four wheels, CEA 3.5 run flat present",
      },
      steeringPracticalApplication: {
        prior: "Partially evidenced via B7 Task 3 + Group teaching",
        now: "STRENGTHENED — CEA 5.2 TRE, 5.6 pump, 5.7 rack (+ suspension CEAs 5.1–5.5); Year2 advanced steering/ADAS cluster under CEA 11.x",
      },
      hvIsolationPracticalAssessment: {
        prior: "Not found beyond awareness",
        now: "MATERIALLY STRENGTHENED — CEA 2.1 requires carry out isolation of HV system, reinstate, test; Pass/Refer assessor record. Still blank template (not completed learner sample).",
      },
      observationEvidence: {
        prior: "Referenced not supplied",
        now: "PARTIAL CLOSE — assessor observation/sign-off mechanism present on each CEA assessment record; completed observed evidence still not supplied",
      },
      jobCardEvidence: {
        prior: "Workplace job-card templates not found as pack",
        now: "STILL OPEN for workplace job cards — CEA packs are not those templates (commercial invoice/estimate templates in Y2 are also not job cards)",
      },
    },
    pilotImpact: {
      S9: {
        effect: "STRENGTHEN",
        materialChangeCandidate: true,
        summary:
          "CEA 3.1/3.2/3.4/3.5 provide controlled assessed practicals for remove/install, puncture repair (BS159), balance, and run-flat — exactly the practice/assessment visibility gap in the ratified shadow pilot. Ownership remains Group→Block inferred (G3→B2/B3); Primary still not auto-assigned.",
        residual:
          "Blank templates only; Block-era exact host still structural inference; specials breadth improved by run-flat CEA.",
      },
      K10: {
        effect: "STRENGTHEN_APPLICATION_AND_ASSESSMENT",
        materialChangeCandidate: true,
        summary:
          "CEA 5.6/5.7 prove assessed remove/refit of hydraulic PAS pump/rack; TRE CEA 5.2 strengthens mechanical steering R&R. Helps prove application/assessment more than resolve Primary ownership (still Ambiguous between early teaching B4/B5 vs later practical). EPS/EPAS dedicated CEA not obvious in filenames (EPA Practice 11.5 needs content check — may be End Point Assessment practice, not EPS).",
        residual:
          "Ownership still under review; confirm whether any CEA assesses EPS/EPAS specifically vs hydraulic only.",
      },
      S13: {
        effect: "STRENGTHEN",
        materialChangeCandidate: true,
        summary:
          "CEA 2.1 objectives and scenario explicitly require isolation of the HV system, reinstatement and functional test, with Pass/Refer assessor record. This is stronger than awareness. Title still mixes locating components. Strict reading: assessed isolation competence is now templeted/designed — completed competence evidence still unseen.",
        residual:
          "Blank form only; whether live delivery uses this for every apprentice remains operational confirmation (Jon).",
      },
      K12: {
        effect: "STRENGTHEN_SUPPORTING",
        materialChangeCandidate: false,
        summary:
          "CEA 4.x and 10.x provide rich assessed brake practicals — supports KEEP B2 narrative and progression, does not force remap.",
      },
      K21: {
        effect: "MILD_SUPPORT",
        materialChangeCandidate: false,
        summary:
          "CEA 2.1 involves hybrid/EV vehicle and HV voltages recording — supports K21 adjacent competence but Primary KEEP B6 unchanged.",
      },
      K23: {
        effect: "STRENGTHEN",
        materialChangeCandidate: false,
        summary:
          "CEA 2.1 requires HV isolation procedure under assessment conditions — strengthens practice/assessment axes previously marked PARTIAL, ownership KEEP B6 unchanged.",
      },
    },
    reopenPilotForHumanReview: {
      recommended: true,
      reason:
        "Material new assessed-practical artefacts for S9, K10 application, and S13/K23 practice-assessment. Directions may hold but evidence-strength ratings likely upgrade. Do not auto-edit ratified pilot.",
    },
    counts: {
      filesTotal: resources.length,
      docx: resources.filter((r) => r.fileType === ".docx").length,
      extractedOk: resources.filter((r) => r.extractionStatus === "EXTRACTED")
        .length,
      controlledAssessmentTasks: resources.filter(
        (r) => r.documentType === "CONTROLLED_PRACTICAL_ASSESSMENT_TASK",
      ).length,
      supportingTemplates: resources.filter((r) =>
        ["COMMERCIAL_TEMPLATE", "SUPPORTING_TEMPLATE", "EXTERNAL_LINK", "OTHER"].includes(
          r.documentType,
        ),
      ).length,
      tyreCluster: tyre.length,
      steeringCluster: steering.length,
      hybridCluster: hybrid.length,
      brakesCluster: brakes.length,
      s9HitDocs: s9Hits.map((r) => r.filename),
      k10HitDocs: k10Hits.map((r) => r.filename),
      s13HitDocs: s13Hits.map((r) => r.filename),
    },
  };

  // Content check for 11.5 EPA Practice — EPS vs End Point Assessment
  const epaPractice = resources.find((r) =>
    /EPA Practice/i.test(r.filename),
  );
  if (epaPractice) {
    let text = "";
    try {
      text = readFileSync(
        path.join(
          OUT,
          "extracts",
          `${epaPractice.year}_${epaPractice.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120)}.txt`,
        ),
        "utf8",
      );
    } catch {
      text = "";
    }
    impact.epaPractice11_5Note = {
      filename: epaPractice.filename,
      looksLikeEndPointAssessmentPractice: /end.?point|gateway|synoptic|mock/i.test(
        text,
      ),
      looksLikeElectricPowerSteering: /\beps\b|\bepas\b|electric power steer/i.test(
        text,
      ),
      note: "Filename 'EPA Practice' is ambiguous — inspect body before treating as EPS/EPAS evidence.",
      snippet: text.slice(0, 700),
    };
  }

  const productLearning = {
    architectureOnly: true,
    ceaMeansInThisCorpus:
      "Controlled Evidence / Competency Assessment style centre practicals — not teaching slides and not workplace job cards.",
    commonStructuredFields: [
      "ceaRef (Group.task)",
      "programmeYear",
      "groupCode/title",
      "taskTitle",
      "durationMinutes",
      "objectives[]",
      "materialsAndEquipment[]",
      "scenarioNarrative",
      "performanceSteps[]",
      "techDataCaptureFields[]",
      "measurements[]",
      "oralQuestions[]",
      "ppeAndPrecautions",
      "assessorSignOff",
      "apprenticeSignOff",
      "resultPassRefer",
      "feedback",
      "inferredOrLinkedKsbs[]",
      "blockRoutingDirect[] / supporting[]",
      "relationshipAxes: PRACTISES | ASSESSES | RECORDS_EVIDENCE",
    ],
    chainModel:
      "OFFICIAL → KSB → GROUP (CEA ref) → BLOCK (inferred routing) → WEEK/SESSION (unknown) → TEACHING (separate) → PRACTICAL/CEA → ASSESSMENT RECORD → WORKPLACE EVIDENCE (still separate job cards)",
    portalImplication:
      "Programme Builder should store CEA tasks as first-class PracticalAssessmentTask entities, linked to Groups/Blocks/KSBs, generating consistent instruction+assessment-record documents rather than absorbing inconsistent Word files.",
  };

  writeFileSync(path.join(OUT, "cea-resources.json"), JSON.stringify(resources, null, 2));
  writeFileSync(
    path.join(OUT, "cea-relationships.json"),
    JSON.stringify(relationships, null, 2),
  );
  writeFileSync(path.join(OUT, "cea-impact-review.json"), JSON.stringify(impact, null, 2));
  writeFileSync(
    path.join(OUT, "cea-product-learning.json"),
    JSON.stringify(productLearning, null, 2),
  );
  writeFileSync(
    path.join(OUT, "cea-catalogue-summary.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        stagingOnly: true,
        mutatesProgrammeTruth: false,
        ratifiedPilotUnchanged: true,
        byGroup,
        counts: impact.counts,
        classifiedMeaningOfCEA: impact.classifiedMeaningOfCEA,
      },
      null,
      2,
    ),
  );

  // Merge note into main catalogue area without rewriting golden/pilot
  const mergeNote = {
    generatedAt: new Date().toISOString(),
    pack: "autocare_cea_year1_year2",
    addedToStagingCatalogue: true,
    resourceFile: "cea-catalogue/cea-resources.json",
    relationshipFile: "cea-catalogue/cea-relationships.json",
    impactFile: "cea-catalogue/cea-impact-review.json",
    note: "Appended as separate pack catalogue; main catalogue-resources.json not rewritten in this pass.",
  };
  writeFileSync(
    path.join(
      ROOT,
      "tests/artifacts/autocare-v1/evidence-enriched/staging/cea-pack-ingest-note.json",
    ),
    JSON.stringify(mergeNote, null, 2),
  );

  console.log(
    JSON.stringify(
      {
        resources: resources.length,
        extracted: impact.counts.extractedOk,
        controlledTasks: impact.counts.controlledAssessmentTasks,
        reopenPilot: impact.reopenPilotForHumanReview.recommended,
        s9: impact.pilotImpact.S9.effect,
        k10: impact.pilotImpact.K10.effect,
        s13: impact.pilotImpact.S13.effect,
      },
      null,
      2,
    ),
  );
}

main();
