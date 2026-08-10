/**
 * Builds HUMAN RATIFICATION PACK from frozen 64/64 shadow analysis.
 * Does NOT re-analyse. Does NOT overwrite COMPLETE-64 report/summary.
 * Does NOT write programme truth / Golden A / Golden B.
 */
import fs from 'fs';
import path from 'path';

const ROOT = 'tests/artifacts/autocare-v1/evidence-enriched/staging';
const PLAN = path.join(ROOT, 'remaining-51-plan');
const PACK = path.join(PLAN, 'human-ratification-pack');
const FREEZE = path.join(PLAN, 'FROZEN-64-KSB-SHADOW-2026-08-10');

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function write(p, s) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, s);
}
function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}
function esc(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}
function dirBucket(d) {
  const s = String(d || '').toUpperCase();
  if (s.includes('KEEP_GAP') || s.includes('KEEP_AS_GAP')) return 'KEEP_GAP';
  if (s.includes('CHANGE_OWNERSHIP')) return 'CHANGE_OWNERSHIP';
  if (s.includes('CHANGE_CLASSIFICATION') || s === 'CHANGE' || (s.includes('CHANGE') && !s.includes('OWNERSHIP')))
    return 'CHANGE_CLASSIFICATION';
  if (s.includes('DISTRIBUTED')) return 'DISTRIBUTED';
  if (s.includes('REVIEW')) return 'REVIEW';
  if (s.includes('KEEP')) return 'KEEP';
  return 'UNRESOLVED';
}
function proposedPrimary(dos) {
  const own = dos.ownership || {};
  const ga = dos.goldenAComparedAfter || {};
  const home = own.firstSubstantiveTeachingHome || own.status || '';
  const dir = String(dos.shadowDirection || '');
  // Extract Bn if present in direction
  const m = dir.match(/B(\d+)/i);
  if (m) return `B${m[1]}`;
  if (/G7/i.test(dir + home)) return 'G7 cluster (starting/charging)';
  if (/G11/i.test(dir + home)) return 'G11';
  if (/G8|B2\/G8/i.test(dir + home)) return 'G8 / early B2';
  if (/EARLY_G3|G3\/B2|G3_B2/i.test(dir)) return 'Early G3 / B2';
  if (/EARLY_DISTRIBUTED|LIR/i.test(dir)) return 'Early distributed LIR/SPR';
  if (/DISTRIBUTED/i.test(dir)) return 'Distributed / not forced';
  if (/GAP/i.test(dir)) return 'None — gap';
  if (ga.position && /PRIMARY_B(\d+)/i.test(ga.position)) return ga.position.replace('PRIMARY_', '');
  return home || 'See dossier';
}
function collectEvidence(comps, axis) {
  const out = [];
  for (const c of comps || []) {
    const a = c[axis];
    if (!a) continue;
    for (const e of a.evidence || []) out.push(e);
  }
  return [...new Set(out)].slice(0, 8);
}
function collectUnresolved(comps) {
  const out = [];
  for (const c of comps || []) {
    const t = String(c.teaching?.status || '');
    if (/NOT_FOUND|WEAK|THIN|GAP|ABSENCE|UNRESOLVED|INSUFFICIENT/i.test(t)) {
      out.push(c.claim || c.id);
    }
  }
  return out.slice(0, 8);
}
function collectIssues(tax) {
  const joined = (tax || []).join(' | ').toUpperCase();
  const tags = [];
  if (/CURRICULUM/.test(joined)) tags.push('CURRICULUM GAP');
  if (/TEACHING_DEPTH|TEACHING DEPTH/.test(joined)) tags.push('TEACHING DEPTH GAP');
  if (/PRACTICE/.test(joined)) tags.push('PRACTICE GAP');
  if (/ASSESSMENT/.test(joined)) tags.push('ASSESSMENT GAP');
  if (/VISIBILITY/.test(joined)) tags.push('EVIDENCE VISIBILITY GAP');
  if (/STRUCTURAL|OWNERSHIP ISSUE/.test(joined)) tags.push('STRUCTURAL MAPPING GAP');
  if (/DISTRIBUTED/.test(joined)) tags.push('DISTRIBUTED / OWNERSHIP ISSUE');
  return tags;
}
function groupFromEdges(edges, code) {
  const gs = new Set();
  for (const e of edges || []) {
    if (e.ksb !== code) continue;
    if (e.provenance && /GROUP_/.test(e.provenance)) gs.add(e.provenance.replace('GROUP_', ''));
    if (e.provenance === 'GROUP_G8') gs.add('G8');
  }
  return [...gs];
}
function weeksFromEdges(edges, code) {
  const ws = [];
  for (const e of edges || []) {
    if (e.ksb !== code) continue;
    if (e.week != null) ws.push(`W${e.week}${e.block != null ? ` / B${e.block}` : ''}`);
  }
  return [...new Set(ws)];
}
function blocksFromEdges(edges, code) {
  const bs = new Set();
  for (const e of edges || []) {
    if (e.ksb !== code) continue;
    if (e.block != null) bs.add(`B${e.block}`);
  }
  return [...bs];
}

// --- Freeze copies (do not overwrite originals) ---
ensureDir(FREEZE);
ensureDir(PACK);
const freezeManifest = {
  frozenAt: '2026-08-10',
  status: 'FROZEN_SHADOW_CANDIDATE_FOR_HUMAN_RATIFICATION',
  mutatesProgrammeTruth: false,
  note: 'Copies only. Originals left in place and not overwritten by this pack.',
  artifacts: []
};
function freeze(relFromPlanOrStaging, label) {
  const src = relFromPlanOrStaging.startsWith(ROOT)
    ? relFromPlanOrStaging
    : path.join(PLAN, relFromPlanOrStaging);
  if (!fs.existsSync(src)) {
    // try staging root relative
    const alt = path.join(ROOT, relFromPlanOrStaging);
    if (!fs.existsSync(alt)) {
      freezeManifest.artifacts.push({ label, status: 'MISSING', src });
      return;
    }
    const dest = path.join(FREEZE, path.basename(alt));
    copyFile(alt, dest);
    freezeManifest.artifacts.push({ label, status: 'COPIED', from: alt, to: dest });
    return;
  }
  const dest = path.join(FREEZE, path.basename(src));
  copyFile(src, dest);
  freezeManifest.artifacts.push({ label, status: 'COPIED', from: src, to: dest });
}
freeze('COMPLETE-64-KSB-SHADOW-ASSURANCE-REPORT.md', 'complete-report');
freeze('COMPLETE-64-KSB-SHADOW-SUMMARY.json', 'complete-summary');
for (const b of ['batch-r51-1', 'batch-r51-2', 'batch-r51-3', 'batch-r51-4', 'batch-r51-5']) {
  const shadow = path.join(PLAN, b, `shadow-${b.replace('batch-', 'batch-')}.json`.replace('shadow-batch-r51', 'shadow-batch-r51'));
  // simpler:
}
for (const name of [
  'batch-r51-1/shadow-batch-r51-1.json',
  'batch-r51-2/shadow-batch-r51-2.json',
  'batch-r51-3/shadow-batch-r51-3.json',
  'batch-r51-4/shadow-batch-r51-4.json',
  'batch-r51-5/shadow-batch-r51-5.json',
  'batch-r51-1/RATIFICATION.md',
  'batch-r51-2/RATIFICATION.md',
  'batch-r51-3/RATIFICATION.md',
  'batch-r51-4/RATIFICATION.md',
  'batch-r51-5/RATIFICATION.md'
]) {
  const src = path.join(PLAN, name);
  if (fs.existsSync(src)) {
    const dest = path.join(FREEZE, name);
    copyFile(src, dest);
    freezeManifest.artifacts.push({ label: name, status: 'COPIED', from: src, to: dest });
  }
}
// pilot + tranche2
for (const [srcRel, destName] of [
  ['phase2a/shadow-golden-b-pilot-6ksb.json', 'pilot/shadow-golden-b-pilot-6ksb.json'],
  ['tranche2/shadow-tranche-2.json', 'tranche2/shadow-tranche-2.json'],
  ['tranche2/golden-a-vs-tranche-2.md', 'tranche2/golden-a-vs-tranche-2.md']
]) {
  const src = path.join(ROOT, srcRel);
  if (fs.existsSync(src)) {
    copyFile(src, path.join(FREEZE, destName));
    freezeManifest.artifacts.push({ label: destName, status: 'COPIED', from: src });
  }
}
write(path.join(FREEZE, 'FREEZE-MANIFEST.json'), JSON.stringify(freezeManifest, null, 2));
write(
  path.join(FREEZE, 'README.md'),
  `# FROZEN 64-KSB SHADOW — 2026-08-10\n\nCandidate evidence set for human ratification.\n\n- Status: SHADOW ONLY — not programme truth\n- Do not overwrite; append corrigenda if needed\n- Originals also remain under \`remaining-51-plan/\` and staging pilot/tranche2 paths\n`
);

// --- Load corpus dossiers ---
const catalog = readJson('docs/standards/st0499/st0499-ksb-catalog.json');
let official = [];
for (const v of catalog.versions) if ((v.ksbs || []).length >= 64) official = v.ksbs;
const officialBy = new Map(official.map((k) => [k.code, k]));

const summary = readJson(path.join(PLAN, 'COMPLETE-64-KSB-SHADOW-SUMMARY.json'));
const dossierBy = new Map();
const edgesByBatch = [];

function loadDossiers(file, batch) {
  const j = readJson(file);
  edgesByBatch.push({ batch, edges: j.relationshipEdges || [] });
  for (const [code, dos] of Object.entries(j.dossiers || {})) {
    dossierBy.set(code, { batch, dos, edges: j.relationshipEdges || [] });
  }
}
loadDossiers(path.join(ROOT, 'tranche2/shadow-tranche-2.json'), 'TRANCHE2');
loadDossiers(path.join(PLAN, 'batch-r51-1/shadow-batch-r51-1.json'), 'R51-1');
loadDossiers(path.join(PLAN, 'batch-r51-2/shadow-batch-r51-2.json'), 'R51-2');
loadDossiers(path.join(PLAN, 'batch-r51-3/shadow-batch-r51-3.json'), 'R51-3');
loadDossiers(path.join(PLAN, 'batch-r51-4/shadow-batch-r51-4.json'), 'R51-4');
loadDossiers(path.join(PLAN, 'batch-r51-5/shadow-batch-r51-5.json'), 'R51-5');

// Pilot special structure
const pilot = readJson(path.join(ROOT, 'phase2a/shadow-golden-b-pilot-6ksb.json'));
for (const row of pilot.comparisonTable || []) {
  const full = pilot.dossiers?.[row.ksb] || {};
  const inferred = full.B_inferredTeachingRequirements;
  const inferredList = Array.isArray(inferred)
    ? inferred
    : inferred && typeof inferred === 'object'
      ? Object.values(inferred)
      : [];
  dossierBy.set(row.ksb, {
    batch: 'PILOT',
    dos: {
      officialRequirement: full.A_officialRequirement || officialBy.get(row.ksb)?.statement,
      components: inferredList.map((x, i) => ({
        id: `${row.ksb}-P${i + 1}`,
        claim: typeof x === 'string' ? x : x?.claim || x?.requirement || JSON.stringify(x),
        teaching: { status: row.shadowCoverage, evidence: (full.D_liveEvidence && [String(full.D_liveEvidence).slice(0, 200)]) || [] },
        practice: { status: row.practice, evidence: [] },
        assessment: { status: row.assessment, evidence: [] }
      })),
      axisRollup: {
        teaching: row.shadowCoverage,
        practice: row.practice,
        assessment: row.assessment,
        workplaceApplication: 'See pilot dossier',
        gatewayEpaSupport: 'See pilot dossier',
        structuralAccounting: row.ownership
      },
      ownership: {
        firstSubstantiveTeachingHome: row.ownership,
        status: row.ownership
      },
      assuranceClassifications: row.taxonomy || [],
      shadowDirection:
        row.direction === 'CHANGE'
          ? 'CHANGE_CLASSIFICATION'
          : row.direction === 'KEEP'
            ? 'KEEP_PRIMARY'
            : row.direction === 'REVIEW'
              ? 'REVIEW'
              : row.direction,
      confidenceOverall: full.O_confidence || 'HIGH',
      goldenAComparedAfter: { position: row.goldenA, direction: row.direction }
    },
    edges: []
  });
}

// Evidence requests from batches
const allRequests = [];
function ingestRequests(file, batch) {
  if (!fs.existsSync(file)) return;
  const j = readJson(file);
  for (const r of j.evidenceRequestsGenerated || []) {
    allRequests.push({ ...r, batch });
  }
  for (const r of j.carryForwardEvidenceRequests || j.carryForwardNonBlockingEvidenceRequests || []) {
    allRequests.push({
      id: `${batch}-CF-${allRequests.length + 1}`,
      priority: 'NON_BLOCKING',
      affects: [],
      request: typeof r === 'string' ? r : r.request,
      batch,
      carryForward: true
    });
  }
}
ingestRequests(path.join(PLAN, 'batch-r51-1/shadow-batch-r51-1.json'), 'R51-1');
ingestRequests(path.join(PLAN, 'batch-r51-2/shadow-batch-r51-2.json'), 'R51-2');
ingestRequests(path.join(PLAN, 'batch-r51-3/shadow-batch-r51-3.json'), 'R51-3');
ingestRequests(path.join(PLAN, 'batch-r51-4/shadow-batch-r51-4.json'), 'R51-4');
ingestRequests(path.join(PLAN, 'batch-r51-5/shadow-batch-r51-5.json'), 'R51-5');

// Build cards
const cards = [];
for (const row of summary.rows) {
  const code = row.code;
  const off = officialBy.get(code);
  const pack = dossierBy.get(code);
  if (!pack) {
    cards.push({
      code,
      error: 'MISSING_DOSSIER',
      humanDecision: null
    });
    continue;
  }
  const { dos, edges, batch } = pack;
  const bucket = dirBucket(dos.shadowDirection || row.shadowDirection);
  const comps = (dos.components || []).map((c) => ({
    id: c.id,
    claim: c.claim,
    teachingStatus: c.teaching?.status,
    practiceStatus: c.practice?.status,
    assessmentStatus: c.assessment?.status
  }));
  const gaBlock = row.goldenAPrimaryBlock;
  const gaPos =
    gaBlock != null
      ? `PRIMARY B${gaBlock}`
      : dos.goldenAComparedAfter?.position || 'REVIEWED_GAP / NON-PRIMARY';

  cards.push({
    code,
    kind: row.kind,
    batch,
    officialWording: dos.officialRequirement || off?.statement || '',
    components: comps,
    goldenAPosition: gaPos,
    shadowPosition: dos.shadowDirection || row.shadowDirection,
    proposedDirectionBucket: bucket,
    proposedPrimaryOwner: proposedPrimary(dos),
    teachingEvidence: collectEvidence(dos.components, 'teaching'),
    practiceEvidence: collectEvidence(dos.components, 'practice'),
    assessmentEvidence: collectEvidence(dos.components, 'assessment'),
    workplaceEvidence: collectEvidence(dos.components, 'workplaceApplication'),
    gatewayEpaEvidence: collectEvidence(dos.components, 'gatewayEpaSupport'),
    axisRollup: dos.axisRollup || null,
    groupProvenance: groupFromEdges(edges, code),
    blockRelationships: blocksFromEdges(edges, code),
    weeksProven: weeksFromEdges(edges, code),
    assuranceIssues: collectIssues(dos.assuranceClassifications || row.taxonomy),
    taxonomyRaw: dos.assuranceClassifications || row.taxonomy || [],
    confidence: dos.confidenceOverall || row.confidence,
    unresolvedMissing: collectUnresolved(dos.components),
    keyEvidenceReferences: [
      ...collectEvidence(dos.components, 'teaching').slice(0, 3),
      ...collectEvidence(dos.components, 'practice').slice(0, 2)
    ],
    firstSubstantiveHome: dos.ownership?.firstSubstantiveTeachingHome || null,
    humanDecision: null, // APPROVE | AMEND | HOLD FOR EVIDENCE — human only
    humanDecisionNotes: null
  });
}

// Queues
const queueA = cards.filter((c) =>
  ['CHANGE_CLASSIFICATION', 'CHANGE_OWNERSHIP', 'DISTRIBUTED', 'REVIEW'].includes(c.proposedDirectionBucket)
);
const queueB = cards.filter((c) => c.proposedDirectionBucket === 'KEEP_GAP');
const queueC = cards.filter((c) => c.proposedDirectionBucket === 'KEEP');

// Fix: K25 PARTIAL_DISTRIBUTED is CHANGE_CLASSIFICATION - already A
// S10 KEEP_DISTRIBUTED -> DISTRIBUTED -> A ✓

write(path.join(PACK, 'cards-64.json'), JSON.stringify({ status: 'SHADOW_ONLY', generatedAt: '2026-08-10', count: cards.length, cards }, null, 2));

// Markdown cards (compact but complete fields)
function cardMd(c) {
  let m = `## ${c.code} (${c.kind})\n\n`;
  m += `| Field | Content |\n|---|---|\n`;
  m += `| A Official | ${esc(c.officialWording)} |\n`;
  m += `| B Components | ${esc((c.components || []).map((x) => x.claim).join(' · ') || 'See dossier')} |\n`;
  m += `| C Golden A | ${esc(c.goldenAPosition)} |\n`;
  m += `| D Shadow position | ${esc(c.shadowPosition)} |\n`;
  m += `| E Proposed direction | **${esc(c.proposedDirectionBucket)}** |\n`;
  m += `| F Proposed Primary | ${esc(c.proposedPrimaryOwner)} |\n`;
  m += `| G Teaching evidence | ${esc((c.teachingEvidence || []).join(' \| ') || '—')} |\n`;
  m += `| H Practice evidence | ${esc((c.practiceEvidence || []).join(' \| ') || '—')} |\n`;
  m += `| I Assessment evidence | ${esc((c.assessmentEvidence || []).join(' \| ') || '—')} |\n`;
  m += `| J Workplace evidence | ${esc((c.workplaceEvidence || []).join(' \| ') || 'mechanism only / unsourced')} |\n`;
  m += `| K Gateway/EPA | ${esc((c.gatewayEpaEvidence || []).join(' \| ') || '—')} |\n`;
  m += `| L Group provenance | ${esc((c.groupProvenance || []).join(', ') || 'mixed / block / FS')} |\n`;
  m += `| M Block relationship | ${esc((c.blockRelationships || []).join(', ') || c.firstSubstantiveHome || '—')} |\n`;
  m += `| N Week/session (proven only) | ${esc((c.weeksProven || []).join(', ') || 'null / not invented')} |\n`;
  m += `| O Assurance issues | ${esc((c.assuranceIssues || []).join(' · ') || 'none tagged')} |\n`;
  m += `| P Confidence | ${esc(c.confidence)} |\n`;
  m += `| Q Unresolved / missing | ${esc((c.unresolvedMissing || []).join(' · ') || '—')} |\n`;
  m += `| R Key evidence refs | ${esc((c.keyEvidenceReferences || []).join(' \| ') || '—')} |\n`;
  m += `| S Human decision | _APPROVE / AMEND / HOLD FOR EVIDENCE_ |\n`;
  m += `| Batch | ${esc(c.batch)} |\n\n`;
  m += `**Decision notes (human):**\n\n> \n\n---\n\n`;
  return m;
}

function writeQueue(name, title, list, guidance) {
  let md = `# ${title}\n\n`;
  md += `**Count:** ${list.length}  \n`;
  md += `**Status:** SHADOW ONLY — human decision required  \n\n`;
  md += guidance + '\n\n';
  md += `**KSBs:** ${list.map((c) => c.code).join(', ')}\n\n---\n\n`;
  for (const c of list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))) {
    md += cardMd(c);
  }
  write(path.join(PACK, name), md);
}

writeQueue(
  'QUEUE-A-HIGH-PRIORITY-CHANGES.md',
  'QUEUE A — HIGH-PRIORITY CHANGES',
  queueA,
  'Includes CHANGE CLASSIFICATION, CHANGE OWNERSHIP, DISTRIBUTED, REVIEW. Explicit human ratification required before any Golden B drafting.'
);
writeQueue(
  'QUEUE-B-KEEP-GAP.md',
  'QUEUE B — KEEP GAP',
  queueB,
  'These conclude curriculum evidence is genuinely missing or insufficient in the supplied corpus. Confirm carefully; do not confuse with visibility-only problems.'
);
writeQueue(
  'QUEUE-C-KEEP-CONTROLS.md',
  'QUEUE C — KEEP CONTROLS',
  queueC,
  'Lighter-touch confirmation unless a depth/practice/assessment concern is listed. Spot-check evidence refs; escalate to AMEND if challenged.'
);

// Master pack index of all 64 (short table + pointers)
let index = `# HUMAN RATIFICATION PACK — 64 AUTOCARE KSBs\n\n`;
index += `**STATUS:** STAGING ONLY · SHADOW · not programme truth · not Golden B  \n`;
index += `**Frozen corpus:** \`FROZEN-64-KSB-SHADOW-2026-08-10/\`  \n`;
index += `**Generated:** 2026-08-10  \n`;
index += `**Purpose:** Inspect, challenge, approve existing conclusions — do not re-run analysis.\n\n`;
index += `## Queues\n\n`;
index += `| Queue | Purpose | Count | File |\n|---|---|---:|---|\n`;
index += `| A | High-priority changes | ${queueA.length} | QUEUE-A-HIGH-PRIORITY-CHANGES.md |\n`;
index += `| B | KEEP GAP confirmations | ${queueB.length} | QUEUE-B-KEEP-GAP.md |\n`;
index += `| C | KEEP controls (lighter touch) | ${queueC.length} | QUEUE-C-KEEP-CONTROLS.md |\n\n`;
index += `## Machine-readable cards\n\n- \`cards-64.json\` — all 64 with fields A–S (\`humanDecision\` null)\n\n`;
index += `## Registers & director view\n\n- \`REGISTER-GOLDEN-A-TO-SHADOW-CHANGES.md\`\n- \`REGISTER-GENUINE-GAPS.md\`\n- \`REGISTER-EVIDENCE-REQUESTS.md\`\n- \`DIRECTOR-READOUT.md\`\n- \`GOLDEN-B-READINESS-GATE.md\`\n- \`PRODUCT-LEARNING.md\`\n- \`INCONSISTENCIES.md\`\n- \`RECOMMENDED-HUMAN-PROCESS.md\`\n\n`;
index += `## Full 64 direction index\n\n| Code | Queue | Direction bucket | Shadow direction | Golden A |\n|---|---|---|---|---|\n`;
for (const c of [...cards].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))) {
  const q =
    queueA.find((x) => x.code === c.code) ? 'A' : queueB.find((x) => x.code === c.code) ? 'B' : 'C';
  index += `| ${c.code} | ${q} | ${c.proposedDirectionBucket} | ${esc(c.shadowPosition)} | ${esc(c.goldenAPosition)} |\n`;
}
write(path.join(PACK, 'README.md'), index);

// --- Change register ---
let chg = `# Golden A → Shadow Change Register\n\n**SHADOW ONLY.** Every KSB where richer evidence materially disagrees with Golden A.\n\n`;
const falseGaps = [];
const ownership = [];
const partials = [];
const distReview = [];

for (const c of cards) {
  const b = c.proposedDirectionBucket;
  const dir = String(c.shadowPosition || '');
  const ga = String(c.goldenAPosition || '');
  const why = (c.taxonomyRaw || []).join('; ') || c.firstSubstantiveHome || '';
  if (b === 'KEEP' || b === 'KEEP_GAP') {
    // KEEP_GAP against reviewed gap is agreement, not change; KEEP Primary agreement skip
    // Exception: KEEP_GAP when Golden A was PRIMARY is a disagreement (coverage insufficient)
    if (b === 'KEEP_GAP' && /PRIMARY/i.test(ga)) {
      // gap vs primary — treat as genuine weakness, also note under ownership/classification conflict
      partials.push({ code: c.code, type: 'PRIMARY_BUT_GAP', ga, dir, why });
    }
    continue;
  }
  if (b === 'DISTRIBUTED' || b === 'REVIEW') {
    distReview.push({ code: c.code, b, ga, dir, why });
    continue;
  }
  if (b === 'CHANGE_OWNERSHIP') {
    ownership.push({ code: c.code, ga, dir, why, owner: c.proposedPrimaryOwner });
    continue;
  }
  if (b === 'CHANGE_CLASSIFICATION') {
    if (/PARTIAL/i.test(dir)) partials.push({ code: c.code, type: 'PARTIAL', ga, dir, why });
    else if (/GAP|REVIEWED_CURRICULUM_GAP|REVIEWED/i.test(ga) || ga.includes('NON-PRIMARY') || !/PRIMARY/i.test(ga))
      falseGaps.push({ code: c.code, ga, dir, why });
    else falseGaps.push({ code: c.code, ga, dir, why });
  }
}

chg += `## 1. FALSE GAP / VISIBILITY CORRECTION\n\nGolden A treated as gap (or understated coverage); richer evidence shows substantive teaching.\n\n| KSB | Golden A | Shadow | Why |\n|---|---|---|---|\n`;
for (const x of falseGaps.filter((x) => !/PARTIAL/i.test(x.dir))) {
  chg += `| ${x.code} | ${esc(x.ga)} | ${esc(x.dir)} | ${esc(x.why).slice(0, 180)} |\n`;
}
// Known false-gap set from analysis narrative — ensure listed
const knownFalse = ['S9', 'K10', 'K13', 'S7', 'K18', 'K2', 'K7'];
chg += `\n_Core false-gap flips emphasised in analysis:_ ${knownFalse.join(', ')} (plus other CHANGE_CLASSIFICATION non-partials above).\n\n`;

chg += `## 2. OWNERSHIP CORRECTION\n\nCoverage exists; Golden A Primary appears too late or wrong home.\n\n| KSB | Golden A | Proposed owner | Shadow direction | Why |\n|---|---|---|---|---|\n`;
for (const x of ownership) {
  chg += `| ${x.code} | ${esc(x.ga)} | ${esc(x.owner)} | ${esc(x.dir)} | ${esc(x.why).slice(0, 160)} |\n`;
}

chg += `\n## 3. PARTIAL-COVERAGE CORRECTION\n\nBinary Golden A hid component-level weakness (or total-gap hid partial substance).\n\n| KSB | Golden A | Shadow | Why |\n|---|---|---|---|\n`;
for (const x of partials) {
  chg += `| ${x.code} | ${esc(x.ga)} | ${esc(x.dir)} | ${esc(x.why).slice(0, 180)} |\n`;
}
for (const x of falseGaps.filter((x) => /PARTIAL/i.test(x.dir))) {
  chg += `| ${x.code} | ${esc(x.ga)} | ${esc(x.dir)} | ${esc(x.why).slice(0, 180)} |\n`;
}

chg += `\n## 4. DISTRIBUTED / REVIEW\n\nSingle Primary inappropriate or needs judgement.\n\n| KSB | Bucket | Golden A | Shadow | Why |\n|---|---|---|---|---|\n`;
for (const x of distReview) {
  chg += `| ${x.code} | ${x.b} | ${esc(x.ga)} | ${esc(x.dir)} | ${esc(x.why).slice(0, 180)} |\n`;
}
// K25 also distributed flavor
chg += `\nAlso note **K25** sits in CHANGE_CLASSIFICATION_TO_PARTIAL_DISTRIBUTED (Queue A) — treat under partial + distributed judgement.\n`;
write(path.join(PACK, 'REGISTER-GOLDEN-A-TO-SHADOW-CHANGES.md'), chg);

// --- Genuine gap register ---
let gap = `# Genuine-Gap Register (management-facing)\n\n**Critical rule:** Never present “we cannot see the evidence” as “we do not teach this.”\n\nOnly entries below are framed as genuine curriculum/practice/assessment weaknesses **or** explicitly separated as visibility.\n\n`;
gap += `## A. Genuinely missing / insufficient in supplied curriculum evidence\n\n| KSB | Weakness class | What is weak | Notes |\n|---|---|---|---|\n`;
const genuine = [
  ['K1', 'MISSING TEACHING', 'EDI knowledge', 'KEEP GAP'],
  ['K31', 'MISSING TEACHING', 'EDI guidance knowledge', 'KEEP GAP'],
  ['S20', 'MISSING TEACHING', 'EDI compliance skill', 'KEEP GAP'],
  ['B5', 'MISSING TEACHING', 'Inclusive behaviour (beyond focus-tag)', 'KEEP GAP'],
  ['K28', 'INSUFFICIENT TEACHING DEPTH', 'FCA/PCI vs payments/VAT/GDPR adjacency', 'KEEP GAP'],
  ['S11', 'MISSING TEACHING / INSUFFICIENT PRACTICE', 'Battery SoH competence (EV awareness ≠ SoH)', 'KEEP GAP'],
  ['K30', 'MISSING TEACHING', 'Team-working principles', 'KEEP GAP'],
  ['S19', 'INSUFFICIENT PRACTICE', 'Apply team-working principles deliberately', 'KEEP GAP'],
  ['B3', 'MISSING TEACHING', 'Respond/adapt to changing work demands', 'KEEP GAP — adaptive suspension rejected'],
  ['S18', 'INSUFFICIENT TEACHING DEPTH', 'Named sales processes (F&B, consultative, closing…)', 'PARTIAL — generic sales present'],
  ['K25', 'INSUFFICIENT TEACHING DEPTH', 'Efficiency / competitiveness / operational risk', 'PARTIAL / DISTRIBUTED'],
  ['K15', 'INSUFFICIENT TEACHING DEPTH', 'e-machine component', 'Otherwise strong G7'],
  ['K9', 'INSUFFICIENT TEACHING DEPTH', 'Legislation / EU labelling / homologation (sidewall may be visibility)', 'Operational tyre strong'],
  ['K17', 'INSUFFICIENT TEACHING DEPTH', 'Named static/dynamic calibration methods', 'Awareness/repair-impact strong'],
  ['K3', 'INSUFFICIENT TEACHING DEPTH', 'Named LOLER / PUWER / HASAWA / manual handling', 'Core H&S strong'],
  ['K22', 'INSUFFICIENT TEACHING DEPTH', 'Fuel-cell storage & condition monitoring', 'Hydrogen awareness intent only'],
  ['S13', 'INSUFFICIENT PRACTICE / ASSESSMENT', 'HV isolation competence vs rules teaching', 'REVIEW'],
  ['K8', 'INSUFFICIENT TEACHING DEPTH', "Owner's manuals (+ warranty depth)", 'PARTIAL'],
  ['K34', 'INSUFFICIENT TEACHING DEPTH', 'Most digital breadth beyond GDPR fragment', 'PARTIAL'],
  ['S23', 'INSUFFICIENT PRACTICE / TEACHING DEPTH', 'Full digital systems use breadth', 'PARTIAL'],
  ['K20/S25', 'INSUFFICIENT TEACHING DEPTH', 'Air-filter / full filtration breadth', 'PARTIAL fluids strong'],
  ['K4/S6', 'INSUFFICIENT TEACHING DEPTH', 'Explicit reuse/recycling wording vs waste-stream practice', 'Otherwise adequate'],
  ['B4', 'INSUFFICIENT TEACHING DEPTH', 'Seeking CPD opportunities pedagogy', 'Recording mechanism adequate']
];
for (const [code, cls, what, notes] of genuine) {
  gap += `| ${code} | ${cls} | ${what} | ${notes} |\n`;
}

gap += `\n## B. Structural mapping (not “missing teaching”)\n\n| KSB | Class | Issue |\n|---|---|---|\n`;
gap += `| S1–S4, S14 | STRUCTURAL MAPPING | First substantive often B1/FS; Golden A later |\n`;
gap += `| K15/K16 | STRUCTURAL MAPPING | First substantive G7; Golden A B2 |\n`;
gap += `| K17 | STRUCTURAL MAPPING | First G11; Golden A B9 |\n`;
gap += `| K9 | STRUCTURAL MAPPING | Early G3/B2; Golden A B7 |\n`;
gap += `| K26/K27/S17 | STRUCTURAL MAPPING | B3 commercial/stock; Golden A B2 |\n`;
gap += `| K29/K32/S21/S18 | STRUCTURAL MAPPING | G8/B2 first; Golden A B3/B5/B8 |\n`;
gap += `| S24 | STRUCTURAL MAPPING | Early LIR/SPR; Golden A B10 |\n`;
gap += `| S10 | STRUCTURAL MAPPING | DISTRIBUTED — no single Primary |\n`;

gap += `\n## C. Missing / invisible evidence (NOT automatically “we do not teach”)\n\n| Item | Affected | Class |\n|---|---|---|\n`;
gap += `| Unextracted Tyres.ppt | K9 | MISSING / INVISIBLE EVIDENCE |\n`;
gap += `| Unextracted Wheel Alignment.ppt | K19 | MISSING / INVISIBLE EVIDENCE |\n`;
gap += `| Unextracted Fuel Cells.ppt | K22 | MISSING / INVISIBLE EVIDENCE |\n`;
gap += `| Unextracted Vehicle Service History.ppt | K8 | MISSING / INVISIBLE EVIDENCE |\n`;
gap += `| Unextracted Starting/Charging decks | K15/K16 | MISSING / INVISIBLE EVIDENCE |\n`;
gap += `| Filled mentor LIR/SPR examples | B1/B2/B3/B4/S24 etc. | MISSING / INVISIBLE EVIDENCE |\n`;
gap += `| Possible off-pack EDI/induction | K1/K31/S20/B5 | MISSING / INVISIBLE EVIDENCE (may flip KEEP GAP) |\n`;
gap += `| Stock-rotation practical body beyond W29 title | K27/S17 | MISSING / INVISIBLE EVIDENCE / practice depth |\n`;
write(path.join(PACK, 'REGISTER-GENUINE-GAPS.md'), gap);

// --- Evidence request register (deduped) ---
const reqNorm = [
  {
    id: 'ER-01',
    request: 'Named EDI / inclusion teaching materials (not SEND “inclusion” scaffolding)',
    affects: ['K1', 'K31', 'S20', 'B5'],
    why: 'KEEP GAP currently; off-pack induction could change conclusion',
    current: 'KEEP GAP',
    couldChange: true,
    priority: 'HIGH'
  },
  {
    id: 'ER-02',
    request: 'FCA/PCI financial-compliance teaching beyond payments/VAT/GDPR',
    affects: ['K28'],
    why: 'Confirms whether K28 is curriculum gap or misframed payments adjacency',
    current: 'KEEP GAP',
    couldChange: true,
    priority: 'HIGH'
  },
  {
    id: 'ER-03',
    request: 'Battery State-of-Health (SoH) competence teaching/practice/assessment',
    affects: ['S11'],
    why: 'EV awareness must not be mistaken for SoH',
    current: 'KEEP GAP',
    couldChange: true,
    priority: 'HIGH'
  },
  {
    id: 'ER-04',
    request: 'HV isolation competence evidence (learner-performed / assessed)',
    affects: ['S13'],
    why: 'Rules teaching confirmed; assessed isolation competence unproven — REVIEW',
    current: 'REVIEW',
    couldChange: true,
    priority: 'HIGH'
  },
  {
    id: 'ER-05',
    request: 'Filled mentor Learning Impact / Skills Progress examples',
    affects: ['B1', 'B2', 'B3', 'B4', 'S24', 'K30', 'S19'],
    why: 'Behaviour/soft-skill workplace axis currently mechanism-only',
    current: 'Mechanism referenced; filled evidence unsourced',
    couldChange: true,
    priority: 'HIGH'
  },
  {
    id: 'ER-06',
    request: 'Named LOLER / PUWER / HASAWA / manual-handling teaching body',
    affects: ['K3', 'S1'],
    why: 'Core H&S strong; named regs depth gaps',
    current: 'KEEP B1 + depth',
    couldChange: false,
    priority: 'MEDIUM'
  },
  {
    id: 'ER-07',
    request: 'Deeper COSHH teaching body',
    affects: ['K3'],
    why: 'Later intent vs first-home depth',
    current: 'KEEP B1 + depth',
    couldChange: false,
    priority: 'MEDIUM'
  },
  {
    id: 'ER-08',
    request: 'Explicit reuse/recycling teaching (vs waste-stream practice)',
    affects: ['K4', 'S6'],
    why: 'Depth wording vs strong spill/waste practice',
    current: 'KEEP B3 + depth',
    couldChange: false,
    priority: 'MEDIUM'
  },
  {
    id: 'ER-09',
    request: 'Tyres.ppt extract — legislation / EU labelling / sidewall / homologation',
    affects: ['K9'],
    why: 'May convert depth/gap to visibility-resolved coverage',
    current: 'CHANGE ownership early + depth/visibility',
    couldChange: true,
    priority: 'HIGH'
  },
  {
    id: 'ER-10',
    request: 'Named e-machine teaching in LV starting/charging',
    affects: ['K15'],
    why: 'Material official component missing',
    current: 'CHANGE → G7 + e-machine gap',
    couldChange: true,
    priority: 'HIGH'
  },
  {
    id: 'ER-11',
    request: 'ADAS static vs dynamic calibration methods + equipment teaching',
    affects: ['K17'],
    why: 'Awareness strong; named methods thin',
    current: 'CHANGE → G11 + depth',
    couldChange: true,
    priority: 'MEDIUM'
  },
  {
    id: 'ER-12',
    request: 'Ackermann + thrust-angle teaching / Wheel Alignment.ppt extract',
    affects: ['K19'],
    why: 'Core geometry strong; named principles thin/unextracted',
    current: 'KEEP B2 + depth/visibility',
    couldChange: true,
    priority: 'MEDIUM'
  },
  {
    id: 'ER-13',
    request: 'Explicit store/return-to-storage checklist / demonstration',
    affects: ['S4', 'K6'],
    why: 'Maintain/calibration stronger than storage return wording',
    current: 'KEEP/CHANGE ownership B1 + storage depth',
    couldChange: false,
    priority: 'LOW'
  },
  {
    id: 'ER-14',
    request: 'HVAC blower motors / heat exchangers / pipes-hoses named teaching',
    affects: ['K14'],
    why: 'Close component-set depth on otherwise strong HVAC',
    current: 'KEEP B6 + depth',
    couldChange: false,
    priority: 'LOW'
  },
  {
    id: 'ER-15',
    request: 'Fuel Cells.ppt / hydrogen LP body — storage & condition monitoring',
    affects: ['K22'],
    why: 'May resolve visibility vs genuine depth gap',
    current: 'KEEP B9 + depth/visibility',
    couldChange: true,
    priority: 'HIGH'
  },
  {
    id: 'ER-16',
    request: 'Vehicle Service History.ppt extract + owner’s manuals teaching',
    affects: ['K8'],
    why: 'PARTIAL; manuals currently not found',
    current: 'CHANGE → PARTIAL',
    couldChange: true,
    priority: 'MEDIUM'
  },
  {
    id: 'ER-17',
    request: 'Cyber / POS / email / collaboration digital-systems teaching',
    affects: ['K34', 'S23'],
    why: 'Partial digital; breadth incomplete',
    current: 'CHANGE → PARTIAL',
    couldChange: true,
    priority: 'MEDIUM'
  },
  {
    id: 'ER-18',
    request: 'Air-filter / full filtration teaching beyond fluids',
    affects: ['K20', 'S25'],
    why: 'Partial fluids-strong conclusion',
    current: 'CHANGE → PARTIAL',
    couldChange: true,
    priority: 'MEDIUM'
  },
  {
    id: 'ER-19',
    request: 'ADAS passive/active deck confirmation (levels wording equivalence)',
    affects: ['K18'],
    why: 'Visibility/depth on passive-active equivalence',
    current: 'CHANGE classification (visibility)',
    couldChange: false,
    priority: 'LOW'
  },
  {
    id: 'ER-20',
    request: 'Dedicated business-operations teaching (efficiency, competitiveness, operational risk)',
    affects: ['K25'],
    why: 'Partial/distributed; CS/ethics fragments insufficient',
    current: 'CHANGE → PARTIAL/DISTRIBUTED',
    couldChange: true,
    priority: 'HIGH'
  },
  {
    id: 'ER-21',
    request: 'Named sales-process methods: show & tell, features & benefits, consultative, mini-closing/closing',
    affects: ['K29', 'S18'],
    why: 'Generic sales present; named methodologies absent',
    current: 'Ownership change + PARTIAL/depth',
    couldChange: true,
    priority: 'HIGH'
  },
  {
    id: 'ER-22',
    request: 'Deliberate team-working principles LP / observed teamwork assessment',
    affects: ['K30', 'S19'],
    why: 'KEEP GAP — mention/inference insufficient',
    current: 'KEEP GAP',
    couldChange: true,
    priority: 'HIGH'
  },
  {
    id: 'ER-23',
    request: 'Deliberate behaviour teaching/observation: adapt to changing work demands',
    affects: ['B3'],
    why: 'KEEP GAP; adaptive suspension rejected',
    current: 'KEEP GAP',
    couldChange: true,
    priority: 'HIGH'
  },
  {
    id: 'ER-24',
    request: 'Verified stock-rotation practical body beyond W29 topic title',
    affects: ['K27', 'S17'],
    why: 'Topic intent present; activity body verification thin',
    current: 'CHANGE ownership B3 + practice depth',
    couldChange: false,
    priority: 'MEDIUM'
  },
  {
    id: 'ER-25',
    request: 'Explicit pre- and post-vehicle customer-service teaching framing',
    affects: ['K24'],
    why: 'Needs/challenging conversations strong; pre/post framing partial',
    current: 'KEEP B2 + depth',
    couldChange: false,
    priority: 'LOW'
  },
  {
    id: 'ER-26',
    request: 'Seeking CPD opportunities pedagogy (beyond LIR/SPR recording)',
    affects: ['B4', 'S24'],
    why: 'Recording mechanism adequate; seeking behaviour thinner',
    current: 'KEEP B10 / change S24 ownership + depth',
    couldChange: false,
    priority: 'MEDIUM'
  }
];

let er = `# Consolidated Evidence Request Register\n\nDeduplicated from pilot + R51-1..5. Supported by existing analysis only.\n\n| ID | Priority | Request | Affected KSBs | Why it matters | Current conclusion | Could materially change? |\n|---|---|---|---|---|---|---|\n`;
for (const r of reqNorm.sort((a, b) => ['HIGH', 'MEDIUM', 'LOW'].indexOf(a.priority) - ['HIGH', 'MEDIUM', 'LOW'].indexOf(b.priority))) {
  er += `| ${r.id} | **${r.priority}** | ${r.request} | ${r.affects.join(', ')} | ${r.why} | ${r.current} | ${r.couldChange ? 'YES' : 'No (depth/confirm only)'} |\n`;
}
er += `\n## Raw batch request strings preserved (for audit)\n\n`;
for (const r of allRequests) {
  er += `- (${r.batch}) ${typeof r.request === 'string' ? r.request : JSON.stringify(r)}\n`;
}
write(path.join(PACK, 'REGISTER-EVIDENCE-REQUESTS.md'), er);
write(path.join(PACK, 'evidence-requests.json'), JSON.stringify({ status: 'SHADOW_ONLY', requests: reqNorm, rawBatchRequests: allRequests }, null, 2));

// Director readout
const director = `# Director Read-Out — Autocare Curriculum Assurance (64/64 Shadow)

**Status:** Shadow analysis complete for all 64 ST0499 KSBs. **Not** trusted programme truth until human ratification.

## What is good?

- Core technical systems teaching and assessed practice are generally strong (brakes, tyres operational work, inspection, many mechanical/electrical CEAs).
- Foundation Skills provide a clear early home for H&S, tools, measuring, documentation and written communication.
- Customer service / parts quotation clusters (Group 8) are substantive, not tag-only.
- Environmental workshop practice (spill/waste) supports both skill and behaviour evidence.
- Methodology held across technical, commercial and behaviour KSBs without weakening the final batch.

## What is partial / needs strengthening?

- Several KSBs are **taught in part**: fluids without full filtration; digital GDPR without full IT suite; sales packages without named sales methodologies; HVAC/AC without full component-set naming; ADAS awareness without static/dynamic method naming; geometry without Ackermann/thrust evidence; hydrogen awareness without fuel-cell storage/monitoring detail.
- Soft skills often have mechanisms (role-play, LIR/SPR) but incomplete deliberate breadth.

## What appears genuinely missing?

- EDI / inclusion family (knowledge, skill, behaviour) in the supplied live corpus.
- FCA/PCI-level financial compliance (vs ordinary payments teaching).
- Battery State of Health competence.
- Deliberate team-working principles and adapt-to-changing-demands behaviour.
- Named sales-process methodologies (as distinct from generic sales packaging).

## What is taught but structurally mapped poorly?

- Golden A often places Primary at a **later reinforce Block**.
- Richer evidence repeatedly finds **first substantive teaching** earlier:
  - Foundation → many H&S/tools/documentation skills
  - G7 → batteries/starting/charging
  - G8 → customer/sales/comms
  - G11 → ADAS awareness
  - Early tyre/geometry groups vs late Block tags

## What was previously invisible?

- Group-era lesson plans, CEA practicals and extracted PPTs that Golden A SOW-only review could not see — flipping several “gaps” to coverage or partial coverage (tyre knowledge practice, emissions/inspection evidence, hybrid levels, workplace instructions substance, etc.).

## What evidence do we still need?

See \`REGISTER-EVIDENCE-REQUESTS.md\`. Highest priority: EDI pack, SoH, HV isolation competence, e-machine, Fuel Cells/tyre legislation extracts, named sales processes, team/adapt behaviour evidence, filled mentor LIR/SPR.

## What this is not

- Not a 0–100 assurance score.
- Not approval to rewrite the SOW/OTJ model.
- Not Golden B.
`;
write(path.join(PACK, 'DIRECTOR-READOUT.md'), director);

const gate = `# Golden B Readiness Gate

**Do not draft Golden B until all gate conditions below are explicitly signed.**

| # | Gate condition | Owner | Met? |
|---|---|---|---|
| 1 | Queue A (CHANGE CLASSIFICATION / OWNERSHIP / DISTRIBUTED / REVIEW) reviewed with APPROVE or AMEND recorded | Curriculum / Quality | ☐ |
| 2 | Queue B (KEEP GAP) reviewed and confirmed or flipped with evidence | Curriculum / Quality | ☐ |
| 3 | Disputed ownership resolved **or** deliberately marked DISTRIBUTED | Curriculum Lead | ☐ |
| 4 | Material HIGH evidence requests supplied **or** residual uncertainty explicitly accepted | Curriculum Lead | ☐ |
| 5 | No approved conclusion relies on invented week/session mapping | Analyst + Lead | ☐ |
| 6 | Visibility issues not silently converted into “we do not teach” management wording | Director sign-off | ☐ |
| 7 | R51-1..5 + complete 64 report treated as frozen inputs; corrigenda logged separately | Assurance | ☐ |
| 8 | Explicit decision to open Golden B drafting workstream (still no auto programme-truth) | Director | ☐ |

Only after 1–8: open **Golden B drafting / human ratification** (still forbids OTJ/SOW/formula auto-writes and Primary persistence until a further gate).
`;
write(path.join(PACK, 'GOLDEN-B-READINESS-GATE.md'), gate);

const product = `# Product Learning (record only — do not implement)

The 64-KSB exercise proves the Portal should eventually ingest apprenticeship evidence and construct:

STANDARD → DUTY → KSB → KSB COMPONENT → BLOCK → SESSION (nullable) → TEACHING MATERIAL → PRACTICE → ASSESSMENT → WORKPLACE EVIDENCE → GATEWAY/EPA

…while preserving provenance and confidence.

It must separately answer:

1. WHAT SHOULD BE TAUGHT?
2. WHAT IS TAUGHT?
3. WHAT IS PRACTISED?
4. WHAT IS ASSESSED?
5. WHAT IS EVIDENCED?
6. WHERE IS IT STRUCTURALLY OWNED?
7. WHAT IS MISSING?
8. WHAT IS MERELY INVISIBLE?

## Do not automate yet

- Primary/gap persistence
- Numeric assurance score
- Mass resource→KSB mapping
- OTJ/SOW/formula derivation from shadow
- AI-1.5 / AI-2 / V2 generation of programme truth

This file is product-design learning only.
`;
write(path.join(PACK, 'PRODUCT-LEARNING.md'), product);

const incon = `# Inconsistencies discovered while reconciling the 64

These are reconciliation notes for human ratifiers — not silent auto-fixes.

1. **S18 dual change** — both PARTIAL classification and OWNERSHIP change (B8 → G8/B2). Queue A; decide both axes.
2. **K25** — PARTIAL + DISTRIBUTED flavour; Golden A Primary B6 sits awkwardly against thin substance.
3. **KEEP_GAP vs Golden A PRIMARY** — B3 (and any similar) means richer evidence rejects adequacy of the assigned Primary home/content, not merely “confirm gap.”
4. **Companion pairs with divergent Golden A homes** — e.g. K26 Golden A B2 vs S16 KEEP B3; shadow aligns K26 to B3 with S16.
5. **K29 vs S15/S18** — S15 KEEP B2 includes organisational sales component; S18 demands named process models and remains partial. Do not let S15 KEEP erase S18 depth gap.
6. **S10 DISTRIBUTED** — only KSB forced to remain without Primary; do not invent one in Golden B without new evidence.
7. **S13 REVIEW** — teaching of rules vs assessed competence split; unique among EV family vs K21/K23 KEEP.
8. **Pilot taxonomy format differs** from R51 dossiers — cards normalised, but pilot evidence refs are thinner in pack tables; consult pilot JSON for depth.
9. **Workplace axis almost universally “mechanism only”** — filled LIR/SPR absence is systemic, not KSB-specific failure.
10. **Counts:** Queue A ${queueA.length} + B ${queueB.length} + C ${queueC.length} = ${queueA.length + queueB.length + queueC.length} (must equal 64).
`;
write(path.join(PACK, 'INCONSISTENCIES.md'), incon);

const process = `# Recommended Human Ratification Process

1. **Read** \`DIRECTOR-READOUT.md\` (30–45 min) for management framing.
2. **Work Queue A first** (high-priority changes). For each KSB: APPROVE / AMEND / HOLD FOR EVIDENCE. Record notes on the card.
3. **Work Queue B** (KEEP GAP). Confirm genuine absence vs request off-pack evidence before accepting gaps.
4. **Spot-check Queue C** — especially any KEEP with TEACHING DEPTH / PRACTICE / ASSESSMENT tags (e.g. K3, K19, K22, B4, K23).
5. **Close or park** HIGH evidence requests (\`REGISTER-EVIDENCE-REQUESTS.md\`).
6. **Resolve ownership disputes** using the change register; mark DISTRIBUTED where a single Primary remains inappropriate.
7. **Sign Golden B readiness gate** only when conditions met.
8. **Then** open Golden B drafting — still no auto programme-truth / OTJ / SOW writes.

Do not re-run the 64 analysis unless new evidence is supplied; reopen only affected KSBs.
`;
write(path.join(PACK, 'RECOMMENDED-HUMAN-PROCESS.md'), process);

// Machine queues json
write(
  path.join(PACK, 'queues.json'),
  JSON.stringify(
    {
      status: 'SHADOW_ONLY',
      queueA: queueA.map((c) => c.code),
      queueB: queueB.map((c) => c.code),
      queueC: queueC.map((c) => c.code),
      counts: { A: queueA.length, B: queueB.length, C: queueC.length, total: cards.length }
    },
    null,
    2
  )
);

console.log(
  JSON.stringify(
    {
      pack: PACK,
      freeze: FREEZE,
      counts: { A: queueA.length, B: queueB.length, C: queueC.length, total: cards.length },
      queueA: queueA.map((c) => c.code).sort(),
      queueB: queueB.map((c) => c.code).sort(),
      queueC: queueC.map((c) => c.code).sort()
    },
    null,
    2
  )
);
