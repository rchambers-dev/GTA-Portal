import fs from 'fs';
import path from 'path';

const pack =
  'tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack';
const cardsPath = path.join(pack, 'cards-64.json');
const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const c = cards.cards.find((x) => x.code === 'K26');
c.humanDecision = 'APPROVE';
c.humanDecisionNotes =
  'Human ratified 2026-08-10: accept CHANGE OWNERSHIP → B3 with G8 first teaching. Aligns with companion S16 KEEP B3; Golden A PRIMARY B2 rejected as wrong commercial home. Strong G8 Task Sheet / Parts Help Sheet costings/procurement evidence.';
c.humanDecisionAt = '2026-08-10';
c.humanDecisionQueue = 'A';
c.linkedEvidenceRequests = [];
c.unresolved = false;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + '\n');

const logPath = path.join(pack, 'DECISIONS-LOG.json');
const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
log.decisions = log.decisions.filter((d) => d.code !== 'K26');
log.decisions.push({
  code: 'K26',
  queue: 'A',
  decision: 'APPROVE',
  decidedAt: '2026-08-10',
  proposedDirectionBucket: 'CHANGE_OWNERSHIP',
  shadowPosition: 'CHANGE_OWNERSHIP_TO_B3_WITH_G8',
  goldenAPosition: c.goldenAPosition,
  rationale: c.humanDecisionNotes,
  amendedPosition: null,
  linkedEvidenceRequests: [],
  unresolved: false
});
log.lastUpdated = '2026-08-10';
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n');

const mdPath = path.join(pack, 'QUEUE-A-DECISIONS.md');
let lines = fs.readFileSync(mdPath, 'utf8').split(/\r?\n/);
lines = lines.filter((line) => !line.startsWith('| K26 |'));
while (lines.length && lines[lines.length - 1] === '') lines.pop();
lines.push(
  '| K26 | APPROVE | — | — | Accept CHANGE OWNERSHIP → B3 (+ G8); aligns S16 | 2026-08-10 |'
);
lines.push('');
fs.writeFileSync(mdPath, lines.join('\n'));
console.log('Recorded K26 APPROVE');
