import fs from 'fs';
import path from 'path';

const pack =
  'tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack';
const cardsPath = path.join(pack, 'cards-64.json');
const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const c = cards.cards.find((x) => x.code === 'S17');
c.humanDecision = 'APPROVE';
c.humanDecisionNotes =
  'Human ratified 2026-08-10: accept CHANGE OWNERSHIP → B3. Golden A PRIMARY B2 rejected; first substantive home G8 parts procedures + W29 accepted. Aligns with ratified companion K27 → B3. Residual stock-rotation practice thinness accepted as non-blocking for the ownership flip.';
c.humanDecisionAt = '2026-08-10';
c.humanDecisionQueue = 'A';
c.linkedEvidenceRequests = [];
c.unresolved = false;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + '\n');

const logPath = path.join(pack, 'DECISIONS-LOG.json');
const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
log.decisions = log.decisions.filter((d) => d.code !== 'S17');
log.decisions.push({
  code: 'S17',
  queue: 'A',
  decision: 'APPROVE',
  decidedAt: '2026-08-10',
  proposedDirectionBucket: 'CHANGE_OWNERSHIP',
  shadowPosition: 'CHANGE_OWNERSHIP_TO_B3',
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
lines = lines.filter((line) => !line.startsWith('| S17 |'));
while (lines.length && lines[lines.length - 1] === '') lines.pop();
lines.push(
  '| S17 | APPROVE | — | — | Accept CHANGE OWNERSHIP → B3; aligns K27 | 2026-08-10 |'
);
lines.push('');
fs.writeFileSync(mdPath, lines.join('\n'));
console.log('Recorded S17 APPROVE');
