import fs from 'fs';
import path from 'path';

const pack =
  'tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack';
const cardsPath = path.join(pack, 'cards-64.json');
const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const c = cards.cards.find((x) => x.code === 'K15');
c.humanDecision = 'HOLD_FOR_EVIDENCE';
c.humanDecisionNotes =
  'Human hold 2026-08-10: leave CHANGE OWNERSHIP to G7 + e-machine depth gap unresolved pending ER-10 (named e-machine teaching). Ownership toward G7 / awareness≠teaching may still stand; e-machine component could materially change completeness.';
c.humanDecisionAt = '2026-08-10';
c.humanDecisionQueue = 'A';
c.linkedEvidenceRequests = ['ER-10'];
c.unresolved = true;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + '\n');

const logPath = path.join(pack, 'DECISIONS-LOG.json');
const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
log.decisions = log.decisions.filter((d) => d.code !== 'K15');
log.decisions.push({
  code: 'K15',
  queue: 'A',
  decision: 'HOLD_FOR_EVIDENCE',
  decidedAt: '2026-08-10',
  proposedDirectionBucket: 'CHANGE_OWNERSHIP',
  shadowPosition: 'CHANGE_OWNERSHIP_TO_G7_CLUSTER_WITH_E_MACHINE_GAP',
  goldenAPosition: c.goldenAPosition,
  rationale: c.humanDecisionNotes,
  amendedPosition: null,
  linkedEvidenceRequests: ['ER-10'],
  unresolved: true
});
log.lastUpdated = '2026-08-10';
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n');

const mdPath = path.join(pack, 'QUEUE-A-DECISIONS.md');
let lines = fs.readFileSync(mdPath, 'utf8').split(/\r?\n/);
lines = lines.filter((line) => !line.startsWith('| K15 |'));
while (lines.length && lines[lines.length - 1] === '') lines.pop();
lines.push(
  '| K15 | HOLD FOR EVIDENCE | — | ER-10 | Unresolved pending named e-machine teaching | 2026-08-10 |'
);
lines.push('');
fs.writeFileSync(mdPath, lines.join('\n'));
console.log('Recorded K15 HOLD_FOR_EVIDENCE -> ER-10');
