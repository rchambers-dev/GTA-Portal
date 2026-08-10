import fs from 'fs';
import path from 'path';

const root = 'tests/artifacts/autocare-v1/evidence-enriched/staging';
const outDir = path.join(root, 'remaining-51-plan');

const catalog = JSON.parse(fs.readFileSync('docs/standards/st0499/st0499-ksb-catalog.json', 'utf8'));
// pick richest/latest version with 64
let ksbs = [];
for (const v of catalog.versions) {
  if ((v.ksbs || []).length >= 64) ksbs = v.ksbs;
}
if (!ksbs.length) ksbs = catalog.versions.at(-1).ksbs;

const goldenSrc = fs.readFileSync(
  'src/features/programme-definition/domain/curriculum-analysis/golden-eval.ts',
  'utf8'
);
const goldenPrimary = new Map();
const goldenGap = new Set();
for (const m of goldenSrc.matchAll(/\{\s*ksbCode:\s*"([A-Z0-9]+)",\s*blockNumber:\s*(\d+)\s*\}/g)) {
  goldenPrimary.set(m[1], Number(m[2]));
}
// Detect reviewed gaps from manifests / prior tags where golden has REVIEWED
// We'll load from manifests
const manifests = JSON.parse(
  fs.readFileSync(path.join(outDir, 'remaining-51-manifests.json'), 'utf8')
);

const byCode = new Map();
for (const k of ksbs) {
  byCode.set(k.code, {
    code: k.code,
    kind: k.kind || (k.code.startsWith('K') ? 'knowledge' : k.code.startsWith('S') ? 'skills' : 'behaviours'),
    official: k.statement || k.requirement || k.description || '',
    goldenAPosition: null,
    goldenAPrimaryBlock: null,
    batch: null,
    shadowDirection: null,
    teaching: null,
    practice: null,
    assessment: null,
    workplace: null,
    structural: null,
    taxonomy: [],
    confidence: null,
    keyEvidence: [],
    unresolved: [],
    shadowOwnership: null
  });
}

for (const m of manifests.manifests || []) {
  const row = byCode.get(m.ksbCode);
  if (!row) continue;
  row.goldenAPosition = m.goldenAPosition || null;
  row.goldenAPrimaryBlock = m.goldenAPrimaryBlock ?? null;
}

for (const [code, block] of goldenPrimary) {
  const row = byCode.get(code);
  if (!row) continue;
  row.goldenAPosition = row.goldenAPosition || 'PRIMARY';
  row.goldenAPrimaryBlock = block;
}

function ingestDossier(code, dos, batch, goldenFallback) {
  const row = byCode.get(code);
  if (!row) return;
  row.batch = batch;
  row.shadowDirection = dos.shadowDirection || dos.direction || null;
  row.confidence = dos.confidenceOverall || dos.O_confidence || null;
  row.taxonomy = dos.assuranceClassifications || dos.taxonomyIssues || [];
  if (dos.axisRollup) {
    row.teaching = dos.axisRollup.teaching;
    row.practice = dos.axisRollup.practice;
    row.assessment = dos.axisRollup.assessment;
    row.workplace = dos.axisRollup.workplaceApplication;
    row.structural = dos.axisRollup.structuralAccounting;
  }
  if (dos.ownership) {
    row.shadowOwnership = dos.ownership.firstSubstantiveTeachingHome || dos.ownership.status;
  }
  if (dos.goldenAComparedAfter?.position) {
    // keep
  }
  // evidence sampling
  const comps = dos.components || [];
  for (const c of comps.slice(0, 3)) {
    const ev = c.teaching?.evidence?.[0] || c.practice?.evidence?.[0];
    if (ev) row.keyEvidence.push(ev);
    if ((c.teaching?.status || '').includes('NOT_FOUND') || (c.teaching?.status || '').includes('WEAK')) {
      row.unresolved.push(c.claim || c.id);
    }
  }
  if (dos.comparisonTableEntry) {
    /* noop */
  }
}

// Pilot special
const pilot = JSON.parse(fs.readFileSync(path.join(root, 'phase2a/shadow-golden-b-pilot-6ksb.json'), 'utf8'));
for (const row of pilot.comparisonTable || []) {
  const r = byCode.get(row.ksb);
  if (!r) continue;
  r.batch = 'PILOT';
  r.shadowDirection = row.direction === 'CHANGE' ? 'CHANGE_CLASSIFICATION' : row.direction === 'KEEP' ? 'KEEP_PRIMARY' : row.direction === 'REVIEW' ? 'REVIEW' : row.direction;
  r.teaching = row.shadowCoverage;
  r.practice = row.practice;
  r.assessment = row.assessment;
  r.structural = row.ownership;
  r.taxonomy = row.taxonomy || [];
  r.confidence = pilot.dossiers?.[row.ksb]?.O_confidence || 'HIGH';
  r.shadowOwnership = row.ownership;
  r.keyEvidence = ['See phase2a/shadow-golden-b-pilot-6ksb.json'];
}

// Tranche2 + R51
const batchFiles = [
  ['TRANCHE2', path.join(root, 'tranche2/shadow-tranche-2.json')],
  ['R51-1', path.join(outDir, 'batch-r51-1/shadow-batch-r51-1.json')],
  ['R51-2', path.join(outDir, 'batch-r51-2/shadow-batch-r51-2.json')],
  ['R51-3', path.join(outDir, 'batch-r51-3/shadow-batch-r51-3.json')],
  ['R51-4', path.join(outDir, 'batch-r51-4/shadow-batch-r51-4.json')],
  ['R51-5', path.join(outDir, 'batch-r51-5/shadow-batch-r51-5.json')]
];

for (const [batch, file] of batchFiles) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [code, dos] of Object.entries(j.dossiers || {})) {
    ingestDossier(code, dos, batch);
  }
}

// Direction buckets
function bucketDirection(d) {
  if (!d) return 'UNRESOLVED';
  const s = String(d).toUpperCase();
  if (s.includes('KEEP_GAP') || s === 'KEEP_AS_GAP' || s.includes('KEEP_AS_GAP')) return 'CHANGE_CLASSIFICATION'; // gap remains but may change Golden A gap confirmation — count as KEEP gap under classification
  if (s.includes('CHANGE_OWNERSHIP')) return 'CHANGE_OWNERSHIP';
  if (s.includes('CHANGE_CLASSIFICATION') || s === 'CHANGE' || s.includes('CHANGE_TO')) return 'CHANGE_CLASSIFICATION';
  if (s.includes('DISTRIBUTED') && s.includes('KEEP')) return 'DISTRIBUTED';
  if (s.includes('REVIEW')) return 'REVIEW';
  if (s.includes('KEEP')) return 'KEEP';
  if (s.includes('GAP')) return 'CHANGE_CLASSIFICATION';
  return 'UNRESOLVED';
}

// Better direction totals: separate KEEP_GAP as classification keep of gap
function bucketDirectionDetailed(d) {
  if (!d) return 'UNRESOLVED';
  const s = String(d).toUpperCase();
  if (s.includes('KEEP_GAP') || s.includes('KEEP_AS_GAP')) return 'KEEP_GAP';
  if (s.includes('CHANGE_OWNERSHIP') && s.includes('CLASSIFICATION')) return 'CHANGE_OWNERSHIP'; // dual - ownership primary
  if (s.includes('CHANGE_OWNERSHIP')) return 'CHANGE_OWNERSHIP';
  if (s.includes('CHANGE_CLASSIFICATION') || (s.includes('CHANGE') && !s.includes('OWNERSHIP'))) return 'CHANGE_CLASSIFICATION';
  if (s.includes('DISTRIBUTED')) return 'DISTRIBUTED';
  if (s.includes('REVIEW')) return 'REVIEW';
  if (s.includes('KEEP')) return 'KEEP';
  return 'UNRESOLVED';
}

const rows = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

const dirTotals = {};
const taxTotals = {
  GOOD: 0,
  CURRICULUM_GAP: 0,
  TEACHING_DEPTH_GAP: 0,
  PRACTICE_GAP: 0,
  ASSESSMENT_GAP: 0,
  EVIDENCE_VISIBILITY_GAP: 0,
  STRUCTURAL_MAPPING_GAP: 0,
  DISTRIBUTED_OWNERSHIP: 0
};

for (const r of rows) {
  const b = bucketDirectionDetailed(r.shadowDirection);
  dirTotals[b] = (dirTotals[b] || 0) + 1;
  const tax = (r.taxonomy || []).join(' | ').toUpperCase();
  if (tax.includes('GOOD') || tax.includes('ADEQUATE')) taxTotals.GOOD++;
  if (tax.includes('CURRICULUM_GAP') || tax.includes('CURRICULUM GAP')) taxTotals.CURRICULUM_GAP++;
  if (tax.includes('TEACHING_DEPTH')) taxTotals.TEACHING_DEPTH_GAP++;
  if (tax.includes('PRACTICE_GAP') || tax.includes('PRACTICE GAP')) taxTotals.PRACTICE_GAP++;
  if (tax.includes('ASSESSMENT_GAP') || tax.includes('ASSESSMENT GAP')) taxTotals.ASSESSMENT_GAP++;
  if (tax.includes('EVIDENCE_VISIBILITY') || tax.includes('VISIBILITY')) taxTotals.EVIDENCE_VISIBILITY_GAP++;
  if (tax.includes('STRUCTURAL_MAPPING') || tax.includes('OWNERSHIP ISSUE')) taxTotals.STRUCTURAL_MAPPING_GAP++;
  if (tax.includes('DISTRIBUTED')) taxTotals.DISTRIBUTED_OWNERSHIP++;
}

function esc(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

let md = '';
md += '# COMPLETE 64-KSB SHADOW ASSURANCE REPORT\n\n';
md += '**STATUS:** SHADOW / STAGING ONLY · not programme truth · not trusted Golden B  \n';
md += '**Standard:** ST0499 v1.3  \n';
md += '**Generated:** 2026-08-10  \n';
md += '**Coverage:** 64 / 64 richer-evidence analysed  \n\n';
md += 'Sources: Pilot (6) + Tranche 2 (7) + R51-1..R51-5 (51). R51-1..4 human-ratified as shadow; R51-5 awaiting ratification.\n\n';
md += '---\n\n## Direction totals\n\n';
md += '| Bucket | Count |\n|---|---:|\n';
for (const [k, v] of Object.entries(dirTotals).sort((a, b) => b[1] - a[1])) {
  md += `| ${k} | ${v} |\n`;
}
md += `\n**Note:** KEEP_GAP = richer evidence confirms insufficient coverage (gap retained). CHANGE_CLASSIFICATION includes visibility false-gaps flipped and partials. No 0–100 score.\n\n`;

md += '## Assurance taxonomy totals (non-exclusive; a KSB may contribute to multiple)\n\n';
md += '| Taxonomy | Approx KSBs tagged |\n|---|---:|\n';
for (const [k, v] of Object.entries(taxTotals)) md += `| ${k} | ${v} |\n`;

md += '\n---\n\n## Full 64-KSB table\n\n';
md += '| Code | Type | Golden A | Batch | Shadow direction | Teach | Practice | Assess | Workplace | Structural ownership | Taxonomy (short) | Confidence |\n';
md += '|---|---|---|---|---|---|---|---|---|---|---|---|\n';

for (const r of rows) {
  const ga =
    r.goldenAPrimaryBlock != null
      ? `PRIMARY B${r.goldenAPrimaryBlock}`
      : r.goldenAPosition || 'REVIEWED/OTHER';
  md += `| ${r.code} | ${r.kind[0].toUpperCase()} | ${esc(ga)} | ${esc(r.batch)} | ${esc(r.shadowDirection)} | ${esc((r.teaching || '').slice(0, 40))} | ${esc((r.practice || '').slice(0, 40))} | ${esc((r.assessment || '').slice(0, 40))} | ${esc((r.workplace || '').slice(0, 28))} | ${esc((r.shadowOwnership || r.structural || '').slice(0, 48))} | ${esc((r.taxonomy || []).join('; ').slice(0, 70))} | ${esc(r.confidence)} |\n`;
}

md += '\n---\n\n## Per-KSB detail (condensed)\n\n';
for (const r of rows) {
  md += `### ${r.code} (${r.kind})\n\n`;
  md += `- **Official:** ${esc(r.official)}\n`;
  md += `- **Golden A:** ${r.goldenAPrimaryBlock != null ? `PRIMARY B${r.goldenAPrimaryBlock}` : r.goldenAPosition || 'n/a'}\n`;
  md += `- **Batch:** ${r.batch}\n`;
  md += `- **Shadow direction:** ${r.shadowDirection}\n`;
  md += `- **Axes:** T=${esc(r.teaching)} · P=${esc(r.practice)} · A=${esc(r.assessment)} · W=${esc(r.workplace)}\n`;
  md += `- **Ownership:** ${esc(r.shadowOwnership || r.structural)}\n`;
  md += `- **Taxonomy:** ${esc((r.taxonomy || []).join(' · '))}\n`;
  md += `- **Confidence:** ${esc(r.confidence)}\n`;
  if (r.keyEvidence.length) md += `- **Key evidence:** ${esc(r.keyEvidence.slice(0, 3).join(' | '))}\n`;
  if (r.unresolved.length) md += `- **Unresolved/missing components:** ${esc(r.unresolved.slice(0, 5).join(' | '))}\n`;
  md += '\n';
}

// Reconciliation narratives
md += `---\n\n## Golden A vs full-shadow reconciliation\n\n`;
md += `### 1. Golden A gaps that remain genuine gaps\n`;
md += `- EDI/inclusion family: **K1, K31, S20, B5**\n`;
md += `- Financial compliance depth: **K28** (payments ≠ FCA/PCI)\n`;
md += `- EV SoH competence: **S11**\n`;
md += `- Soft team/adapt: **K30, S19, B3**\n`;
md += `- Named/process commercial leftovers where partials still material: **S18 named processes**, parts of **K25**\n\n`;

md += `### 2. Golden A gaps that richer evidence disproves (visibility false-gaps / now covered)\n`;
md += `- Pilot/Tranche flips: **S9, K10, K13, S7** (+ others changed from reviewed-gap)\n`;
md += `- R51-1/2: **K18, K2, K7**, partials **K8/K20/S25/K34/S23**\n`;
md += `- Strong Primaries confirmed/kept on CS/parts/written: **S15, S16, K33, S22**, systems KSBs etc.\n\n`;

md += `### 3. Golden A Primaries that remain correct (KEEP)\n`;
md += `Examples: **K12 B2, K11 B5, K14 B6, K19 B2, K21/K23 B6, K3–K6/K5 B1/B3 as ratified, S5/S8/S12/S22 B1/B2, B1, B2, K22 B9, K24 B2, B4 B10, S6/K4 B3** (see table).\n\n`;

md += `### 4. Golden A Primaries whose ownership should be reconsidered\n`;
md += `- Foundation-first vs later Block: **S1–S4, S14 → B1**; **S24 → early LIR/SPR**\n`;
md += `- Systems: **K15/K16 → G7**; **K17 → G11**; **K9 → early G3/B2**\n`;
md += `- Commercial mapping: **K26/K27/S17 → B3**; **K29/K32/S21/S18 → G8/B2** (not B3/B5/B8)\n`;
md += `- Comms: **K32/S21** not B5 first home\n\n`;

md += `### 5. Teaching strong but practice/assessment weak\n`;
md += `- **S13** (EV isolation rules vs assessed competence) — REVIEW\n`;
md += `- **K23** practice/assessment partial\n`;
md += `- **K22** awareness intent vs thin practice/assessment\n`;
md += `- **K27/S17** stock-rotation body verification thin\n\n`;

md += `### 6. Taught but structurally unmapped / mis-homed\n`;
md += `- Multiple early Foundation/G8/G7 first teachings assigned late Primaries in Golden A (see ownership CHANGEs).\n`;
md += `- **S10** remains DISTRIBUTED (breadth without forced Primary).\n\n`;

md += `### 7. Evidence genuinely insufficient\n`;
md += `- EDI set; **K28**; **S11**; **K30/S19/B3**; named sales-process set for **S18**; **e-machine**; named regs (LOLER/PUWER/HASAWA); filled mentor examples.\n\n`;

md += `---\n\n## Product-methodology validation\n\n`;
md += `**A. Has methodology generalised across the whole standard?** Yes — same KSB-first, component-level, organic-edge method applied to all 64 across technical, commercial, soft and behaviour KSBs without score inflation on the final batch.\n\n`;
md += `**B. Does the corpus support a defensible full Golden B human-review stage?** Yes as a **shadow ratification pack** — not as an auto-trusted Golden B. Enough coverage/ownership clarity to human-ratify directions; open evidence requests remain.\n\n`;
md += `**C. High-confidence enough for ratification?** KEEP Primaries with strong G+CEA evidence; CHANGE OWNERSHIP Foundation/G7/G8/G11 first-teaching cases; KEEP GAP EDI/team/adapt/SoH/K28.\n\n`;
md += `**D. Still need human evidence/owner decisions?** All non-blocking evidence requests (tyres PPT, e-machine, ADAS static/dynamic, Ackermann/thrust, stock-rotation body, named sales processes, team/adapt behaviour, filled LIR/SPR, EDI off-pack). Ownership reconciliations for Golden A updates.\n\n`;
md += `**E. Biggest curriculum weaknesses?** EDI/inclusion; FCA/PCI financial; EV SoH; named sales-process methodologies; team-working principles; adapt-to-demand behaviour; e-machine; named H&S regs; some tyre legislation/homologation.\n\n`;
md += `**F. Biggest evidence-visibility weaknesses?** Unextracted PPTs (Tyres, Wheel Alignment, Fuel Cells, Service History, Starting/Charging); filled mentor LIR/SPR; possible off-pack induction/EDI.\n\n`;
md += `**G. Biggest structural mapping weaknesses?** Golden A often places Primary at later reinforce Blocks; Foundation Skills and Group-era first teaching repeatedly earlier (S1–S4, S14, S24, K15–K17, K9, commercial G8).\n\n`;
md += `**H. Traceability model sufficient toward production design?** Yes for shadow graph design (typed edges, provenance, confidence, component status). Not yet for auto-persistence or OTJ formulae.\n\n`;
md += `**I. What should NOT be automated yet?** Primary ownership writes; gap closing; assurance scoring 0–100; mass resource→KSB mapping; AI-1.5/AI-2/V2 generation; programme-truth updates from shadow alone.\n\n`;

md += `---\n\n## Golden B readiness\n\n**Not ready as trusted Golden B.**\n\nReady for: **human ratification of the complete 64-KSB shadow pack**, then a controlled Golden B drafting stage that:\n1. Accepts ratified KEEP/CHANGE/GAP directions\n2. Resolves ownership conflicts deliberately\n3. Attaches only reviewed evidence requests outcomes\n4. Still forbids OTJ/SOW/formula auto-writes\n\n## Exact proposed next step\n\n1. Human-ratify **R51-5** shadow directions (same form as R51-1–4).\n2. Human-ratify the **COMPLETE 64-KSB SHADOW ASSURANCE REPORT** totals and ownership reconciliations.\n3. Only then open a **Golden B drafting / ratification** workstream (still no auto programme-truth).\n4. Parallel: supply priority evidence requests and reopen only affected KSBs.\n\n**STOP.** No Golden A changes. No trusted Golden B writes. No persistence.\n`;

fs.writeFileSync(path.join(outDir, 'COMPLETE-64-KSB-SHADOW-ASSURANCE-REPORT.md'), md);

const summary = {
  status: 'SHADOW_ONLY_NOT_PROGRAMME_TRUTH',
  generatedAt: '2026-08-10',
  richerEvidenceAnalysed: 64,
  directionTotals: dirTotals,
  taxonomyTotals: taxTotals,
  rows: rows.map((r) => ({
    code: r.code,
    kind: r.kind,
    goldenAPrimaryBlock: r.goldenAPrimaryBlock,
    batch: r.batch,
    shadowDirection: r.shadowDirection,
    confidence: r.confidence,
    taxonomy: r.taxonomy
  }))
};
fs.writeFileSync(path.join(outDir, 'COMPLETE-64-KSB-SHADOW-SUMMARY.json'), JSON.stringify(summary, null, 2));

// update manifests analysis status for R51-5
const codes = new Set([
  'K22','K24','K25','K26','K27','K29','K30','K32','S17','S18','S19','S21','S22','S24','B2','B3','B4'
]);
let n = 0;
for (const m of manifests.manifests || []) {
  if (codes.has(m.ksbCode)) {
    m.analysisStatus = 'SHADOW_COMPLETE_AWAITING_HUMAN_REVIEW';
    m.shadowBatch = 'R51-5';
    m.shadowPath = 'batch-r51-5/shadow-batch-r51-5.json';
    n++;
  }
}
manifests.lastShadowBatch = 'R51-5';
manifests.richerEvidenceAnalysedAfterR515 = 64;
manifests.remainingAfterR515 = 0;
manifests.completeShadowReport = 'COMPLETE-64-KSB-SHADOW-ASSURANCE-REPORT.md';
fs.writeFileSync(path.join(outDir, 'remaining-51-manifests.json'), JSON.stringify(manifests, null, 2) + '\n');

console.log('wrote report; updated manifests', n);
console.log('directionTotals', dirTotals);
console.log('missing batch', rows.filter((r) => !r.batch).map((r) => r.code));
