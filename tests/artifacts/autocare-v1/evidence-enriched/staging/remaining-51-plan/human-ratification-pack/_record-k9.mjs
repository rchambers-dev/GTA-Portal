import fs from 'fs';
import path from 'path';

const pack =
  'tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack';
const cardsPath = path.join(pack, 'cards-64.json');
const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const c = cards.cards.find((x) => x.code === 'K9');
c.humanDecision = 'HOLD_FOR_EVIDENCE';
c.humanDecisionNotes =
  'Human hold 2026-08-10: leave CHANGE OWNERSHIP to early G3/B2 + depth gaps unresolved pending ER-09 (Tyres.ppt extract for legislation / EU labelling / sidewall / homologation). Ownership direction may stand once evidence reviewed; tech-info components could change.';
c.humanDecisionAt = '2026-08-10';
c.humanDecisionQueue = 'A';
c.linkedEvidenceRequests = ['ER-09'];
c.unresolved = true;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + '\n');

const logPath = path.join(pack, 'DECISIONS-LOG.json');
const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
log.decisions = log.decisions.filter((d) => d.code !== 'K9');
log.decisions.push({
  code: 'K9',
  queue: 'A',
  decision: 'HOLD_FOR_EVIDENCE',
  decidedAt: '2026-08-10',
  proposedDirectionBucket: 'CHANGE_OWNERSHIP',
  shadowPosition: 'CHANGE_OWNERSHIP_TO_EARLY_G3_B2_WITH_DEPTH_GAPS',
  goldenAPosition: c.goldenAPosition,
  rationale: c.humanDecisionNotes,
  amendedPosition: null,
  linkedEvidenceRequests: ['ER-09'],
  unresolved: true
});
log.lastUpdated = '2026-08-10';
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n');

const mdPath = path.join(pack, 'QUEUE-A-DECISIONS.md');
let lines = fs.readFileSync(mdPath, 'utf8').split(/\r?\n/);
lines = lines.filter((line) => !line.startsWith('| K9 |'));
while (lines.length && lines[lines.length - 1] === '') lines.pop();
lines.push(
  '| K9 | HOLD FOR EVIDENCE | — | ER-09 | Unresolved pending Tyres.ppt legislation/labelling/sidewall/homolog | 2026-08-10 |'
);
lines.push('');
fs.writeFileSync(mdPath, lines.join('\n'));
console.log('Recorded K9 HOLD_FOR_EVIDENCE -> ER-09');
