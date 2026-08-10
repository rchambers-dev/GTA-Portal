import fs from 'fs';
import path from 'path';

const pack =
  'tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack';
const cardsPath = path.join(pack, 'cards-64.json');
const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const c = cards.cards.find((x) => x.code === 'S23');
c.humanDecision = 'APPROVE';
c.humanDecisionNotes =
  'Human ratified 2026-08-10: accept CHANGE CLASSIFICATION → PARTIAL vs Golden A reviewed total gap. Thin G8 IT/tech-data and GDPR/payments fragments accepted as enough to reject total-gap; cyber security remains curriculum gap. Aligns with ratified companion K34 → PARTIAL. Primary not forced for whole S23; do not over-credit adjacency.';
c.humanDecisionAt = '2026-08-10';
c.humanDecisionQueue = 'A';
c.linkedEvidenceRequests = [];
c.unresolved = false;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + '\n');

const logPath = path.join(pack, 'DECISIONS-LOG.json');
const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
log.decisions = log.decisions.filter((d) => d.code !== 'S23');
log.decisions.push({
  code: 'S23',
  queue: 'A',
  decision: 'APPROVE',
  decidedAt: '2026-08-10',
  proposedDirectionBucket: 'CHANGE_CLASSIFICATION',
  shadowPosition: 'CHANGE_CLASSIFICATION_TO_PARTIAL',
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
lines = lines.filter((line) => !line.startsWith('| S23 |'));
while (lines.length && lines[lines.length - 1] === '') lines.pop();
lines.push(
  '| S23 | APPROVE | — | — | Accept CHANGE CLASSIFICATION → PARTIAL; aligns K34 | 2026-08-10 |'
);
lines.push('');
fs.writeFileSync(mdPath, lines.join('\n'));
console.log('Recorded S23 APPROVE');
